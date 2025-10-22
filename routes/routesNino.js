// En tu archivo de rutas (router)

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ninoController');

// Muestra el formulario para crear un nuevo niño
router.get('/crear-nino', ctrl.mostrarFormulario);

// Procesa el formulario para crear un nuevo niño
// Ahora, ctrl.upload será una función válida y el error desaparecerá
router.post('/crear-nino', ctrl.crearNino);

router.get('/verificar-codigo/:codigo', ctrl.verificarCodigo);
module.exports = router;
