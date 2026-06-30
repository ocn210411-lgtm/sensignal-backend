const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT),
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           'local'
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL MAMP connecté — Base: ' + process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ Erreur connexion MySQL:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
