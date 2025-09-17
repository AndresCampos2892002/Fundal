// D:\Desktop\FundalProgram\controllers\expedientesController.js
const pool = require('../db');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Módulo para manejar archivos del sistema

// --- Configuración de Multer para la subida de archivos ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `doc-${req.params.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
exports.upload = multer({ storage: storage });


/**
 * Muestra el listado de todos los expedientes de los niños, con opción de búsqueda.
 */
// CORRECCIÓN: Ahora solo lista expedientes ACTIVOS
exports.listarExpedientes = async (req, res) => {
  try {
    const busqueda = req.query.busqueda || '';
    let query = 'SELECT * FROM nino WHERE activo = TRUE'; // <-- Filtro añadido
    const params = [];

    if (busqueda) {
      query += ' AND (nombre_completo ILIKE $1 OR codigo ILIKE $1)';
      params.push(`%${busqueda}%`);
    }
    query += ' ORDER BY id DESC';

    const { rows } = await pool.query(query, params);

    res.render('expedientes', {
      user: req.session.user,
      ninos: rows,
      busqueda: busqueda,
      titulo: "Expedientes de Niños Activos", // Título para la vista
      vistaActivos: true, // Flag para la vista
      success_msg: req.flash('success_msg')[0] || null,
      error_msg: req.flash('error_msg')[0] || null,
    });
  } catch (err) {
    console.error('❌ Error al listar expedientes:', err);
    req.flash('error_msg', '❌ Error al cargar los expedientes.');
    res.redirect('/dashboard-directivo');
  }
};

// ==================================================================
// ============ INICIO DE LA NUEVA FUNCIONALIDAD ====================
// ==================================================================

/**
 * Muestra el listado de expedientes DESACTIVADOS.
 */
exports.listarDesactivados = async (req, res) => {
  try {
    const busqueda = req.query.busqueda || '';
    let query = 'SELECT * FROM nino WHERE activo = FALSE'; // <-- Filtro para inactivos
    const params = [];

    if (busqueda) {
      query += ' AND (nombre_completo ILIKE $1 OR codigo ILIKE $1)';
      params.push(`%${busqueda}%`);
    }
    query += ' ORDER BY id DESC';

    const { rows } = await pool.query(query, params);

    res.render('expedientes', {
      user: req.session.user,
      ninos: rows,
      busqueda: busqueda,
      titulo: "Expedientes Desactivados", // Título diferente
      vistaActivos: false, // Flag para que la vista se comporte diferente
      success_msg: req.flash('success_msg')[0] || null,
      error_msg: req.flash('error_msg')[0] || null,
    });
  } catch (err)
 {
    console.error('❌ Error al listar expedientes desactivados:', err);
    req.flash('error_msg', '❌ Error al cargar los expedientes desactivados.');
    res.redirect('/expedientes');
  }
};

/**
 * Cambia el estado de un expediente (activo <-> inactivo).
 */
exports.toggleEstadoExpediente = async (req, res) => {
    const { id } = req.params;
    try {
        // Obtenemos el estado actual para mostrar un mensaje coherente
        const result = await pool.query('SELECT activo FROM nino WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            req.flash('error_msg', '❌ Expediente no encontrado.');
            return res.redirect('/expedientes');
        }
        const estadoActual = result.rows[0].activo;

        // Invertimos el estado en la base de datos
        await pool.query('UPDATE nino SET activo = NOT activo WHERE id = $1', [id]);

        const mensaje = estadoActual ? 'desactivado' : 'reactivado';
        req.flash('success_msg', `✅ Expediente ${mensaje} correctamente.`);

        // Si estaba activo, ahora estará en la lista de desactivados, y viceversa.
        // Redirigimos a la lista principal para evitar confusión.
        res.redirect('/expedientes');

    } catch (err) {
        console.error('❌ Error al cambiar estado del expediente:', err);
        req.flash('error_msg', '❌ Ocurrió un error al actualizar el expediente.');
        res.redirect('/expedientes');
    }
};


/**
 * Muestra la información completa de un expediente, filtrando por año.
 */
