require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt   = require('bcryptjs');
const { pool } = require('./database');
const fs       = require('fs');
const path     = require('path');

async function seed() {
  console.log('🌱 Initialisation de la base de données CivicPulse Sénégal...\n');

  // Exécuter le schéma SQL
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../database/schema.sql'), 'utf8'
  );
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try { await pool.query(stmt); } catch {}
  }
  console.log('✅ Schéma SQL exécuté');

  // Générer le hash du mot de passe
  const hash = await bcrypt.hash('CivicPulse2026!', 10);
  console.log('✅ Mot de passe hashé');

  // Mettre à jour tous les mots de passe
  await pool.query("UPDATE users SET password = ? WHERE password = '$2a$10$placeholder'", [hash]);
  console.log('✅ Mots de passe mis à jour');

  const [users] = await pool.query('SELECT email, role FROM users ORDER BY id');
  console.log('\n👥 Comptes créés :');
  users.forEach(u => console.log(`   ${u.role.padEnd(8)} → ${u.email}`));
  console.log('\n🔑 Mot de passe : CivicPulse2026!');
  console.log('\n🚀 Base de données prête !\n');
  process.exit(0);
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
