const pool = require('../db');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

// --- Configuración de Multer para la subida de archivos ---
// El destino de los archivos y cómo se nombran.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Asegúrate de que esta carpeta exista en tu proyecto.
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    // Crea un nombre de archivo único para evitar colisiones.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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

const ninoValidator = [
  body('nombre_completo').notEmpty().withMessage('El nombre completo del niño es requerido.'),
  body('codigo').notEmpty().withMessage('El código del niño es requerido.').isAlphanumeric().withMessage('El código debe ser alfanumérico.'),
  body('fecha_nacimiento').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('La fecha de nacimiento no es válida.'),
  body('edad').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('La edad debe ser un número válido.'),
  // La validación de los documentos la haremos en la lógica del controlador.
];

// ----------------------------------------------------
// -- FUNCIONES DEL CONTROLADOR
// ----------------------------------------------------

exports.mostrarFormulario = [
  ensureSession,
  checkEditPermission,
  async (req, res) => {
    try {
      res.render('crear-nino', {
        user: req.session.user,
        success_msg: req.flash('success_msg')[0] || null,
        error_msg: req.flash('error_msg')[0] || null
      });
    } catch (err) {
      console.error('Error al cargar formulario de niño:', err);
      req.flash('error_msg', '❌ Error al cargar el formulario.');
      res.redirect('/postulaciones');
    }
}];

// La función 'crearNino' ahora usa 'multer' como middleware
exports.crearNino = [
  ensureSession,
  checkEditPermission,
  upload.fields([ // Usamos 'fields' para manejar múltiples archivos
    { name: 'documento_archivo[]', maxCount: 10 }
  ]),
  ...ninoValidator,
  async (req, res) => {
    // Los datos de texto están en req.body, y los archivos en req.files
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('; '));
      return res.redirect('/crear-nino');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por,
        representante_nombre, representante_dpi, representante_parentesco, representante_telefono, representante_direccion,
        documento_tipo
      } = req.body;

      const documentosArchivos = req.files['documento_archivo[]'] || [];

      // 1. Insertar en la tabla 'nino'
      const ninoQ = `
        INSERT INTO nino (codigo, nombre_completo, fecha_nacimiento, edad, diagnostico, referido_por, fecha_creacion)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id;
      `;
      const ninoResult = await client.query(ninoQ, [
        codigo,
        nombre_completo,
        fecha_nacimiento || null,
        edad || null,
        diagnostico || null,
        referido_por || null,
      ]);
      const ninoId = ninoResult.rows[0].id;

      // 2. Insertar en la tabla 'representantes_legales'
      if (representante_nombre) {
        const representanteQ = `
          INSERT INTO representantes_legales (nino_id, nombre, dpi, parentesco, telefono, direccion)
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
        await client.query(representanteQ, [
          ninoId,
          representante_nombre,
          representante_dpi || null,
          representante_parentesco || null,
          representante_telefono || null,
          representante_direccion || null,
        ]);
      }

      // 3. Insertar documentos (ahora en un loop)
      if (documentosArchivos.length > 0) {
        for (let i = 0; i < documentosArchivos.length; i++) {
          const documentoQ = `
            INSERT INTO documentos_nino (nino_id, tipo, archivo, confirmado, fecha_subida)
            VALUES ($1, $2, $3, false, NOW());
          `;
          await client.query(documentoQ, [
            ninoId,
            documento_tipo[i],
            documentosArchivos[i].path
          ]);
        }
      }

      await client.query('COMMIT');
      req.flash('success_msg', '✅ Expediente de niño creado con éxito.');
      res.redirect('/expedientes');

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al crear niño:', err);
      req.flash('error_msg', '❌ Error al crear el expediente del niño.');
      res.redirect('/crear-nino');
    } finally {
      client.release();
    }
}];

// Exportamos los middlewares para que las rutas puedan usarlos
exports.ensureSession = ensureSession;
exports.checkEditPermission = checkEditPermission;
