const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ninoController');

// Muestra el formulario para crear un nuevo niño
router.get('/crear-nino', ctrl.mostrarFormulario);

// Procesa el formulario para crear un nuevo niño
router.post('/crear-nino', ctrl.crearNino);

module.exports = router;
