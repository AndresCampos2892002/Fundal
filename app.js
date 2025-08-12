const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const flash = require('connect-flash');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de base de datos
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
app.locals.pool = pool;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());

app.use(session({
  secret: 'clave-secreta-fundal',
  resave: false,
  saveUninitialized: false
}));

// Middleware global para pasar mensajes a las vistas.
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Importa las rutas
const calendarRoutes = require('./routes/calendar');
const routesPostulaciones = require('./routes/routesPostulaciones');
const authController = require('./controllers/authController');
const usuariosRouter = require('./routes/usuarios');
const routesNino = require('./routes/routesNino');
const routesExpedientes = require('./routes/routesExpedientes'); // <-- NUEVA RUTA IMPORTADA

// === RUTAS ===
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', authController.mostrarLogin);
app.post('/login', authController.procesarLogin);
app.get('/logout', authController.logout);

app.get('/login', (req, res) => {
  if (req.session.user) {
    if (req.session.user.rol === 'Directivo') return res.redirect('/dashboard-directivo');
    if (req.session.user.rol === 'Secretaria') return res.redirect('/dashboard-secretaria');
  }
  if (req.session.user?.token) {
    delete req.session.user.token;
  }
  res.render('login', { error_msg: req.flash('error_msg') });
});

app.use('/calendar', calendarRoutes);
app.use('/postulaciones', routesPostulaciones);
app.use('/usuarios', usuariosRouter);
app.use('/', routesNino);
app.use('/expedientes', routesExpedientes); // <-- NUEVA RUTA UTILIZADA


app.get('/dashboard-directivo', async (req, res) => {
  if (!req.session.user || req.session.user.rol !== 'Directivo') {
    return res.redirect('/login');
  }
  try {
    const eventosResult = await pool.query('SELECT * FROM eventos ORDER BY fecha ASC');
    const notasResult = await pool.query(
      'SELECT * FROM notas_personales WHERE usuario = $1 ORDER BY fecha DESC',
      [req.session.user.username]
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
    return res.redirect('/login');
  }
  try {
    const eventosResult = await pool.query('SELECT * FROM eventos ORDER BY fecha ASC');
    const notasResult = await pool.query(
      'SELECT * FROM notas_personales WHERE usuario = $1 ORDER BY fecha DESC',
      [req.session.user.username]
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
  const { fecha, titulo, descripcion } = req.body;
  try {
    await pool.query(
      'INSERT INTO eventos (fecha, titulo, descripcion) VALUES ($1, $2, $3)',
      [fecha, titulo, descripcion]
    );
    res.redirect('/dashboard-directivo');
  } catch (err) {
    console.error('Error al guardar evento:', err);
    req.flash('error_msg', '❌ Error al guardar evento');
    res.redirect('/dashboard-directivo');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
