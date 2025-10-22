const pool = require('../db');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

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

// ✅ PASO 1: VALIDACIÓN COMPLETA
// Añadimos reglas para todos los nuevos campos que son NOT NULL.
const ninoValidator = [
  body('codigo').notEmpty().withMessage('El código del niño es requerido.'),
  body('nombre_completo').notEmpty().withMessage('El nombre completo del niño es requerido.'),
  body('anio_escolar').notEmpty().withMessage('El año escolar es requerido.'),
  body('genero').notEmpty().withMessage('El género es requerido.'),
  body('id_partida_nacimiento').notEmpty().withMessage('El ID de partida de nacimiento es requerido.'),
  body('departamento').notEmpty().withMessage('El departamento es requerido.'),
  body('municipio').notEmpty().withMessage('El municipio es requerido.'),
  body('aldea').notEmpty().withMessage('La aldea es requerida.'),
  body('etapa').notEmpty().withMessage('La etapa es requerida.'),
  body('fecha_evaluacion').notEmpty().withMessage('La fecha de evaluación es requerida.'),
  body('fecha_ingreso_fundal').notEmpty().withMessage('La fecha de ingreso a Fundal es requerida.'),
  body('fecha_ingreso_mspas').notEmpty().withMessage('La fecha de ingreso al MSPAS es requerida.'),
  body('dificultad_socioeconomica').notEmpty().withMessage('La dificultad socioeconómica es requerida.'),
  body('discapacidad').notEmpty().withMessage('El campo Discapacidad es requerido.'),
  body('docentes').notEmpty().withMessage('Debe seleccionar al menos un docente.'),
  body('codigo_mineduc').notEmpty().withMessage('El Código MINEDUC es requerido.')
];

// ----------------------------------------------------
// -- FUNCIONES DEL CONTROLADOR
// ----------------------------------------------------

// En tu archivo: /controllers/ninoController.js