exports.verExpediente = async (req, res) => {
    const { id, anio } = req.params;
    try {
        const { rows: ninoRows } = await pool.query('SELECT * FROM nino WHERE id = $1', [id]);
        if (ninoRows.length === 0) {
            req.flash('error_msg', '❌ Expediente de niño no encontrado.');
            return res.redirect('/expedientes');
        }

        const { rows: representantesRows } = await pool.query('SELECT * FROM representantes_legales WHERE nino_id = $1', [id]);
        const { rows: expedientesRows } = await pool.query('SELECT * FROM expedientes_anuales WHERE nino_id = $1 ORDER BY anio DESC', [id]);

        const anioSeleccionado = anio || (expedientesRows.length > 0 ? expedientesRows[0].anio : new Date().getFullYear());
        const expedienteDelAnio = expedientesRows.find(exp => exp.anio == anioSeleccionado) || null;

        let documentosDelAnio = [];
        if (expedienteDelAnio) {
            const documentosResult = await pool.query('SELECT * FROM documentos_nino WHERE expediente_anual_id = $1 ORDER BY fecha_subida DESC', [expedienteDelAnio.id]);
            documentosDelAnio = documentosResult.rows;
        }

        res.render('ver-expediente', {
            user: req.session.user,
            nino: ninoRows[0],
            representantes: representantesRows,
            documentos: documentosDelAnio,
            expedientesAnuales: expedientesRows,
            expedienteDelAnio: expedienteDelAnio,
            anioSeleccionado: anioSeleccionado,
            success_msg: req.flash('success_msg')[0] || null,
            error_msg: req.flash('error_msg')[0] || null
        });

    } catch (err) {
        console.error('Error al ver expediente:', err);
        req.flash('error_msg', '❌ Error al cargar expediente.');
        res.redirect('/expedientes');
    }
};

/**
 * Procesa la creación de un nuevo registro de expediente anual.
 */
exports.agregarAnioExpediente = [
  body('anio', 'El año es requerido y debe ser un número válido').notEmpty().isInt({ min: 2000, max: 2100 }),
  body('grado', 'El grado es requerido').notEmpty(),
  async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg));
      return res.redirect(`/expedientes/${id}`);
    }

    const { anio, grado, programa_asignado, observaciones } = req.body;
    try {
      const existingYear = await pool.query('SELECT id FROM expedientes_anuales WHERE nino_id = $1 AND anio = $2', [id, anio]);
      if (existingYear.rows.length > 0) {
        req.flash('error_msg', `❌ El expediente para el año ${anio} ya existe.`);
        return res.redirect(`/expedientes/${id}`);
      }
      await pool.query(
        `INSERT INTO expedientes_anuales (nino_id, anio, grado, programa_asignado, observaciones) VALUES ($1, $2, $3, $4, $5)`,
        [id, anio, grado, programa_asignado, observaciones]
      );
      req.flash('success_msg', `✅ Expediente del año ${anio} agregado con éxito.`);
      res.redirect(`/expedientes/${id}/${anio}`);
    } catch (err) {
      console.error('❌ Error al agregar año de expediente:', err);
      req.flash('error_msg', '❌ Ocurrió un error al guardar el nuevo año.');
      res.redirect(`/expedientes/${id}`);
    }
  }
];

/**
 * Procesa la subida de un nuevo documento para un año específico.
 */
