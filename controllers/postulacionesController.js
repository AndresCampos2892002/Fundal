const pool = require('../db');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs'); // Importamos la librería ExcelJS

// Mismos middlewares de permisos que ya tienes
const ensureSession = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error_msg', 'Debes iniciar sesión.');
    return res.redirect('/login');
  }
  next();
};

const canEdit = (req) => req.session.user && (req.session.user.rol === 'Secretaria' || req.session.user.rol === 'Directivo');

const checkEditPermission = (req, res, next) => {
  if (!canEdit(req)) {
    req.flash('error_msg', '🔒 No tienes permisos para esta acción.');
    return res.redirect('/postulaciones');
  }
  next();
};

const isDirectivo = (req) => req.session.user && req.session.user.rol === 'Directivo';

function checkDirectivoPermission(req, res, next) {
  if (!isDirectivo(req)) {
    req.flash('error_msg', '🔒 Solo el Directivo puede realizar esta acción.');
    return res.redirect('/postulaciones');
  }
  next();
}

const postulacionValidator = [
  body('nombre_niño').notEmpty().withMessage('El nombre del niño es requerido.'),
  body('edad').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('La edad debe ser un número válido.'),
  body('fecha_nacimiento').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('La fecha de nacimiento no es válida.'),
  body('fecha_visita').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('La fecha de visita no es válida.'),
];

// ----------------------------------------------------
// -- FUNCIONES DEL CONTROLADOR
// ----------------------------------------------------

exports.listar = [ensureSession, async (req, res) => {
  try {
    let q = `SELECT * FROM postulaciones `;
    let params = [];
    const nombreBusqueda = req.query.nombre || '';

    if (nombreBusqueda) {
      q += `WHERE "nombre_niño" ILIKE $1 `;
      params.push(`%${nombreBusqueda}%`);
    }

    q += `ORDER BY id DESC`;

    const { rows } = await pool.query(q, params);

    res.render('vistaPostulaciones', {
      user: req.session.user,
      postulaciones: rows,
      success_msg: req.flash('success_msg')[0] || null,
      error_msg: req.flash('error_msg')[0] || null,
      nombreBusqueda: nombreBusqueda
    });
  } catch (err) {
    console.error('Error al listar postulaciones:', err);
    req.flash('error_msg', '❌ Error al cargar postulaciones.');
    res.redirect('/');
  }
}];

// Nueva función para exportar a Excel
exports.exportarExcel = [ensureSession, async (req, res) => {
    if (!canEdit(req)) {
        req.flash('error_msg', '🔒 No tienes permisos para exportar.');
        return res.redirect('/postulaciones');
    }

    try {
        const { rows } = await pool.query('SELECT * FROM postulaciones ORDER BY id DESC');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Postulaciones');

        // Definir las columnas
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 5 },
            { header: 'Nombre Niño', key: 'nombre_niño', width: 30 },
            { header: 'Fecha Nacimiento', key: 'fecha_nacimiento', width: 15 },
            { header: 'Edad', key: 'edad', width: 10 },
            { header: 'Nombre Madre', key: 'nombre_madre', width: 30 },
            { header: 'Nombre Padre', key: 'nombre_padre', width: 30 },
            { header: 'Teléfono', key: 'telefono', width: 20 },
            { header: 'Fecha Visita', key: 'fecha_visita', width: 15 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Dificultad Auditiva', key: 'dificultad_auditiva', width: 20 },
            { header: 'Dificultad Visual', key: 'dificultad_visual', width: 20 },
            { header: 'Tipo de Apoyo', key: 'tipo_apoyo', width: 25 },
            { header: 'Observaciones', key: 'observaciones', width: 50 },
        ];

        // Agregar los datos de la base de datos a la hoja de cálculo
        worksheet.addRows(rows.map(p => ({
            ...p,
            fecha_nacimiento: p.fecha_nacimiento ? p.fecha_nacimiento.toLocaleDateString() : '',
            fecha_visita: p.fecha_visita ? p.fecha_visita.toLocaleDateString() : '',
            dificultad_auditiva: p.dificultad_auditiva ? 'Sí' : 'No',
            dificultad_visual: p.dificultad_visual ? 'Sí' : 'No',
        })));

        // Configurar la respuesta para la descarga del archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'postulaciones.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('❌ Error al exportar a Excel:', err);
        req.flash('error_msg', '❌ Error al exportar a Excel.');
        res.redirect('/postulaciones');
    }
}];

