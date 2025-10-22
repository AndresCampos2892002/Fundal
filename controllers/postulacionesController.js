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

    // Consulta explícita que nombra cada columna para evitar errores
    let q = `
      SELECT
        p.id, p.fecha_visita, p.medio_comunicacion, p.estado, p."nombre_niño",
        p.fecha_nacimiento, p.edad, p.direccion, p.nombre_madre, p.nombre_padre,
        p.telefono, p.telefono_padre, p.dificultad_auditiva, p.dificultad_visual,
        p.referido_por, p.programa_asignado, p.notas_seguimiento, p.conclusiones,
        p.grado, p.observaciones, p.diagnostico, p.tipo_apoyo, p.atendido_por,
        p.archivado, -- Se añade para futuras lógicas si es necesario
        u.username AS creado_por_usuario
      FROM
        postulaciones p
      LEFT JOIN
        users u ON p.usuario_id = u.id
      WHERE
        p.archivado = FALSE -- Se asegura de mostrar solo las no archivadas
    `;
    let params = [];
    const nombreBusqueda = req.query.nombre || '';

    // Si hay un término de búsqueda, se añade la condición a la consulta
    if (nombreBusqueda) {
      q += ` AND p."nombre_niño" ILIKE $1 `; // Se usa AND porque el WHERE ya existe
      params.push(`%${nombreBusqueda}%`);
    }

    q += `ORDER BY p.id DESC`;

    // Esta es la única consulta que se ejecuta
    const { rows } = await pool.query(q, params);

    // El resto de la función se queda igual
    const specialMsgFlash = req.flash('special_success_msg');
    const specialMsg = specialMsgFlash.length > 0 ? JSON.parse(specialMsgFlash[0]) : null;

    res.render('vistaPostulaciones', {
      user: req.session.user,
      postulaciones: rows,
      special_success_msg: specialMsg,
      nombreBusqueda: nombreBusqueda
    });
  } catch (err) {
    console.error('Error al listar postulaciones:', err);
    req.flash('error_msg', '❌ Error al cargar postulaciones.');
    req.session.save(() => res.redirect('/'));
  }
}];

