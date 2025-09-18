const { Pool } = require('pg');

// Debug de variables
console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'EXISTE' : 'NO EXISTE');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL en Railway"))
  .catch(err => {
    console.error("❌ Error de conexión:", err.message);
    console.error("Usando DATABASE_URL:", process.env.DATABASE_URL);
  });

module.exports = pool;