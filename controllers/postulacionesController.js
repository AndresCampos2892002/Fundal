// controllers/postulacionesController.js
const pool = require('../db');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');

// --- Middlewares (sin cambios) ---
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
const isDirectivo = (req) => req.session.user && (req.session.user.rol === 'Secretaria' || req.session.user.rol === 'Directivo');
function checkDirectivoPermission(req, res, next) {
  if (!isDirectivo(req)) {
    req.flash('error_msg', '🔒 Solo el Directivo puede realizar esta acción.');
    return res.redirect('/postulaciones');
  }
  next();
}

// --- VALIDADOR CON SINTAXIS CORREGIDA ---
const postulacionValidator = [
  body('nombre_niño').notEmpty().withMessage('El nombre del niño es requerido.'),
  body('edad').isFloat({ min: 0 }).withMessage('La edad debe ser un número válido.').optional({ checkFalsy: true }),
  body('fecha_nacimiento').isISO8601().toDate().withMessage('La fecha de nacimiento no es válida.').optional({ checkFalsy: true }),
  body('fecha_visita').isISO8601().toDate().withMessage('La fecha de visita no es válida.').optional({ checkFalsy: true }),
];

// --- FUNCIONES DEL CONTROLADOR ---

// LISTAR (FUSIONADO: Muestra quién registró y maneja el mensaje especial)
exports.listar = [ensureSession, async (req, res) => {
  try {
    let q = `
      SELECT p.*, u.username AS creado_por_usuario
      FROM postulaciones p
      LEFT JOIN users u ON p.usuario_id = u.id
    `;
    let params = [];
    const nombreBusqueda = req.query.nombre || '';
    if (nombreBusqueda) {
      q += `WHERE p."nombre_niño" ILIKE $1 `;
      params.push(`%${nombreBusqueda}%`);
    }
    q += `ORDER BY p.id DESC`;
    const { rows } = await pool.query(q, params);

    // FUSIÓN: Se añade la lógica para decodificar el mensaje especial si existe
    const specialMsgFlash = req.flash('special_success_msg');
    const specialMsg = specialMsgFlash.length > 0 ? JSON.parse(specialMsgFlash[0]) : null;

    res.render('vistaPostulaciones', {
      user: req.session.user,
      postulaciones: rows,
      success_msg: req.flash('success_msg')[0] || null,
      error_msg: req.flash('error_msg')[0] || null,
      special_success_msg: specialMsg, // <-- Se pasa el mensaje especial a la vista
      nombreBusqueda: nombreBusqueda
    });
  } catch (err) {
    console.error('Error al listar postulaciones:', err);
    req.flash('error_msg', '❌ Error al cargar postulaciones.');
    res.redirect('/');
  }
}];

// EXPORTAR EXCEL (Se mantiene tu función original)
exports.exportarExcel = [ensureSession, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM postulaciones ORDER BY id DESC');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Postulaciones');
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 5 },
            { header: 'Nombre Niño', key: 'nombre_niño', width: 30 },
            { header: 'Fecha Nacimiento', key: 'fecha_nacimiento', width: 15 },
        ];
        worksheet.addRows(rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=postulaciones.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error al exportar:', err);
        req.flash('error_msg', 'Error al exportar a Excel.');
        res.redirect('/postulaciones');
    }
}];