// EXPORTAR EXCEL (Se mantiene tu función original)
exports.exportarExcel = [ensureSession, async (req, res) => {
    try {
        // 1. Obtener todos los datos
        const { rows } = await pool.query('SELECT * FROM postulaciones ORDER BY id ASC');

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Fundal';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Reporte de Postulaciones');

        // 2. Definición de Columnas (Todos los campos)
        // Se definen los encabezados, la clave que coincide con el dato de la BD, y el ancho.
        // También se añade formato para fechas y ajuste de texto para campos largos.
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 6, style: { alignment: { horizontal: 'center' } } },
            { header: 'Fecha de Visita', key: 'fecha_visita', width: 18, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Medio de Comunicación', key: 'medio_comunicacion', width: 25 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Nombre del Niño', key: 'nombre_niño', width: 35 },
            { header: 'Fecha de Nacimiento', key: 'fecha_nacimiento', width: 18, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Edad', key: 'edad', width: 8, style: { alignment: { horizontal: 'center' } } },
            { header: 'Dirección', key: 'direccion', width: 45 },
            { header: 'Nombre de la Madre', key: 'nombre_madre', width: 35 },
            { header: 'Teléfono Madre', key: 'telefono', width: 18 },
            { header: 'Nombre del Padre', key: 'nombre_padre', width: 35 },
            { header: 'Teléfono Padre', key: 'telefono_padre', width: 18 },
            { header: 'Dificultad Auditiva', key: 'dificultad_auditiva', width: 15 },
            { header: 'Dificultad Visual', key: 'dificultad_visual', width: 15 },
            { header: 'Tipo de Apoyo', key: 'tipo_apoyo', width: 25 },
            { header: 'Referido Por', key: 'referido_por', width: 30 },
            { header: 'Atendido Por', key: 'atendido_por', width: 30 },
            { header: 'Programa Asignado', key: 'programa_asignado', width: 25 },
            { header: 'Grado', key: 'grado', width: 25 },
            { header: 'Notas de Seguimiento', key: 'notas_seguimiento', width: 60, style: { alignment: { wrapText: true } } },
            { header: 'Conclusiones', key: 'conclusiones', width: 60, style: { alignment: { wrapText: true } } },
            { header: 'Observaciones', key: 'observaciones', width: 60, style: { alignment: { wrapText: true } } },
            { header: 'Diagnóstico', key: 'diagnostico', width: 60, style: { alignment: { wrapText: true } } }
        ];

        // 3. Formateo de Datos
        // Convertimos valores booleanos (true/false) a texto legible ("Sí"/"No").
        const formattedRows = rows.map(row => {
          return {
            ...row, // Copiamos todos los datos existentes
            dificultad_auditiva: row.dificultad_auditiva ? 'Sí' : 'No',
            dificultad_visual: row.dificultad_visual ? 'Sí' : 'No'
          };
        });

        // 4. Añadir las filas con los datos ya formateados
        worksheet.addRows(formattedRows);

        // 5. Estilo Profesional para el Encabezado
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF007BFF' } // Un azul profesional
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // 6. Estilo para todas las Celdas de Datos
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) { // Omitir el encabezado
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    // Centra verticalmente el contenido de todas las celdas
                    cell.alignment = { ...cell.alignment, vertical: 'middle' };
                });
            }
        });

        // 7. Enviar el archivo al navegador
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Postulaciones_Fundal.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error al exportar a Excel:', err);
        req.flash('error_msg', '❌ Error al generar el reporte de Excel.');
        req.session.save(() => res.redirect('/postulaciones'));
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
      return req.session.save(() => res.redirect('/postulaciones'));
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
          conclusiones || null, grado || null, observaciones || null, estado || 'EN PROCESO', telefono_padre || null,
          Boolean(dificultad_visual), diagnostico || null, usuarioId
        ]
      );
      req.flash('success_msg', '✅ Postulación creada.');
      req.session.save(() => {
              res.redirect('/postulaciones');
      });
    } catch (err) {
      console.error('Error al crear postulación:', err);
      req.flash('error_msg', '❌ Error al crear postulación.');
      req.session.save(() => {
              res.redirect('/postulaciones');
            });
    }
  }
];

