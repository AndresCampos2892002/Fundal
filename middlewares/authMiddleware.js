const jwt = require('jsonwebtoken');

// Middleware 1: Asegura que el usuario esté autenticado
exports.ensureSession = (req, res, next) => {
  if (!req.session.user || !req.session.user.token) {
    req.flash('error_msg', 'Debes iniciar sesión.');
    return res.redirect('/login');
  }
  try {
    const token = req.session.user.token;
    jwt.verify(token, process.env.JWT_SECRET || 'Fundalparatodos');
    next();
  } catch (err) {
    req.session.destroy(() => {
      req.flash('error_msg', 'Tu sesión ha expirado. Inicia sesión de nuevo.');
      res.redirect('/login');
    });
  }
};

// Middleware 2: Verifica que el usuario tenga el rol de 'Directivo'
exports.checkDirectivoPermission = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'Directivo') {
    req.flash('error_msg', '🔒 No tienes permisos para esta acción.');
    return res.redirect('/');
  }
  next();
};

// Middleware 3: Verifica que el usuario tenga el rol de 'Secretaria' o 'Directivo'
exports.checkEditPermission = (req, res, next) => {
  if (!req.session.user || (req.session.user.rol !== 'Secretaria' && req.session.user.rol !== 'Directivo')) {
    req.flash('error_msg', '🔒 No tienes permisos para esta acción.');
    return res.redirect('/');
  }
  next();
};