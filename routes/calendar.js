// routes/calendar.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware de sesión
function ensureSession(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// GET: Ver calendario (eventos + notas personales del usuario)
router.get('/', ensureSession, async (req, res) => {
  try {
    const eventos = await pool.query(
      'SELECT * FROM eventos ORDER BY fecha ASC'
    );

    const notas = await pool.query(
      'SELECT * FROM notas_personales WHERE usuario = $1 ORDER BY fecha DESC',
      [req.session.user.username]
    );

    res.render('calendar', {
      eventos: eventos.rows,
      notas: notas.rows,
      user: req.session.user
    });

  } catch (err) {
    console.error('❌ Error al cargar calendario:', err);
    res.status(500).send('Error cargando calendario');
  }
});

// POST: Guardar nota personal (con recordatorio)
router.post('/nota', ensureSession, async (req, res) => {
  try {
    const { fecha, nota, hora } = req.body;

    const texto = (nota || '').trim();
    if (!fecha || !texto) {
      return res.redirect('/calendar');
    }

    // Si hay hora la usamos; si no, dejamos por defecto 08:00
    const horaFinal = (hora && hora.trim()) ? hora.trim() : '08:00';
    const recordatorioAt = `${fecha} ${horaFinal}:00`;

    await pool.query(
      `INSERT INTO notas_personales (usuario, nota, fecha, hora, recordatorio_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.session.user.username, texto, fecha, horaFinal, recordatorioAt]
    );

    req.flash?.('success_msg', '📝 Nota creada con recordatorio.');
    res.redirect('/calendar');

  } catch (err) {
    console.error('❌ Error al guardar nota:', err);
    req.flash?.('error_msg', '❌ Error al guardar nota.');
    res.redirect('/calendar');
  }
});

// POST: Agregar evento (solo Directivo)
router.post('/evento', ensureSession, async (req, res) => {
  try {
    if (req.session.user.rol !== 'Directivo') return res.redirect('/login');

    const { titulo, fecha, descripcion, hora } = req.body;
    if (!titulo || !fecha) {
      req.flash?.('error_msg', 'Título y fecha son requeridos.');
      return res.redirect('/calendar');
    }

    // Si envías hora para el evento, puedes guardar fecha+hora en una columna aparte
    // o concatenar a la fecha (según tu esquema actual de "eventos")
    const fechaFinal = fecha; // mantengo tu esquema (solo DATE)
    const descFinal = (descripcion || '').trim();

    await pool.query(
      'INSERT INTO eventos (titulo, fecha, descripcion) VALUES ($1, $2, $3)',
      [titulo.trim(), fechaFinal, descFinal || null]
    );

    req.flash?.('success_msg', '📅 Evento creado.');
    res.redirect('/calendar');

  } catch (err) {
    console.error('❌ Error al guardar evento:', err);
    req.flash?.('error_msg', '❌ Error al guardar evento.');
    res.redirect('/calendar');
  }
});

// GET: Notificaciones pendientes (recordatorios vencidos)
router.get('/notificaciones', ensureSession, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nota, recordatorio_at
       FROM notas_personales
       WHERE usuario = $1
         AND notificado = FALSE
         AND recordatorio_at IS NOT NULL
         AND recordatorio_at <= NOW()
       ORDER BY recordatorio_at ASC
       LIMIT 20`,
      [req.session.user.username]
    );

    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      await pool.query(
        `UPDATE notas_personales SET notificado = TRUE WHERE id = ANY($1::int[])`,
        [ids]
      );
    }

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('❌ Error en notificaciones:', err);
    res.json({ ok: false, data: [] });
  }
});

module.exports = router;