exports.mostrarFormulario = async (req, res) => {
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
          grado: p.grado,
          programa_asignado: p.programa_asignado,
          observaciones: p.observaciones || p.notas_seguimiento,
          representante_nombre: p.nombre_madre || p.nombre_padre,
          representante_telefono: p.telefono || p.telefono_padre,
          representante_direccion: p.direccion
        };
      }
    }

    // ✅ CORRECCIÓN APLICADA AQUÍ
    res.render('crear-nino', {
      user: req.session.user, // <-- ESTA ES LA LÍNEA QUE SOLUCIONA EL ERROR
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
};

exports.crearNino = [
  // Middleware para procesar la foto de perfil
  upload.single('foto_perfil'),
  ...ninoValidator,
  async (req, res) => {
    // 1. Validación de campos del formulario
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('crear-nino', {
        user: req.session.user,
        anioSugerido: new Date().getFullYear(),
        error_msg: errors.array().map(e => e.msg).join('. '),
        formData: req.body,
        success_msg: null
      });
    }

    // Obtenemos la conexión a la base de datos UNA SOLA VEZ
    const client = await pool.connect();

    try {
      const {
        codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por,
        codigo_mineduc, genero, id_partida_nacimiento, departamento, municipio, aldea, sede, etapa,
        fecha_evaluacion, fecha_ingreso_fundal, fecha_ingreso_mspas, dificultad_socioeconomica,
        discapacidad, docentes,
        anio_escolar, grado, programa_asignado, observaciones,
        representante_nombre, representante_dpi, representante_parentesco,
        representante_telefono, representante_direccion,
        documentos, fromPostulationId, estado_civil,
        auxiliar_nombre, auxiliar_telefono,
      } = req.body;

      // 2. Comprobación de duplicados ANTES de empezar la transacción
      const existingNino = await client.query('SELECT id FROM nino WHERE codigo = $1', [codigo.trim()]);
      if (existingNino.rows.length > 0) {
        // Si ya existe, mostramos un error y terminamos el proceso
        return res.status(409).render('crear-nino', {
          user: req.session.user,
          anioSugerido: new Date().getFullYear(),
          error_msg: `El código de expediente "${codigo}" ya está en uso. Para agregar un nuevo año escolar, busque el expediente existente.`,
          formData: req.body
        });
      }

      if (fromPostulationId) {
          const existingNinoByPostulacion = await client.query('SELECT id FROM nino WHERE postulacion_id = $1', [fromPostulationId]);
          if (existingNinoByPostulacion.rows.length > 0) {
            return res.status(409).render('crear-nino', {
              user: req.session.user,
              anioSugerido: new Date().getFullYear(),
              error_msg: 'Ya se ha creado un expediente a partir de esta postulación. No se puede crear otro.',
              formData: req.body
            });
          }
      }

      // 3. Si no hay duplicados, INICIAMOS la transacción
      await client.query('BEGIN');

      // Procesamiento de datos (foto y docentes)
      const fotoPerfilArchivo = req.file;
      const fotoUrl = fotoPerfilArchivo ? fotoPerfilArchivo.path.replace(/\\/g, '/') : 'default_nino.png';
      const docentesString = Array.isArray(docentes) ? docentes.join(', ') : (docentes || '');

      // PASO A: Insertar en la tabla 'nino' y obtener su ID
      const ninoQuery = `
        INSERT INTO nino (
          codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por, postulacion_id,
          foto_url, codigo_mineduc, genero, id_partida_nacimiento, departamento, municipio, aldea, sede, etapa,
          fecha_evaluacion, fecha_ingreso_fundal, fecha_ingreso_mspas, dificultad_socioeconomica,
          discapacidad, docentes_asignados
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING id;
      `;
      const ninoResult = await client.query(ninoQuery, [
        codigo, nombre_completo, fecha_nacimiento || null, edad || null, diagnostico || null, referido_por || null,
        fromPostulationId || null, fotoUrl, codigo_mineduc || null, genero, id_partida_nacimiento,
        departamento, municipio, aldea, sede, etapa, fecha_evaluacion, fecha_ingreso_fundal,
        fecha_ingreso_mspas, dificultad_socioeconomica, discapacidad, docentesString
      ]);
      const ninoId = ninoResult.rows[0].id;

      // PASO B: Insertar en 'expedientes_anuales' y obtener su ID
      const expedienteAnualQuery = `
      INSERT INTO expedientes_anuales (
          nino_id, anio, grado, programa_asignado, observaciones, foto_url
      )
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id; -- Se añade foto_url y $6
    `;
    const expedienteAnualResult = await client.query(expedienteAnualQuery, [
      ninoId, anio_escolar, grado || null, programa_asignado || null, observaciones || null,
      fotoUrl // <-- Se pasa la misma fotoUrl que se guardó en 'nino'
    ]);
    const expedienteAnualId = expedienteAnualResult.rows[0].id;

      // PASO C: Insertar en 'representantes_legales'
      if (representante_nombre && representante_nombre.trim() !== '') {
          const representanteQuery = `
            INSERT INTO representantes_legales (
              nino_id, nombre, dpi, parentesco, telefono, direccion, estado_civil,
              auxiliar_nombre, auxiliar_telefono
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `;
          await client.query(representanteQuery, [
            ninoId, representante_nombre, representante_dpi || null, representante_parentesco || null,
            representante_telefono || null, representante_direccion || null,
            estado_civil,
            auxiliar_nombre || null, auxiliar_telefono || null
          ]);
      }

      // PASO D: Insertar en 'documentos_nino' usando el checklist
      if (documentos && Array.isArray(documentos)) {
        const documentoQuery = `
          INSERT INTO documentos_nino (nino_id, expediente_anual_id, anio_expediente, tipo, confirmado, fecha_subida)
          VALUES ($1, $2, $3, $4, $5, NOW());
        `;
        for (const doc of documentos) {
          const tipo = doc.tipo;
          const confirmado = !!doc.confirmado;
          await client.query(documentoQuery, [ninoId, expedienteAnualId, anio_escolar, tipo, confirmado]);
        }
      }

      // 4. Si todo salió bien, confirmamos la transacción
      await client.query('COMMIT');
      req.flash('success_msg', `✅ Expediente completo para ${nombre_completo} creado.`);
      res.redirect('/expedientes');

    } catch (err) {
      // 5. Si algo falla durante la transacción, la cancelamos
      await client.query('ROLLBACK');
      console.error('❌ Error al crear niño y su expediente completo:', err);

      let friendlyError = '❌ Ocurrió un error inesperado al guardar el expediente.';
      if (err.code === '23505' && err.constraint && err.constraint.includes('codigo')) {
        friendlyError = `❌ El código de expediente "${req.body.codigo}" ya está en uso. Por favor, ingrese uno diferente.`;
      }
      res.status(500).render('crear-nino', {
        user: req.session.user,
        anioSugerido: new Date().getFullYear(),
        error_msg: friendlyError,
        formData: req.body,
        success_msg: null
      });
    } finally {
      // 6. PASE LO QUE PASE, liberamos la conexión a la base de datos
      client.release();
    }
  }
];


exports.verificarCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ error: 'El código no puede estar vacío.' });
    }

    const result = await pool.query('SELECT id FROM nino WHERE codigo = $1', [codigo.trim()]);

    // Si se encontró una fila, el código ya existe
    if (result.rows.length > 0) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Error al verificar el código:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};