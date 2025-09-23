// routes/calendar.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware de sesión (sin cambios)
function ensureSession(req, res, next) {
  if (!req.session.user) {
    req.flash('error_msg', 'Debes iniciar sesión para ver el calendario.');
    return res.redirect('/login');
  }
  next();
}


// GET: Ver calendario (eventos + notas personales del usuario)
router.get('/', ensureSession, async (req, res) => {
  try {
    const eventos = await pool.query(
      'SELECT * FROM eventos ORDER BY fecha ASC'
    );

    // CORRECCIÓN 1: Se actualiza la consulta para usar 'usuario_id' y el ID numérico del usuario.
    const notas = await pool.query(
      'SELECT * FROM notas_personales WHERE usuario_id = $1 ORDER BY fecha DESC',
      [req.session.user.id] // Usamos el ID de la sesión.
    );

    res.render('calendar', {
      eventos: eventos.rows,
      notas: notas.rows,
      user: req.session.user
    });

  } catch (err) {
    console.error('❌ Error al cargar calendario:', err);
    req.flash('error_msg', '❌ Error al cargar el calendario.');
    res.redirect(req.session.user.rol === 'Directivo' ? '/dashboard-directivo' : '/dashboard-secretaria');
  }
});

// POST: Guardar nota personal
router.post('/nota', ensureSession, async (req, res) => {
  try {
    const { fecha, nota } = req.body;
    const texto = (nota || '').trim();
    if (!fecha || !texto) {
      req.flash('error_msg', 'La fecha y el texto de la nota son requeridos.');
      return res.redirect('/calendar');
    }

    // CORRECCIÓN 2: Se actualiza el INSERT para usar 'usuario_id' y el ID numérico.
    await pool.query(
      `INSERT INTO notas_personales (usuario_id, nota, fecha)
       VALUES ($1, $2, $3)`,
      [req.session.user.id, texto, fecha] // Usamos el ID de la sesión.
    );

    req.flash('success_msg', '📝 Nota creada correctamente.');
    res.redirect('/calendar');

  } catch (err) {
    console.error('❌ Error al guardar nota:', err);
    req.flash('error_msg', '❌ Error al guardar la nota.');
    res.redirect('/calendar');
  }
});

// POST: Agregar evento (solo Directivo)
router.post('/evento', ensureSession, async (req, res) => {
  try {
    if (req.session.user.rol !== 'Directivo') {
      req.flash('error_msg', 'No tienes permisos para crear eventos.');
      return res.redirect('/calendar');
    }

    const { titulo, fecha, descripcion } = req.body;
    if (!titulo || !fecha) {
      req.flash('error_msg', 'Título y fecha son requeridos.');
      return res.redirect('/calendar');
    }

    // CORRECCIÓN 3: Se añade 'usuario_id' al INSERT para saber quién creó el evento.
    await pool.query(
      'INSERT INTO eventos (titulo, fecha, descripcion, usuario_id) VALUES ($1, $2, $3, $4)',
      [titulo.trim(), fecha, (descripcion || '').trim(), req.session.user.id]
    );

    req.flash('success_msg', '📅 Evento creado.');
    res.redirect('/calendar');

  } catch (err) {
    console.error('❌ Error al guardar evento:', err);
    req.flash('error_msg', '❌ Error al guardar el evento.');
    res.redirect('/calendar');
  }
});


// GET: Notificaciones (ya no se usa en este flujo, pero se corrige por si acaso)
router.get('/notificaciones', ensureSession, async (req, res) => {
  try {
    // CORRECCIÓN 4: Se actualiza la consulta para usar 'usuario_id' y el ID numérico.
    const { rows } = await pool.query(
      `SELECT id, nota FROM notas_personales WHERE usuario_id = $1 AND notificado = FALSE`,
      [req.session.user.id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('❌ Error en notificaciones:', err);
    res.json({ ok: false, data: [] });
  }
});

// DELETE: eliminar nota
router.post('/nota/eliminar', ensureSession, async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('DELETE FROM notas_personales WHERE id=$1 AND usuario_id=$2', [id, req.session.user.id]);
    req.flash('success_msg', 'Nota eliminada correctamente.');
    res.redirect('/calendar');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error al eliminar la nota.');
    res.redirect('/calendar');
  }
});

// POST: editar nota
router.post('/nota/editar', ensureSession, async (req, res) => {
  const { id, nota, hora } = req.body;
  try {
    await pool.query(
      'UPDATE notas_personales SET nota=$1, hora=$2 WHERE id=$3 AND usuario_id=$4',
      [nota, hora || null, id, req.session.user.id]
    );
    req.flash('success_msg', 'Nota actualizada correctamente.');
    res.redirect('/calendar');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error al actualizar la nota.');
    res.redirect('/calendar');
  }
});

// DELETE: eliminar evento
router.post('/evento/eliminar', ensureSession, async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('DELETE FROM eventos WHERE id=$1 AND usuario_id=$2', [id, req.session.user.id]);
    req.flash('success_msg', 'Evento eliminado correctamente.');
    res.redirect('/calendar');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error al eliminar el evento.');
    res.redirect('/calendar');
  }
});

// POST: editar evento
router.post('/evento/editar', ensureSession, async (req, res) => {
  const { id, titulo, descripcion, hora } = req.body;
  try {
    await pool.query(
      'UPDATE eventos SET titulo=$1, descripcion=$2, hora=$3 WHERE id=$4 AND usuario_id=$5',
      [titulo, descripcion || '', hora || null, id, req.session.user.id]
    );
    req.flash('success_msg', 'Evento actualizado correctamente.');
    res.redirect('/calendar');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error al actualizar el evento.');
    res.redirect('/calendar');
  }
});



module.exports = router;
