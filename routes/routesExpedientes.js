// En tu archivo: /routes/routesExpedientes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expedientesController');
const { ensureSession, checkEditPermission } = require('../middlewares/authMiddleware.js');

// ✅ INICIO DE LA CORRECCIÓN: Se añade la configuración de Multer aquí
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define una carpeta específica para los documentos de expedientes si quieres
    cb(null, 'public/uploads/documentos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
// ✅ FIN DE LA CORRECCIÓN

// --- RUTAS ---

// Muestra la lista principal de expedientes ACTIVOS
router.get('/', ensureSession, ctrl.listarExpedientes);

// Muestra la lista de expedientes DESACTIVADOS
router.get('/desactivados', ensureSession, checkEditPermission, ctrl.listarDesactivados);

// Muestra el formulario para EDITAR un expediente
router.get('/editar/:id', ensureSession, checkEditPermission, ctrl.mostrarFormularioEditar);

// Muestra el formulario de Revisión y Reinscripción Anual
router.get('/:id/revision-anual', ensureSession, checkEditPermission, ctrl.mostrarFormularioRevision);

// Muestra el perfil de un expediente (con o sin año)
router.get('/:id', ensureSession, ctrl.verExpediente);
router.get('/:id/:anio', ensureSession, ctrl.verExpediente);

// --- RUTAS POST ---

// Procesa y GUARDA los cambios del formulario de edición
router.post('/editar/:id', ensureSession, checkEditPermission, ctrl.procesarEdicion);

// Procesa y GUARDA la Revisión Anual
router.post('/:id/revision-anual', ensureSession, checkEditPermission, ctrl.procesarRevisionAnual);

// Cambia el estado de un expediente (activar/desactivar)
router.post('/:id/toggle-estado', ensureSession, checkEditPermission, ctrl.toggleEstadoExpediente);

// --- Rutas para manejar documentos ---
// Sube un nuevo documento para un año escolar específico
// Ahora "upload" SÍ existe y esta línea funcionará
router.post('/:id/:anio/documento/subir', ensureSession, checkEditPermission, upload.single('documento_archivo'), ctrl.subirDocumentoAnual);

// Elimina un documento específico
router.post('/documento/:docId/eliminar', ensureSession, checkEditPermission, ctrl.eliminarDocumento);

module.exports = router;