exports.crear = [
  ensureSession,
  checkEditPermission,
  ...postulacionValidator,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('; '));
      return res.redirect('/postulaciones');
    }

    try {
      const {
        fecha_visita,
        medio_comunicacion,
        nombre_niño,
        fecha_nacimiento,
        edad,
        direccion,
        nombre_madre,
        telefono,
        nombre_padre,
        dificultad_auditiva,
        tipo_apoyo,
        referido_por,
        atendido_por,
        programa_asignado,
        notas_seguimiento,
        conclusiones,
        grado,
        observaciones,
        estado,
        telefono_padre,
        dificultad_visual,
        diagnostico
      } = req.body;

      await pool.query(
        `INSERT INTO postulaciones (
          fecha_visita, medio_comunicacion, "nombre_niño", fecha_nacimiento, edad, direccion, nombre_madre, telefono,
          nombre_padre, dificultad_auditiva, tipo_apoyo, referido_por, atendido_por, programa_asignado, notas_seguimiento,
          conclusiones, grado, observaciones, estado, telefono_padre, dificultad_visual, diagnostico
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          fecha_visita || null,
          medio_comunicacion || null,
          nombre_niño,
          fecha_nacimiento || null,
          edad || null,
          direccion || null,
          nombre_madre || null,
          telefono || null,
          nombre_padre || null,
          Boolean(dificultad_auditiva),
          tipo_apoyo || null,
          referido_por || null,
          atendido_por || null,
          programa_asignado || null,
          notas_seguimiento || null,
          conclusiones || null,
          grado || null,
          observaciones || null,
          estado || 'PENDIENTE',
          telefono_padre || null,
          Boolean(dificultad_visual),
          diagnostico || null
        ]
      );

      req.flash('success_msg', '✅ Postulación creada.');
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al crear postulación:', err);
      req.flash('error_msg', '❌ Error al crear postulación.');
      res.redirect('/postulaciones');
    }
}];

exports.editar = [
  ensureSession,
  checkEditPermission,
  ...postulacionValidator,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('; '));
      return res.redirect('/postulaciones');
    }

    const { id } = req.params;
    try {
      const {
        fecha_visita,
        medio_comunicacion,
        nombre_niño,
        fecha_nacimiento,
        edad,
        direccion,
        nombre_madre,
        telefono,
        nombre_padre,
        dificultad_auditiva,
        tipo_apoyo,
        referido_por,
        atendido_por,
        programa_asignado,
        notas_seguimiento,
        conclusiones,
        grado,
        observaciones,
        estado,
        telefono_padre,
        dificultad_visual,
        diagnostico
      } = req.body;

      await pool.query(
        `UPDATE postulaciones SET
          fecha_visita=$1, medio_comunicacion=$2, "nombre_niño"=$3, fecha_nacimiento=$4, edad=$5, direccion=$6, nombre_madre=$7, telefono=$8,
          nombre_padre=$9, dificultad_auditiva=$10, tipo_apoyo=$11, referido_por=$12, atendido_por=$13, programa_asignado=$14, notas_seguimiento=$15,
          conclusiones=$16, grado=$17, observaciones=$18, estado=$19, telefono_padre=$20, dificultad_visual=$21, diagnostico=$22,
          actualizado_en=NOW()
         WHERE id=$23`,
        [
          fecha_visita || null,
          medio_comunicacion || null,
          nombre_niño,
          fecha_nacimiento || null,
          edad || null,
          direccion || null,
          nombre_madre || null,
          telefono || null,
          nombre_padre || null,
          Boolean(dificultad_auditiva),
          tipo_apoyo || null,
          referido_por || null,
          atendido_por || null,
          programa_asignado || null,
          notas_seguimiento || null,
          conclusiones || null,
          grado || null,
          observaciones || null,
          estado || 'PENDIENTE',
          telefono_padre || null,
          Boolean(dificultad_visual),
          diagnostico || null,
          id
        ]
      );

      req.flash('success_msg', '✏️ Postulación editada.');
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al editar postulación:', err);
      req.flash('error_msg', '❌ Error al editar postulación.');
      res.redirect('/postulaciones');
    }
}];

exports.cambiarEstado = [
  ensureSession,
  checkDirectivoPermission,
  async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];
    if (!estadosValidos.includes((estado || '').toUpperCase())) {
      req.flash('error_msg', 'Estado inválido.');
      return res.redirect('/postulaciones');
    }

    try {
      await pool.query(
        `UPDATE postulaciones SET estado=$1, actualizado_en=NOW() WHERE id=$2`,
        [estado.toUpperCase(), id]
      );
      req.flash('success_msg', `🔁 Estado actualizado a ${estado.toUpperCase()}.`);
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      req.flash('error_msg', '❌ Error al cambiar estado.');
      res.redirect('/postulaciones');
    }
}];

exports.eliminar = [
  ensureSession,
  checkDirectivoPermission,
  async (req, res) => {
    try {
      await pool.query('DELETE FROM postulaciones WHERE id=$1', [req.params.id]);
      req.flash('success_msg', '🗑️ Postulación eliminada.');
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al eliminar postulación:', err);
      req.flash('error_msg', '❌ Error al eliminar postulación.');
      res.redirect('/postulaciones');
    }
}];

// Exporta los middlewares para usarlos en las rutas
exports.ensureSession = ensureSession;
exports.checkEditPermission = checkEditPermission;
exports.checkDirectivoPermission = checkDirectivoPermission;
