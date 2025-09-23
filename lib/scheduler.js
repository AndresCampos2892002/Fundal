const cron = require('node-cron');
const pool = require('../db');

/**
 * Tarea programada para borrar mensajes con más de 7 días de antigüedad.
 * Se ejecuta una vez por semana, los domingos a las 3:00 AM.
 */
const startScheduledJobs = () => {
    // La expresión '0 3 * * 0' significa "a las 3:00 AM, solo los domingos".
    // El '0' al final especifica el día de la semana (Domingo).
    cron.schedule('0 3 * * 0', async () => {
        console.log('🚀 Ejecutando tarea semanal: Borrando mensajes antiguos...');
        try {
            // Cambiamos el intervalo a '7 days' para que borre lo que tenga más de una semana.
            const result = await pool.query(
                "DELETE FROM mensajes WHERE fecha_envio < NOW() - INTERVAL '7 days'"
            );
            console.log(`✅ Tarea completada. Mensajes antiguos borrados: ${result.rowCount}`);
        } catch (err) {
            console.error('❌ Error al ejecutar la tarea de borrado de mensajes:', err);
        }
    });
};

module.exports = { startScheduledJobs };