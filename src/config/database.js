const { Pool } = require('pg');
require('dotenv').config();

// Connexion PostgreSQL (Render)
const pgPool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT) || 5432,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
);

// ─── Wrapper mysql2-compatible ───────────────────────────────────────────────
// Convertit les ? en $1 $2 $3 et retourne [rows] comme mysql2
function toPostgresParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const pool = {
  // pool.execute(sql, params) → [rows]
  execute: async (sql, params = []) => {
    const pgSql = toPostgresParams(sql);
    const result = await pgPool.query(pgSql, params);
    // Simule insertId via RETURNING id (ajouté automatiquement sur les INSERT)
    const insertId = result.rows[0]?.id ?? null;
    return [result.rows, { insertId }];
  },

  // pool.query(sql, params) → [rows]
  query: async (sql, params = []) => {
    const pgSql = toPostgresParams(sql);
    const result = await pgPool.query(pgSql, params);
    const insertId = result.rows[0]?.id ?? null;
    return [result.rows, { insertId }];
  },

  // pool.getConnection() pour testConnection
  getConnection: async () => {
    const client = await pgPool.connect();
    return { release: () => client.release() };
  }
};

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ PostgreSQL connecté — Base: ' + (process.env.DB_NAME || 'Render'));
    conn.release();
  } catch (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
