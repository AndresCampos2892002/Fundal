const pool = require('../db');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

// Middlewares de permisos (asumiendo que los tienes en un archivo separado o definido en tus rutas)
// const { ensureSession, checkEditPermission } = require('../middlewares/authMiddleware');

// --- Configuración de Multer (se mantiene tu configuración) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const ninoValidator = [
  body('nombre_completo').notEmpty().withMessage('El nombre completo del niño es requerido.'),
  body('codigo').notEmpty().withMessage('El código del niño es requerido.'),
  body('anio_escolar').notEmpty().withMessage('El año escolar es requerido.').isInt({ min: 2000, max: 2100 }).withMessage('Debe ser un año válido.'),
];

// ----------------------------------------------------
// -- FUNCIONES DEL CONTROLADOR
// ----------------------------------------------------

exports.mostrarFormulario = [
  // ensureSession, checkEditPermission,
  async (req, res) => {
    try {
      let formData = {};
      const { fromPostulacion } = req.query;

      if (fromPostulacion) {
        const result = await pool.query('SELECT * FROM postulaciones WHERE id = $1', [fromPostulacion]);
        if (result.rows.length > 0) {
          const p = result.rows[0];
          formData = {
            fromPostulationId: p.id,
            nombre_completo: p.nombre_niño,
            fecha_nacimiento: p.fecha_nacimiento,
            edad: p.edad,
            diagnostico: p.diagnostico,
            referido_por: p.referido_por,
          };
        }
      }

      res.render('crear-nino', {
        user: req.session.user,
        anioSugerido: new Date().getFullYear(),
        success_msg: req.flash('success_msg')[0] || null,
        error_msg: req.flash('error_msg')[0] || null,
        formData: formData
      });
    } catch (err) {
      console.error('❌ Error al cargar el formulario de niño:', err);
      req.flash('error_msg', '❌ Error al intentar cargar los datos de la postulación.');
      res.redirect('/postulaciones');
    }
  }
];

exports.crearNino = [
  // ensureSession, checkEditPermission,
  upload.array('documento_archivo[]'),
  ...ninoValidator,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Si hay errores de validación, renderiza de nuevo el formulario con los errores y los datos
      return res.status(400).render('crear-nino', {
        user: req.session.user,
        anioSugerido: new Date().getFullYear(),
        // Convierte el array de errores a un string simple para mostrarlo
        error_msg: errors.array().map(e => e.msg).join('. '),
        formData: req.body // Devuelve todos los datos que el usuario ya había escrito
      });
    }

    const { fromPostulationId } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por,
        anio_escolar, grado, programa_asignado, observaciones,
        representante_nombre, representante_dpi, representante_parentesco,
        representante_telefono, representante_direccion
      } = req.body;

      const documentosTipo = req.body['documento_tipo[]'];
      const documentosArchivos = req.files;

      const ninoQuery = `
        INSERT INTO nino (codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por, fecha_creacion, postulacion_id)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING id;
      `;
      const ninoResult = await client.query(ninoQuery, [
        codigo, nombre_completo, fecha_nacimiento || null, edad || null, diagnostico || null, referido_por || null,
        fromPostulationId || null
      ]);
      const ninoId = ninoResult.rows[0].id;

      const expedienteAnualQuery = `
        INSERT INTO expedientes_anuales (nino_id, anio, grado, programa_asignado, observaciones)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await client.query(expedienteAnualQuery, [
        ninoId, anio_escolar, grado || null, programa_asignado || null, observaciones || null
      ]);

      if (representante_nombre && representante_nombre.trim() !== '') {
        const representanteQuery = `
          INSERT INTO representantes_legales (nino_id, nombre, dpi, parentesco, telefono, direccion)
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
        await client.query(representanteQuery, [
          ninoId, representante_nombre, representante_dpi || null, representante_parentesco || null,
          representante_telefono || null, representante_direccion || null
        ]);
      }

      if (documentosArchivos && documentosArchivos.length > 0) {
        const documentoQuery = `
          INSERT INTO documentos_nino (nino_id, tipo, archivo, fecha_subida)
          VALUES ($1, $2, $3, NOW());
        `;
        for (let i = 0; i < documentosArchivos.length; i++) {
          const tipo = Array.isArray(documentosTipo) ? documentosTipo[i] : documentosTipo;
          const archivo = documentosArchivos[i];
          if (tipo && archivo) {
            await client.query(documentoQuery, [ninoId, tipo, archivo.path]);
          }
        }
      }

      await client.query('COMMIT');
      req.flash('success_msg', `✅ Expediente completo para ${nombre_completo} creado.`);
      res.redirect('/expedientes');

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error al crear niño y su expediente completo:', err);

      // ==================================================================
      // =========== INICIO DE LA CORRECCIÓN: MANEJO DE ERRORES ===========
      // ==================================================================
      let friendlyError = '❌ Ocurrió un error inesperado al guardar el expediente.';

      // Verificamos si el error es por una llave única duplicada de PostgreSQL
      if (err.code === '23505') {
        // Verificamos si el error es específicamente por la columna 'codigo'
        if (err.constraint && err.constraint.includes('codigo')) {
          friendlyError = `❌ El código de expediente "${req.body.codigo}" ya está en uso. Por favor, ingrese uno diferente.`;
        }
      }

      // Renderizamos la misma vista, pasando el mensaje de error y los datos del formulario
      // para que el usuario no pierda su trabajo.
      res.status(500).render('crear-nino', {
          user: req.session.user,
          anioSugerido: new Date().getFullYear(),
          error_msg: friendlyError,
          formData: req.body // Devolvemos todos los datos que el usuario ya había escrito
      });
      // ==================================================================
      // ============ FIN DE LA CORRECCIÓN: MANEJO DE ERRORES =============
      // ==================================================================

    } finally {
      client.release();
    }
  }
];

