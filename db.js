const { Pool } = require('pg');

// DEBUG: Ver qué variables está recibiendo
console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'EXISTE' : 'NO EXISTE');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL en Railway"))
  .catch(err => {
    console.error("❌ Error de conexión a PostgreSQL:");
    console.error(" - DATABASE_URL:", process.env.DATABASE_URL);
    console.error(" - Error details:", err.message);
  });

module.exports = pool;