// CREAR (Se mantiene tu función original)
exports.crear = [
  ensureSession,
  checkEditPermission,
  ...postulacionValidator,
  async (req, res) => {
    // ... (Tu código de 'crear' se mantiene intacto)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('; '));
      return res.redirect('/postulaciones');
    }
    const {
      fecha_visita, medio_comunicacion, nombre_niño, fecha_nacimiento, edad, direccion, nombre_madre, telefono,
      nombre_padre, dificultad_auditiva, tipo_apoyo, referido_por, atendido_por, programa_asignado, notas_seguimiento,
      conclusiones, grado, observaciones, estado, telefono_padre, dificultad_visual, diagnostico
    } = req.body;
    const usuarioId = req.session.user.id;
    try {
      await pool.query(
        `INSERT INTO postulaciones (
          fecha_visita, medio_comunicacion, "nombre_niño", fecha_nacimiento, edad, direccion, nombre_madre, telefono,
          nombre_padre, dificultad_auditiva, tipo_apoyo, referido_por, atendido_por, programa_asignado, notas_seguimiento,
          conclusiones, grado, observaciones, estado, telefono_padre, dificultad_visual, diagnostico, usuario_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          fecha_visita || null, medio_comunicacion || null, nombre_niño, fecha_nacimiento || null, edad || null,
          direccion || null, nombre_madre || null, telefono || null, nombre_padre || null, Boolean(dificultad_auditiva),
          tipo_apoyo || null, referido_por || null, atendido_por || null, programa_asignado || null, notas_seguimiento || null,
          conclusiones || null, grado || null, observaciones || null, estado || 'PENDIENTE', telefono_padre || null,
          Boolean(dificultad_visual), diagnostico || null, usuarioId
        ]
      );
      req.flash('success_msg', '✅ Postulación creada.');
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al crear postulación:', err);
      req.flash('error_msg', '❌ Error al crear postulación.');
      res.redirect('/postulaciones');
    }
  }
];

// EDITAR (Se mantiene tu función original)
exports.editar = [
  ensureSession,
  checkEditPermission,
  ...postulacionValidator,
  async (req, res) => {
    // ... (Tu código de 'editar' se mantiene intacto)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('; '));
      return res.redirect('/postulaciones');
    }
    const { id } = req.params;
    const {
        fecha_visita, medio_comunicacion, nombre_niño, fecha_nacimiento, edad, direccion, nombre_madre, telefono,
        nombre_padre, dificultad_auditiva, tipo_apoyo, referido_por, atendido_por, programa_asignado, notas_seguimiento,
        conclusiones, grado, observaciones, estado, telefono_padre, dificultad_visual, diagnostico
    } = req.body;
    try {
      await pool.query(
        `UPDATE postulaciones SET
          fecha_visita=$1, medio_comunicacion=$2, "nombre_niño"=$3, fecha_nacimiento=$4, edad=$5, direccion=$6, nombre_madre=$7, telefono=$8,
          nombre_padre=$9, dificultad_auditiva=$10, tipo_apoyo=$11, referido_por=$12, atendido_por=$13, programa_asignado=$14, notas_seguimiento=$15,
          conclusiones=$16, grado=$17, observaciones=$18, estado=$19, telefono_padre=$20, dificultad_visual=$21, diagnostico=$22,
          actualizado_en=NOW()
         WHERE id=$23`,
        [
          fecha_visita || null, medio_comunicacion || null, nombre_niño, fecha_nacimiento || null, edad || null,
          direccion || null, nombre_madre || null, telefono || null, nombre_padre || null, Boolean(dificultad_auditiva),
          tipo_apoyo || null, referido_por || null, atendido_por || null, programa_asignado || null, notas_seguimiento || null,
          conclusiones || null, grado || null, observaciones || null, estado || 'PENDIENTE', telefono_padre || null,
          Boolean(dificultad_visual), diagnostico || null, id
        ]
      );
      req.flash('success_msg', '✏️ Postulación editada correctamente.');
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al editar postulación:', err);
      req.flash('error_msg', '❌ Error al editar la postulación.');
      res.redirect('/postulaciones');
    }
  }
];

// CAMBIAR ESTADO (FUSIONADO: Se reemplaza por la nueva lógica mejorada)
exports.cambiarEstado = [
  ensureSession,
  checkEditPermission,
  async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosValidos = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];
    if (!estadosValidos.includes((estado || '').toUpperCase())) {
      req.flash('error_msg', 'Estado inválido.');
      return res.redirect('/postulaciones');
    }

    try {
      const updateResult = await pool.query(
        `UPDATE postulaciones SET estado=$1, actualizado_en=NOW() WHERE id=$2 RETURNING "nombre_niño"`,
        [estado.toUpperCase(), id]
      );

      if (estado.toUpperCase() === 'APROBADA') {
        const nombreNino = updateResult.rows[0]?.nombre_niño || 'desconocido';
        const successMessage = {
          text: `✅ Postulación de <strong>${nombreNino}</strong> actualizada a APROBADA.`,
          action: {
            url: `/crear-nino?fromPostulacion=${id}`,
            label: 'Crear Expediente Ahora'
          }
        };
        req.flash('special_success_msg', JSON.stringify(successMessage));
      } else {
        req.flash('success_msg', `✅ Estado actualizado a ${estado.toUpperCase()}.`);
      }

      res.redirect('/postulaciones');

    } catch (err) {
      console.error('Error al cambiar estado:', err);
      req.flash('error_msg', '❌ Error al procesar la postulación.');
      res.redirect('/postulaciones');
    }
  }
];

// ELIMINAR (Se mantiene tu función original)
exports.eliminar = [
  ensureSession,
  checkEditPermission,
  async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM postulaciones WHERE id = $1', [id]);
      req.flash('success_msg', '🗑️ Postulación eliminada correctamente.');
      res.redirect('/postulaciones');
    } catch (err) {
      console.error('Error al eliminar postulación:', err);
      req.flash('error_msg', '❌ No se pudo eliminar la postulación. Puede que tenga datos asociados.');
      res.redirect('/postulaciones');
    }
  }
];

exports.ensureSession = ensureSession;
exports.checkEditPermission = checkEditPermission;
exports.checkDirectivoPermission = checkDirectivoPermission;

