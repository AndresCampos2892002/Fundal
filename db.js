const { Pool } = require('pg');

// DEBUG DETALLADO de todas las variables de entorno
console.log('=== RAILWAY ENV VARIABLES ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL || 'UNDEFINED');
console.log('PGHOST:', process.env.PGHOST || 'UNDEFINED');
console.log('PGUSER:', process.env.PGUSER || 'UNDEFINED');
console.log('PGDATABASE:', process.env.PGDATABASE || 'UNDEFINED');
console.log('PGPORT:', process.env.PGPORT || 'UNDEFINED');
console.log('NODE_ENV:', process.env.NODE_ENV || 'UNDEFINED');
console.log('=============================');

// Configuración que prioriza las variables de Railway
const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : process.env.PGHOST
  ? {
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      port: process.env.PGPORT,
      ssl: { rejectUnauthorized: false }
    }
  : {
      // Fallback para desarrollo local
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    };

const pool = new Pool(config);

pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL en Railway"))
  .catch(err => {
    console.error("❌ Error de conexión a PostgreSQL:");
    console.error("Configuración usada:", config);
  });

module.exports = pool;