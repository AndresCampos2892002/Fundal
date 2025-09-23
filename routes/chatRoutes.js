const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chatController');

// Middleware para asegurar sesión
const ensureSession = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
};

// ===================== RUTAS API =====================

// Obtener lista de usuarios para el chat
router.get('/users', ensureSession, ctrl.getChatUsers);

// Obtener historial de mensajes con un usuario específico
router.get('/history/:contactId', ensureSession, ctrl.getMessageHistory);

// Obtener mensajes no leídos por usuario actual
router.get('/unread-messages', ensureSession, ctrl.getUnreadCount);

// Exportar router
module.exports = router;
