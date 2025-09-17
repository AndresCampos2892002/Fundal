const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
// Aquí importamos las funciones desde el archivo de middlewares
const { ensureSession, checkDirectivoPermission } = require('../middlewares/authMiddleware');

// Proteger todas las rutas de usuarios
router.get('/', ensureSession, checkDirectivoPermission, usuariosController.listarUsuarios);
router.post('/crear', ensureSession, checkDirectivoPermission, usuariosController.crearUsuario);
router.post('/editar/:id', ensureSession, checkDirectivoPermission, usuariosController.editarUsuario);
router.post('/eliminar/:id', ensureSession, checkDirectivoPermission, usuariosController.eliminarUsuario);

module.exports = router;