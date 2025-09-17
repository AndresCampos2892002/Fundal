// controllers/chatController.js
const pool = require('../db');

/**
 * Devuelve una lista de todos los usuarios (excepto el actual) en formato JSON
 * para que el widget del chat los pueda mostrar.
 */
exports.getChatUsers = async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const { rows } = await pool.query(
            'SELECT id, username, rol FROM users WHERE id != $1 ORDER BY username ASC',
            [currentUserId]
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Error al obtener usuarios para el chat:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Devuelve el historial de mensajes entre el usuario actual y un contacto,
 * y marca los mensajes como leídos.
 */
exports.getMessageHistory = async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const contactId = req.params.contactId;

        // Marcar mensajes como leídos
        await pool.query(
            'UPDATE mensajes SET leido = TRUE WHERE de_usuario_id = $1 AND para_usuario_id = $2 AND leido = FALSE',
            [contactId, currentUserId]
        );

        // Obtener el historial de la conversación
        const { rows } = await pool.query(
            `SELECT * FROM mensajes
             WHERE (de_usuario_id = $1 AND para_usuario_id = $2)
                OR (de_usuario_id = $2 AND para_usuario_id = $1)
             ORDER BY fecha_envio ASC`,
            [currentUserId, contactId]
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Error al obtener el historial de mensajes:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

