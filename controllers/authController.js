const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// Mostrar formulario de login
exports.mostrarLogin = (req, res) => {
  res.render('login', { error: null, token: null });
};

// Procesar login
exports.procesarLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.render('login', { error: 'Usuario no encontrado', token: null });
    }

    const user = result.rows[0];

    if (!user.estado) {
      return res.render('login', { error: 'Usuario inactivo', token: null });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('login', { error: 'Contraseña incorrecta', token: null });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        rol: user.rol
      },
      process.env.JWT_SECRET || 'Fundalparatodos',
      { expiresIn: '2h' }
    );

    console.log('TOKEN ', user.username, ':', token);

    // Guardar en sesión
    req.session.user = {
      id: user.id,
      username: user.username,
      rol: user.rol,
      token
    };

    // Registrar fecha de login e IP
    await pool.query(
      `UPDATE users SET ultima_fecha_login = NOW(), ultima_ip_login = $1 WHERE id = $2`,
      [req.ip, user.id]
    );


    // Redirigir directamente al dashboard
    if (user.rol === 'Directivo') {
      return res.redirect('/dashboard-directivo');
    } else if (user.rol === 'Secretaria') {
      return res.redirect('/dashboard-secretaria');
    } else {
      return res.render('login', { error: 'Rol no válido', token: null });
    }

    // Mostrar token en consola del navegador a través de login.ejs
    res.render('login', { error: null, token });

  } catch (err) {
    console.error('ERROR en login:', err);
    res.render('login', { error: 'Error interno del servidor', token: null });
  }
};

// Cerrar sesión
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};


