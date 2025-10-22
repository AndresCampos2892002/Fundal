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
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });


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
        // 1. Obtener datos del niño (esto ya trae todas las nuevas columnas como 'docentes_asignados')
        const { rows: ninoRows } = await pool.query('SELECT * FROM nino WHERE id = $1', [id]);
        if (ninoRows.length === 0) {
            req.flash('error_msg', '❌ Expediente de niño no encontrado.');
            return res.redirect('/expedientes');
        }
        const nino = ninoRows[0]; // Guardamos el niño en una variable más clara

        // 2. Obtener datos de representantes (esto ya trae las nuevas columnas)
        const { rows: representantesRows } = await pool.query('SELECT * FROM representantes_legales WHERE nino_id = $1', [id]);

        // 3. Obtener todos los expedientes anuales
        const { rows: expedientesRows } = await pool.query('SELECT * FROM expedientes_anuales WHERE nino_id = $1 ORDER BY anio DESC', [id]);

        const anioSeleccionado = anio || (expedientesRows.length > 0 ? expedientesRows[0].anio : new Date().getFullYear());
        let expedienteDelAnio = expedientesRows.find(exp => exp.anio == anioSeleccionado) || null;

        // ✅ INICIO DE LA CORRECCIÓN
        // Si existe un expediente para el año, le "inyectamos" la información de los docentes
        // que obtuvimos en el objeto principal 'nino'.
        if (expedienteDelAnio) {
            expedienteDelAnio.docentes_asignados = nino.docentes_asignados;
        }
        // ✅ FIN DE LA CORRECCIÓN

        // 4. Obtener los documentos del checklist para el año seleccionado
        let documentosDelAnio = [];
        if (expedienteDelAnio) {
            const documentosResult = await pool.query('SELECT * FROM documentos_nino WHERE expediente_anual_id = $1 ORDER BY tipo ASC', [expedienteDelAnio.id]);
            documentosDelAnio = documentosResult.rows;
        }

        // 5. Renderizar la vista con todos los datos completos
        res.render('ver-expediente', {
            user: req.session.user,
            nino: nino,
            representantes: representantesRows,
            documentos: documentosDelAnio,
            expedientesAnuales: expedientesRows,
            expedienteDelAnio: expedienteDelAnio,
            anioSeleccionado: anioSeleccionado
            // ¡Ya no es necesario pasar los mensajes aquí!
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

exports.mostrarFormularioEditar = async (req, res) => {
  try {
    const { id } = req.params;
    // Usamos un LEFT JOIN para obtener el niño y su representante en una sola consulta
    const query = `
      SELECT n.*, r.nombre AS representante_nombre, r.dpi AS representante_dpi,
             r.estado_civil, r.parentesco AS representante_parentesco, r.telefono AS representante_telefono,
             r.direccion AS representante_direccion, r.auxiliar_nombre, r.auxiliar_telefono
      FROM nino n
      LEFT JOIN representantes_legales r ON n.id = r.nino_id
      WHERE n.id = $1
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      req.flash('error_msg', 'No se encontró el expediente para editar.');
      return res.redirect('/expedientes');
    }

    // ✅ CORRECCIÓN AQUÍ: Se pasa el objeto con la clave 'expediente'
    res.render('editar-expediente', {
      user: req.session.user,
      expediente: rows[0] // <-- ESTA LÍNEA SOLUCIONA EL ERROR
    });

  } catch (err) {
    console.error('Error al mostrar formulario de edición:', err);
    req.flash('error_msg', 'Error al cargar los datos para editar.');
    res.redirect(`/expedientes/${req.params.id}`);
  }
};

//FUNCIÓN para guardar los cambios en la BD
exports.procesarEdicion = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    // Inicia la transacción
    await client.query('BEGIN');

    // 1. Recoge todos los datos del formulario
    const {
      codigo, nombre_completo, fecha_nacimiento, edad, genero, id_partida_nacimiento,
      departamento, municipio, aldea, sede, referido_por, diagnostico, discapacidad,
      codigo_mineduc, dificultad_socioeconomica, fecha_evaluacion, fecha_ingreso_fundal, fecha_ingreso_mspas,
      representante_nombre, representante_dpi, estado_civil, representante_parentesco,
      representante_telefono, representante_direccion, auxiliar_nombre, auxiliar_telefono
    } = req.body;

    // 2. Actualiza la tabla principal 'nino'
    const ninoUpdateQuery = `
      UPDATE nino SET
        codigo = $1, nombre_completo = $2, fecha_nacimiento = $3, edad = $4, genero = $5,
        id_partida_nacimiento = $6, departamento = $7, municipio = $8, aldea = $9, sede = $10,
        referido_por = $11, diagnostico = $12, discapacidad = $13, codigo_mineduc = $14,
        dificultad_socioeconomica = $15, fecha_evaluacion = $16, fecha_ingreso_fundal = $17, fecha_ingreso_mspas = $18
      WHERE id = $19
    `;
    await client.query(ninoUpdateQuery, [
      codigo, nombre_completo, fecha_nacimiento || null, edad || null, genero, id_partida_nacimiento,
      departamento, municipio, aldea, sede, referido_por, diagnostico, discapacidad,
      codigo_mineduc, dificultad_socioeconomica, fecha_evaluacion, fecha_ingreso_fundal, fecha_ingreso_mspas, id
    ]);

    // 3. Actualiza o Inserta (UPSERT) en la tabla 'representantes_legales'
    const repUpsertQuery = `
      INSERT INTO representantes_legales (nino_id, nombre, dpi, estado_civil, parentesco, telefono, direccion, auxiliar_nombre, auxiliar_telefono)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (nino_id) DO UPDATE SET
        nombre = EXCLUDED.nombre, dpi = EXCLUDED.dpi, estado_civil = EXCLUDED.estado_civil,
        parentesco = EXCLUDED.parentesco, telefono = EXCLUDED.telefono, direccion = EXCLUDED.direccion,
        auxiliar_nombre = EXCLUDED.auxiliar_nombre, auxiliar_telefono = EXCLUDED.auxiliar_telefono
    `;
    await client.query(repUpsertQuery, [
      id, representante_nombre, representante_dpi, estado_civil, representante_parentesco,
      representante_telefono, representante_direccion, auxiliar_nombre, auxiliar_telefono
    ]);

    // Confirma la transacción si todo fue exitoso
    await client.query('COMMIT');

    // Prepara el mensaje de éxito
    req.flash('success_msg', '✅ Expediente actualizado correctamente.');

    // Guarda la sesión para asegurar que el mensaje flash persista y luego redirige
    req.session.save((err) => {
      if (err) {
        console.error('Error al guardar la sesión antes de redirigir:', err);
        return next(err); // Maneja el error si no se puede guardar la sesión
      }
      // Redirige de vuelta a la página de "Ver Expediente"
      res.redirect(`/expedientes/${id}`);
    });

  } catch (err) {
    // Si algo falla, revierte todos los cambios de la transacción
    await client.query('ROLLBACK');
    console.error('Error al actualizar expediente:', err);
    req.flash('error_msg', '❌ Error al guardar los cambios.');

    // Guarda la sesión con el mensaje de error y luego redirige
    req.session.save((saveErr) => {
        if (saveErr) {
            console.error('Error al guardar sesión en error:', saveErr);
        }
        // Si hay error, vuelve a la página de edición para que el usuario corrija
        res.redirect(`/expedientes/editar/${id}`);
    });

  } finally {
    // Libera la conexión a la base de datos, pase lo que pase
    client.release();
  }
};

// FUNCIÓN COMPLETA PARA MOSTRAR EL FORMULARIO DE REVISIÓN
exports.mostrarFormularioRevision = async (req, res) => {
  try {
    const { id } = req.params;
    // Hacemos una consulta completa para obtener todos los datos del niño y su representante
    const query = `
      SELECT n.*, r.nombre AS representante_nombre, r.dpi AS representante_dpi,
             r.estado_civil, r.parentesco AS representante_parentesco, r.telefono AS representante_telefono,
             r.direccion AS representante_direccion, r.auxiliar_nombre, r.auxiliar_telefono
      FROM nino n
      LEFT JOIN representantes_legales r ON n.id = r.nino_id
      WHERE n.id = $1
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      req.flash('error_msg', 'No se encontró el expediente.');
      return req.session.save(() => res.redirect('/expedientes'));
    }

    // Le dice al servidor que muestre la página 'revision-anual.ejs'
    res.render('revision-anual', {
      user: req.session.user,
      expediente: rows[0], // Pasamos todos los datos a la nueva vista
      anioSugerido: new Date().getFullYear() + 1 // Sugerimos el próximo año
    });
  } catch (err) {
    console.error('Error al mostrar formulario de revisión:', err);
    req.flash('error_msg', 'Error al cargar los datos para la revisión.');
    req.session.save(() => res.redirect(`/expedientes/${req.params.id}`));
  }
};


// FUNCIÓN COMPLETA PARA PROCESAR Y GUARDAR LA REVISIÓN
// En /controllers/expedientesController.js

exports.procesarRevisionAnual = [
  // Middleware para procesar la foto de perfil (puede ser opcional)
  upload.single('foto_perfil'),
  // ... (puedes añadir validaciones aquí si lo deseas)
  async (req, res) => {
    const { id } = req.params; // ID del niño
    const client = await pool.connect();
    try {
      const { anio_escolar } = req.body;

      // 1. Verificamos que no se esté creando un expediente para un año que ya existe
      const anioExistente = await client.query('SELECT id FROM expedientes_anuales WHERE nino_id = $1 AND anio = $2', [id, anio_escolar]);
      if (anioExistente.rows.length > 0) {
        req.flash('error_msg', `❌ El expediente para el año escolar ${anio_escolar} ya existe.`);
        return req.session.save(() => res.redirect(`/expedientes/${id}`));
      }

      // Si no existe, procedemos con la transacción
      await client.query('BEGIN');

      // 2. Recogemos todos los datos del formulario
      const {
        fecha_nacimiento, edad, genero, id_partida_nacimiento, departamento, municipio, aldea, sede, referido_por,
        diagnostico, discapacidad, codigo_mineduc, dificultad_socioeconomica, fecha_evaluacion, fecha_ingreso_fundal, fecha_ingreso_mspas,
        grado, programa_asignado, observaciones, docentes,
        representante_nombre, representante_dpi, estado_civil, representante_parentesco,
        representante_telefono, representante_direccion, auxiliar_nombre, auxiliar_telefono,
        documentos
      } = req.body;

      const fotoPerfilArchivo = req.file; // El archivo de la nueva foto (si existe)
      const docentesString = Array.isArray(docentes) ? docentes.join(', ') : (docentes || '');

      // 3. ACTUALIZAMOS los datos generales en la tabla 'nino' (EXCEPTO la foto por ahora)
      const ninoUpdateQuery = `
        UPDATE nino SET
          fecha_nacimiento = $1, edad = $2, genero = $3, id_partida_nacimiento = $4, departamento = $5,
          municipio = $6, aldea = $7, sede = $8, referido_por = $9, diagnostico = $10, discapacidad = $11,
          codigo_mineduc = $12, dificultad_socioeconomica = $13, fecha_evaluacion = $14,
          fecha_ingreso_fundal = $15, fecha_ingreso_mspas = $16, docentes_asignados = $17
        WHERE id = $18
      `;
      await client.query(ninoUpdateQuery, [
        fecha_nacimiento || null, edad || null, genero, id_partida_nacimiento, departamento, municipio, aldea, sede,
        referido_por, diagnostico, discapacidad, codigo_mineduc, dificultad_socioeconomica,
        fecha_evaluacion, fecha_ingreso_fundal, fecha_ingreso_mspas, docentesString, id
      ]);

      // 4. ACTUALIZAMOS los datos en la tabla 'representantes_legales'
      const repUpdateQuery = `
          UPDATE representantes_legales SET
              nombre = $1, dpi = $2, estado_civil = $3, parentesco = $4, telefono = $5, direccion = $6,
              auxiliar_nombre = $7, auxiliar_telefono = $8
          WHERE nino_id = $9
      `;
      await client.query(repUpdateQuery, [
          representante_nombre, representante_dpi || null, estado_civil || null, representante_parentesco || null,
          representante_telefono || null, representante_direccion || null, auxiliar_nombre || null, auxiliar_telefono || null, id
      ]);

      // ✅ 5. LÓGICA CORREGIDA PARA MANEJAR LA FOTO
      let fotoUrlParaNuevoExpediente;

      if (fotoPerfilArchivo) {
        // --- CASO A: Se subió una NUEVA foto ---
        fotoUrlParaNuevoExpediente = fotoPerfilArchivo.path.replace(/\\/g, '/');
        // ACTUALIZAMOS la foto principal del niño en la tabla 'nino'
        await client.query('UPDATE nino SET foto_url = $1 WHERE id = $2', [fotoUrlParaNuevoExpediente, id]);
      } else {
        // --- CASO B: NO se subió foto nueva ---
        // Buscamos la foto MÁS RECIENTE que está guardada en la tabla 'nino'
        const currentFotoResult = await client.query('SELECT foto_url FROM nino WHERE id = $1', [id]);
        fotoUrlParaNuevoExpediente = currentFotoResult.rows[0].foto_url; // Reutilizamos la foto actual
      }

      // 6. INSERTAMOS el nuevo registro en 'expedientes_anuales' CON LA FOTO CORRECTA
      const expedienteAnualQuery = `
        INSERT INTO expedientes_anuales (nino_id, anio, grado, programa_asignado, observaciones, foto_url)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
      `;
      const expedienteAnualResult = await client.query(expedienteAnualQuery, [
        id, anio_escolar, grado || null, programa_asignado || null, observaciones || null,
        fotoUrlParaNuevoExpediente // <-- Se usa la URL determinada en el paso 5
      ]);
      const expedienteAnualId = expedienteAnualResult.rows[0].id;

      // 7. INSERTAMOS el checklist de documentos para el nuevo año
      if (documentos && Array.isArray(documentos)) {
        const documentoQuery = `
          INSERT INTO documentos_nino (nino_id, expediente_anual_id, anio_expediente, tipo, confirmado)
          VALUES ($1, $2, $3, $4, $5);
        `;
        for (const doc of documentos) {
          await client.query(documentoQuery, [id, expedienteAnualId, anio_escolar, doc.tipo, !!doc.confirmado]);
        }
      }

      await client.query('COMMIT');
      req.flash('success_msg', `✅ Reinscripción para el año ${anio_escolar} guardada correctamente.`);
      req.session.save(() => res.redirect(`/expedientes/${id}/${anio_escolar}`));

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al procesar revisión anual:', err);
      req.flash('error_msg', '❌ Error al guardar la reinscripción.');
      req.session.save(() => res.redirect(`/expedientes/${id}`));
    } finally {
      client.release();
    }
  }
];

exports.upload = upload;