exports.subirDocumentoAnual = async (req, res) => {
    const { id, anio } = req.params;
    const { documento_tipo } = req.body;

    if (!req.file || !documento_tipo) {
        req.flash('error_msg', '❌ Debe seleccionar un tipo y un archivo.');
        if (req.file) fs.unlink(req.file.path, err => err && console.error(err));
        return res.redirect(`/expedientes/${id}/${anio}`);
    }

    try {
        const expedienteResult = await pool.query('SELECT id FROM expedientes_anuales WHERE nino_id = $1 AND anio = $2', [id, anio]);
        if (expedienteResult.rows.length === 0) throw new Error('Expediente anual no encontrado.');

        const expedienteAnualId = expedienteResult.rows[0].id;
        const archivoPath = req.file.path.replace(/\\/g, '/').replace('public/', '');

        await pool.query(
            `INSERT INTO documentos_nino (nino_id, expediente_anual_id, tipo, archivo, fecha_subida) VALUES ($1, $2, $3, $4, NOW())`,
            [id, expedienteAnualId, documento_tipo, archivoPath]
        );

        req.flash('success_msg', '✅ Documento subido con éxito.');
        res.redirect(`/expedientes/${id}/${anio}`);
    } catch (err) {
        console.error('❌ Error al subir documento anual:', err);
        req.flash('error_msg', '❌ Ocurrió un error al subir el documento.');
        res.redirect(`/expedientes/${id}/${anio}`);
    }
};

/**
 * Procesa la eliminación de un documento.
 */
exports.eliminarDocumento = async (req, res) => {
    const { docId } = req.params;
    try {
        const docResult = await pool.query(
            `SELECT doc.archivo, exp.nino_id, exp.anio
             FROM documentos_nino doc
             JOIN expedientes_anuales exp ON exp.id = doc.expediente_anual_id
             WHERE doc.id = $1`, [docId]
        );

        if (docResult.rows.length === 0) {
            req.flash('error_msg', '❌ Documento no encontrado.');
            return res.redirect('/expedientes');
        }

        const doc = docResult.rows[0];
        const filePath = path.join(__dirname, '..', 'public', doc.archivo);

        fs.unlink(filePath, (err) => {
            if (err) console.error(`Error al borrar archivo ${filePath}:`, err);
        });

        await pool.query('DELETE FROM documentos_nino WHERE id = $1', [docId]);

        req.flash('success_msg', '🗑️ Documento eliminado con éxito.');
        res.redirect(`/expedientes/${doc.nino_id}/${doc.anio}`);
    } catch (err) {
        console.error('❌ Error al eliminar documento:', err);
        req.flash('error_msg', '❌ Ocurrió un error al eliminar el documento.');
        res.redirect('/expedientes');
    }
};

/**
 * Muestra el formulario para editar los datos generales de un niño.
 */
exports.editarExpediente = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM nino WHERE id = $1', [id]);
        if (rows.length === 0) {
            req.flash('error_msg', '❌ Expediente no encontrado.');
            return res.redirect('/expedientes');
        }
        res.render('editar-expediente', {
            user: req.session.user,
            nino: rows[0],
            success_msg: req.flash('success_msg')[0] || null,
            error_msg: req.flash('error_msg')[0] || null,
        });
    } catch (err) {
        console.error('❌ Error al cargar formulario de edición:', err);
        req.flash('error_msg', '❌ Error al cargar la página de edición.');
        res.redirect('/expedientes');
    }
};

/**
 * Guarda los cambios realizados en los datos generales de un niño.
 */
exports.guardarEdicionExpediente = [
    // Validaciones
    body('codigo', 'El código es requerido.').notEmpty(),
    body('nombre_completo', 'El nombre completo es requerido.').notEmpty(),
    async (req, res) => {
        const { id } = req.params;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array().map(e => e.msg));
            return res.redirect(`/expedientes/editar/${id}`);
        }

        const { codigo, nombre_completo, fecha_nacimiento, edad, referido_por, diagnostico } = req.body;
        try {
            await pool.query(
                `UPDATE nino SET
                    codigo = $1,
                    nombre_completo = $2,
                    fecha_nacimiento = $3,
                    edad = $4,
                    referido_por = $5,
                    diagnostico = $6
                WHERE id = $7`,
                [codigo, nombre_completo, fecha_nacimiento || null, edad || null, referido_por || null, diagnostico || null, id]
            );
            req.flash('success_msg', '✅ Expediente actualizado correctamente.');
            res.redirect(`/expedientes/${id}`);
        } catch (err) {
            console.error('❌ Error al guardar edición de expediente:', err);
            req.flash('error_msg', '❌ Error al guardar los cambios.');
            res.redirect(`/expedientes/editar/${id}`);
        }
    }
];

