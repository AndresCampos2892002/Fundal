const bcrypt = require('bcrypt');
const pool = require('../db');

// Listar todos los usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');

    const success = req.flash('success_msg');
    const error = req.flash('error_msg');

    res.render('usuarios', {
      usuarios: result.rows,
      user: req.session.user,
      success_msg: success.length > 0 ? success[0] : null,
      error_msg: error.length > 0 ? error[0] : null
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    req.flash('error_msg', '❌ Error al cargar usuarios.');
    res.redirect('/');
  }
};

// Crear usuario
exports.crearUsuario = async (req, res) => {
  const { username, email, password, rol } = req.body;

  try {
    const userExists = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userExists.rows.length > 0) {
      req.flash('error_msg', '❌ El nombre de usuario o correo ya está en uso.');
      return res.redirect('/usuarios');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query(
      'INSERT INTO users (username, email, password, rol) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, rol]
    );

    req.flash('success_msg', '✅ Usuario creado correctamente.');
    res.redirect('/usuarios');
  } catch (error) {
    console.error('Error al crear usuario:', error);
    req.flash('error_msg', '❌ Error al crear usuario.');
    res.redirect('/usuarios');
  }
};

// Eliminar usuario
exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    req.flash('success_msg', '🗑️ Usuario eliminado exitosamente.');
    res.redirect('/usuarios');
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    req.flash('error_msg', '❌ Error al eliminar usuario.');
    res.redirect('/usuarios');
  }
};

// Editar usuario
exports.editarUsuario = async (req, res) => {
  const { id } = req.params;                     // id del usuario a editar
  const { username, email, rol, adminPassword } = req.body;

  try {
    // 1) Verifica sesión y rol
    if (!req.session.user || req.session.user.rol !== 'Directivo') {
      req.flash('error_msg', '🔒 No tienes permisos para editar usuarios.');
      return res.redirect('/usuarios');
    }

    // 2) Valida que venga la contraseña del directivo
    if (!adminPassword || adminPassword.trim() === '') {
      req.flash('error_msg', '🔐 Debes ingresar tu contraseña de directivo.');
      return res.redirect('/usuarios');
    }

    // 3) Trae al directivo logueado (quien autoriza)
    const me = await pool.query('SELECT id, password FROM users WHERE id = $1', [req.session.user.id]);
    if (me.rows.length === 0) {
      req.flash('error_msg', '❌ Usuario de sesión no encontrado.');
      return res.redirect('/usuarios');
    }
    const myHash = me.rows[0].password;
    if (!myHash) {
      req.flash('error_msg', '⚠️ Tu usuario directivo no tiene contraseña configurada.');
      return res.redirect('/usuarios');
    }

    // 4) Compara la contraseña ingresada con el hash del directivo
    const ok = await bcrypt.compare(adminPassword, myHash);
    if (!ok) {
      req.flash('error_msg', '🔒 Contraseña del directivo incorrecta.');
      return res.redirect('/usuarios');
    }

    // 5) (Opcional) Evitar duplicados de username/email si cambian
    const dup = await pool.query(
      'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id <> $3',
      [username, email, id]
    );
    if (dup.rows.length > 0) {
      req.flash('error_msg', '❌ El nombre de usuario o correo ya está en uso por otro usuario.');
      return res.redirect('/usuarios');
    }

    // 6) Ejecuta el UPDATE
    await pool.query(
      'UPDATE users SET username = $1, email = $2, rol = $3 WHERE id = $4',
      [username, email, rol, id]
    );

    req.flash('success_msg', '✏️ Usuario editado correctamente.');
    res.redirect('/usuarios');

  } catch (error) {
    console.error('Error al editar usuario:', error);
    req.flash('error_msg', '❌ Error al editar usuario.');
    res.redirect('/usuarios');
  }
};
