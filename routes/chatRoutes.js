// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chatController');

// Middleware para asegurar que el usuario ha iniciado sesión
const ensureSession = (req, res, next) => {
    if (!req.session.user) {
        // Para una API, es mejor devolver un error JSON que redirigir a una página.
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
};

// ==================================================================
// =========== INICIO DE LA CORRECCIÓN: RUTAS TIPO API ==============
// ==================================================================

// Ruta API para obtener la lista de usuarios para el chat.
// El frontend (chat.js) llamará a GET /chat/users
router.get('/users', ensureSession, ctrl.getChatUsers);

// Ruta API para obtener el historial de mensajes con un usuario específico.
// El frontend (chat.js) llamará a GET /chat/history/123 (donde 123 es el ID del contacto)
router.get('/history/:contactId', ensureSession, ctrl.getMessageHistory);

// ==================================================================
// ============ FIN DE LA CORRECCIÓN: RUTAS TIPO API ================
// ==================================================================

module.exports = router;

