const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL en Railway"))
  .catch(err => console.error("❌ Error de conexión a PostgreSQL:", err));

module.exports = pool;
