const { Pool } = require('pg');

console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'EXISTE' : 'NO EXISTE');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

// Configuración CORRECTA para SSL de Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // ← Esto es IMPORTANTE
    require: true
  }
});

pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL en Railway"))
  .catch(err => {
    console.error("❌ Error de conexión:");
    console.error(" - Mensaje:", err.message);
    console.error(" - SSL Config:", pool.options.ssl);
  });

module.exports = pool;