// EDITAR (Se mantiene tu función original)
exports.editar = [
  ensureSession,
  checkEditPermission,
  ...postulacionValidator,
  async (req, res) => {
    // 1. Manejo de errores de validación con flash y redirect
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('; '));
      return req.session.save(() => res.redirect('/postulaciones'));
    }

    try {
      const { id } = req.params;
      const {
        fecha_visita, medio_comunicacion, nombre_niño, fecha_nacimiento, edad, direccion, nombre_madre, telefono,
        nombre_padre, dificultad_auditiva, tipo_apoyo, referido_por, atendido_por, programa_asignado, notas_seguimiento,
        conclusiones, grado, observaciones, estado, telefono_padre, dificultad_visual, diagnostico
      } = req.body;

      // 2. Ejecución de la consulta a la base de datos
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
          conclusiones || null, grado || null, observaciones || null, estado || 'EN PROCESO', telefono_padre || null,
          Boolean(dificultad_visual), diagnostico || null, id
        ]
      );

      // 3. Si todo sale bien, usa flash y redirect
      req.flash('success_msg', '✏️ Postulación editada correctamente.');
      req.session.save(() => {
              res.redirect('/postulaciones');
            });

    } catch (err) {
      // 4. Si ocurre un error, usa flash y redirect
      console.error('Error al editar postulación:', err);
      req.flash('error_msg', '❌ Error al editar la postulación.');
      req.session.save(() => {
              res.redirect('/postulaciones');
            });
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
    const estadosValidos = ['EN PROCESO', 'FINALIZADO', 'NO INICIADO'];
    if (!estadosValidos.includes((estado || '').toUpperCase())) {
      req.flash('error_msg', 'Estado inválido.');
      return res.redirect('/postulaciones');
    }

    try {
      const updateResult = await pool.query(
        `UPDATE postulaciones SET estado=$1, actualizado_en=NOW() WHERE id=$2 RETURNING "nombre_niño"`,
        [estado.toUpperCase(), id]
      );

      if (estado.toUpperCase() === 'FINALIZADO') {
        const nombreNino = updateResult.rows[0]?.nombre_niño || 'desconocido';
        const successMessage = {
          text: `✅ Postulación de <strong>${nombreNino}</strong> actualizada a FINALIZADO.`,
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
exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM postulaciones WHERE id = $1', [id]);

    req.flash('success_msg', '✅ Postulación eliminada permanentemente.');
    req.session.save(() => {
            res.redirect('/postulaciones');
          });
  } catch (err) {
    // 1. Captura CUALQUIER error de la base de datos
    console.error('Error al eliminar postulación:', err); // Mantenemos el log para depuración

    // 2. Comprobación Específica del Error de Llave Foránea
    if (err.code === '23503') {
      // Si el código es '23503', sabemos que es porque un niño depende de esta postulación.
      req.flash('error_msg', '❌ No se puede eliminar esta postulación porque ya tiene un expediente de niño creado.');
    } else {
      // Para cualquier otro error inesperado, mostramos un mensaje genérico.
      req.flash('error_msg', '❌ Ocurrió un error inesperado al intentar eliminar la postulación.');
    }

    req.session.save(() => {
            res.redirect('/postulaciones');
          });
  }
};

//ARCHIVAR LOS FINALIZADOS
exports.archivar = async (req, res) => {
  try {
    const { id } = req.params;
    // Simplemente actualizamos el estado 'archivado' a true
    await pool.query('UPDATE postulaciones SET archivado = TRUE WHERE id = $1', [id]);

    req.flash('success_msg', '✅ Postulación archivada correctamente.');
    req.session.save(() => {
          res.redirect(req.headers.referer || '/postulaciones');
        });
  } catch (err) {
    console.error('Error al archivar la postulación:', err);
    req.flash('error_msg', '❌ Error al archivar la postulación.');
    req.session.save(() => {
          res.redirect(req.headers.referer || '/postulaciones');
        });
  }
};

exports.listarArchivadas = async (req, res) => {
  try {
    // La consulta ahora busca donde 'archivado' es VERDADERO
    const { rows } = await pool.query('SELECT * FROM postulaciones WHERE archivado = TRUE ORDER BY id DESC');

    // Renderizamos una NUEVA vista llamada 'postulaciones-archivadas.ejs'
    res.render('postulaciones-archivadas', {
      user: req.session.user,
      postulaciones: rows,
      // No es necesario pasar mensajes flash aquí, pero lo mantenemos por si acaso
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error al listar postulaciones archivadas:', err);
    req.flash('error_msg', '❌ Error al cargar los archivados.');
    req.session.save(() => {
          res.redirect(req.headers.referer || '/postulaciones');
        });
  }
};

exports.restaurar = async (req, res) => {
  try {
    const { id } = req.params;
    // Actualizamos el estado 'archivado' de vuelta a FALSE
    await pool.query('UPDATE postulaciones SET archivado = FALSE WHERE id = $1', [id]);

    req.flash('success_msg', '✅ Postulación restaurada a la lista de activas.');
    req.session.save(() => {
          res.redirect(req.headers.referer || '/postulaciones/archivadas');
        });
  } catch (err) {
    console.error('Error al restaurar la postulación:', err);
    req.flash('error_msg', '❌ Error al restaurar la postulación.');
    req.session.save(() => {
              res.redirect(req.headers.referer || '/postulaciones/archivadas');
            });
  }
};

exports.ensureSession = ensureSession;
exports.checkEditPermission = checkEditPermission;
exports.checkDirectivoPermission = checkDirectivoPermission;

