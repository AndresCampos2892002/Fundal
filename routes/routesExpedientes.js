// En routes/routesExpedientes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expedientesController');

const { upload } = require('../controllers/expedientesController');

// --- Middlewares de autenticación (se mantienen) ---
const ensureSession = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error_msg', 'Debes iniciar sesión para ver esta página.');
    return res.redirect('/login');
  }
  next();
};

const checkEditPermission = (req, res, next) => {
  const hasPermission = req.session.user && (req.session.user.rol === 'Secretaria' || req.session.user.rol === 'Directivo');
  if (!hasPermission) {
    req.flash('error_msg', '🔒 No tienes los permisos necesarios para realizar esta acción.');
    return res.redirect('/expedientes');
  }
  next();
};

// --- ORDEN DE RUTAS CORREGIDO Y AMPLIADO ---

// NUEVA RUTA: para ver la lista de expedientes desactivados
router.get('/desactivados', ensureSession, checkEditPermission, ctrl.listarDesactivados);

// Las rutas más específicas van PRIMERO.
router.get('/editar/:id', ensureSession, checkEditPermission, ctrl.editarExpediente);

// Las rutas con parámetros genéricos van DESPUÉS.
router.get('/:id', ensureSession, ctrl.verExpediente);
router.get('/:id/:anio', ensureSession, ctrl.verExpediente);

// El resto de las rutas
router.get('/', ensureSession, ctrl.listarExpedientes);
router.post('/editar/:id', ensureSession, checkEditPermission, ctrl.guardarEdicionExpediente);
router.post('/:id/agregar-anio', ensureSession, checkEditPermission, ctrl.agregarAnioExpediente);

// NUEVA RUTA: para procesar el cambio de estado (activar/desactivar)
router.post('/:id/toggle-estado', ensureSession, checkEditPermission, ctrl.toggleEstadoExpediente);

// --- Rutas para manejar documentos (se mantienen) ---
router.post('/:id/:anio/documento/subir', ensureSession, checkEditPermission, upload.single('documento_archivo'), ctrl.subirDocumentoAnual);
router.post('/documento/:docId/eliminar', ensureSession, checkEditPermission, ctrl.eliminarDocumento);

module.exports = router;

