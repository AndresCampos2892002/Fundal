const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expedientesController');

// Ruta principal para ver la lista de expedientes
router.get('/', ctrl.listarExpedientes);

// Ruta para ver un expediente específico
router.get('/:id', ctrl.verExpediente);

// Ruta para ver el formulario de edición de un expediente
router.get('/editar/:id', ctrl.editarExpediente);

// Ruta para procesar la edición del expediente (formulario POST)
router.post('/editar/:id', ctrl.guardarEdicionExpediente);

module.exports = router;
