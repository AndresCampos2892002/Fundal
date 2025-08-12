const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/postulacionesController');

// Listado de postulaciones: requiere que haya una sesión activa.
router.get('/', ctrl.ensureSession, ctrl.listar);

// Ruta para exportar a Excel
router.get('/exportar-excel', ctrl.ensureSession, ctrl.exportarExcel);

// Crear postulación: requiere sesión y permisos de edición.
router.post('/crear', ctrl.ensureSession, ctrl.checkEditPermission, ctrl.crear);

// Editar postulación: requiere sesión y permisos de edición.
router.post('/editar/:id', ctrl.ensureSession, ctrl.checkEditPermission, ctrl.editar);

// Cambiar estado: requiere sesión y permisos de 'Directivo'.
router.post('/estado/:id', ctrl.ensureSession, ctrl.checkDirectivoPermission, ctrl.cambiarEstado);

// Eliminar postulación: requiere sesión y permisos de 'Directivo'.
router.post('/eliminar/:id', ctrl.ensureSession, ctrl.checkDirectivoPermission, ctrl.eliminar);

module.exports = router;
