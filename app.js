
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const flash = require('connect-flash');
const http = require('http');
const { Server } = require("socket.io");
const { startScheduledJobs } = require('./lib/scheduler');

// Importación de Rutas
const authController = require('./controllers/authController');
const calendarRoutes = require('./routes/calendar');
const routesPostulaciones = require('./routes/routesPostulaciones');
const usuariosRouter = require('./routes/usuarios');
const routesNino = require('./routes/routesNino');
const routesExpedientes = require('./routes/routesExpedientes');
const chatRoutes = require('./routes/chatRoutes');

// ======================================================
// 2. INICIALIZACIÓN
// ======================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuración del motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para procesar datos y servir archivos estáticos (CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la sesión (DEBE ir ANTES de flash y las rutas)
const sessionMiddleware = session({
  secret: 'clave-secreta-fundal',
  resave: false,
  saveUninitialized: false
});
app.use(sessionMiddleware);

// Middleware para mensajes flash (DEBE ir DESPUÉS de la sesión)
app.use(flash());

// Middleware global para pasar mensajes y usuario a TODAS las vistas.
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

const userSockets = {};

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const session = socket.request.session;
  // Solo continuar si el usuario está logueado en la sesión
  if (session && session.user) {
    const userId = session.user.id;
    console.log(`✅ Usuario conectado al chat: ${session.user.username} (ID: ${userId})`);
    userSockets[userId] = socket.id; // Asocia el ID de usuario con el ID de su socket

    // Escucha cuando este usuario envía un mensaje privado
    socket.on('private message', async ({ to, content }) => {
      try {
        // Guarda el mensaje en la base de datos
        await pool.query(
          'INSERT INTO mensajes (de_usuario_id, para_usuario_id, contenido) VALUES ($1, $2, $3)',
          [userId, to, content]
        );

        // Busca si el destinatario está conectado
        const recipientSocketId = userSockets[to];
        if (recipientSocketId) {
          // Si está conectado, le envía el mensaje en tiempo real
          io.to(recipientSocketId).emit('private message', {
            content,
            from: userId,
            de_usuario_id: userId
          });
        }
      } catch (err) {
        console.error('❌ Error al procesar mensaje privado:', err);
      }
    });

    // Se ejecuta cuando el usuario se desconecta
    socket.on('disconnect', () => {
      console.log(`🔌 Usuario desconectado: ${session.user.username}`);
      delete userSockets[userId]; // Limpia el registro del usuario
    });
  }
});


// Importa las rutas

app.get('/', (req, res) => {
  res.redirect('/login');
});

// Rutas de Autenticación
app.get('/login', authController.mostrarLogin);
app.post('/login', authController.procesarLogin);
app.get('/logout', authController.logout);

// Rutas de Módulos
app.use('/chat', chatRoutes);
app.use('/calendar', calendarRoutes);
app.use('/postulaciones', routesPostulaciones);
app.use('/usuarios', usuariosRouter);
app.use('/expedientes', routesExpedientes);
app.use('/', routesNino); // Esta ruta ahora está en el lugar correcto

// --- Rutas de Dashboards (sin cambios) ---
app.get('/dashboard-directivo', async (req, res) => {
  if (!req.session.user || req.session.user.rol !== 'Directivo') {
    req.flash('error_msg', 'Acceso no autorizado.');
    return res.redirect('/login');
  }
  try {
    const eventosResult = await pool.query('SELECT * FROM eventos ORDER BY fecha ASC');
    const notasResult = await pool.query(
      'SELECT * FROM notas_personales WHERE usuario_id = $1 ORDER BY fecha DESC',
      [req.session.user.id]
    );
    res.render('dashboard-directivo', {
      user: req.session.user,
      eventos: eventosResult.rows,
      notas: notasResult.rows
    });
  } catch (err) {
    console.error('❌ Error al cargar dashboard-directivo:', err);
    req.flash('error_msg', '❌ Error al cargar el contenido');
    res.redirect('/');
  }
});

app.get('/dashboard-secretaria', async (req, res) => {
  if (!req.session.user || req.session.user.rol !== 'Secretaria') {
    req.flash('error_msg', 'Acceso no autorizado.');
    return res.redirect('/login');
  }
  try {
    const eventosResult = await pool.query('SELECT * FROM eventos ORDER BY fecha ASC');
    const notasResult = await pool.query(
      'SELECT * FROM notas_personales WHERE usuario_id = $1 ORDER BY fecha DESC',
      [req.session.user.id]
    );
    res.render('dashboard-secretaria', {
      user: req.session.user,
      eventos: eventosResult.rows,
      notas: notasResult.rows
    });
  } catch (err) {
    console.error('❌ Error en dashboard-secretaria:', err);
    req.flash('error_msg', '❌ Error al cargar el contenido');
    res.redirect('/');
  }
});

app.post('/eventos', async (req, res) => {
  if (!req.session.user) {
    req.flash('error_msg', 'Debe iniciar sesión para crear eventos.');
    return res.redirect('/login');
  }
  const { fecha, titulo, descripcion } = req.body;
  try {
    await pool.query(
      'INSERT INTO eventos (fecha, titulo, descripcion, usuario_id) VALUES ($1, $2, $3, $4)',
      [fecha, titulo, descripcion, req.session.user.id]
    );
    req.flash('success_msg', '✅ Evento creado correctamente.');
    res.redirect(req.session.user.rol === 'Directivo' ? '/dashboard-directivo' : '/dashboard-secretaria');
  } catch (err) {
    console.error('Error al guardar evento:', err);
    req.flash('error_msg', '❌ Error al guardar evento');
    res.redirect(req.session.user.rol === 'Directivo' ? '/dashboard-directivo' : '/dashboard-secretaria');
  }
});

// --- INICIO DEL SERVIDOR (MODIFICADO) ---
// Ahora usamos 'server.listen' en lugar de 'app.listen' para que socket.io funcione
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en el puerto ${PORT}`);

  startScheduledJobs(); //esta funcion borra los mensaje del chat
});