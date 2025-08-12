const pool = require('../db');

// Middleware para asegurar la sesión (reutilizado)
const ensureSession = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error_msg', 'Debes iniciar sesión.');
    return res.redirect('/login');
  }
  next();
};

/**
 * Muestra el listado de todos los expedientes de los niños.
 */
exports.listarExpedientes = [
  ensureSession,
  async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM nino ORDER BY id DESC');

      res.render('expedientes', {
        user: req.session.user,
        ninos: rows,
        success_msg: req.flash('success_msg')[0] || null,
        error_msg: req.flash('error_msg')[0] || null,
      });
    } catch (err) {
      console.error('❌ Error al listar expedientes:', err);
      req.flash('error_msg', '❌ Error al cargar los expedientes.');
      res.redirect('/dashboard-directivo');
    }
}];

/**
 * Muestra la información completa de un expediente de niño.
 */
exports.verExpediente = [
  ensureSession,
  async (req, res) => {
    const { id } = req.params;
    try {
      // Obtener los datos principales del niño
      const ninoResult = await pool.query('SELECT * FROM nino WHERE id = $1', [id]);
      const nino = ninoResult.rows[0];

      if (!nino) {
        req.flash('error_msg', '❌ Expediente de niño no encontrado.');
        return res.redirect('/expedientes');
      }

      // Obtener los representantes legales del niño
      const representantesResult = await pool.query('SELECT * FROM representantes_legales WHERE nino_id = $1', [id]);
      const representantes = representantesResult.rows;

      // Obtener los documentos del niño
      const documentosResult = await pool.query('SELECT * FROM documentos_nino WHERE nino_id = $1', [id]);
      const documentos = documentosResult.rows;

      res.render('ver-expediente', {
        user: req.session.user,
        nino,
        representantes,
        documentos,
        success_msg: req.flash('success_msg')[0] || null,
        error_msg: req.flash('error_msg')[0] || null,
      });

    } catch (err) {
      console.error('❌ Error al ver expediente:', err);
      req.flash('error_msg', '❌ Error al cargar el expediente.');
      res.redirect('/expedientes');
    }
}];

/**
 * Muestra el formulario para editar un expediente existente.
 */
exports.editarExpediente = [
  ensureSession,
  async (req, res) => {
    const { id } = req.params;
    // Lógica para obtener los datos del niño y mostrarlos en un formulario de edición
    // Este código es un placeholder, debes adaptarlo para tu formulario de edición.
    try {
      const ninoResult = await pool.query('SELECT * FROM nino WHERE id = $1', [id]);
      const nino = ninoResult.rows[0];

      if (!nino) {
        req.flash('error_msg', '❌ Expediente de niño no encontrado.');
        return res.redirect('/expedientes');
      }

      res.render('editar-expediente', {
        user: req.session.user,
        nino,
        success_msg: req.flash('success_msg')[0] || null,
        error_msg: req.flash('error_msg')[0] || null,
      });

    } catch (err) {
      console.error('❌ Error al cargar el formulario de edición:', err);
      req.flash('error_msg', '❌ Error al cargar el formulario.');
      res.redirect('/expedientes');
    }
}];

/**
 * Procesa la edición de un expediente.
 */
exports.guardarEdicionExpediente = [
  ensureSession,
  async (req, res) => {
    const { id } = req.params;
    const { codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por } = req.body;
    // Lógica para actualizar los datos en la base de datos
    try {
      await pool.query(
        `UPDATE nino SET
          codigo = $1, nombre_completo = $2, fecha_nacimiento = $3, edad = $4,
          diagnostico = $5, referido_por = $6
         WHERE id = $7`,
        [codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por, id]
      );
      req.flash('success_msg', '✅ Expediente actualizado con éxito.');
      res.redirect(`/expedientes/${id}`);
    } catch (err) {
      console.error('❌ Error al guardar edición:', err);
      req.flash('error_msg', '❌ Error al guardar los cambios.');
      res.redirect(`/expedientes/editar/${id}`);
    }
}];
