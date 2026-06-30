const router = require('express').Router();
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');

const BADGES_DEF = {
  pionnier:         { label: '🌟 Pionnier',          desc: 'Premier signalement envoyé',           color: '#F59E0B' },
  citoyen_actif:    { label: '🏅 Citoyen actif',     desc: '5 signalements envoyés',               color: '#6366F1' },
  gardien_quartier: { label: '🥇 Gardien du quartier', desc: '20 signalements envoyés',            color: '#10B981' },
  alerte_rapide:    { label: '⚡ Alerte rapide',      desc: 'Signalement résolu en moins de 24h',  color: '#EF4444' },
  voix_citoyenne:   { label: '💬 Voix citoyenne',    desc: 'A noté la satisfaction d\'une résolution', color: '#8B5CF6' },
  signaleur_or:     { label: '🏆 Signaleur d\'or',   desc: '50 signalements envoyés',              color: '#F97316' },
};

router.get('/me', auth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT badge_slug, created_at FROM user_badges WHERE user_id=? ORDER BY created_at DESC',
    [req.user.id]
  );
  const [[stats]] = await pool.query(
    'SELECT COUNT(*) AS total FROM signalements WHERE user_id=?', [req.user.id]
  );
  const badges = rows.map(r => ({ ...BADGES_DEF[r.badge_slug], slug: r.badge_slug, obtenu_le: r.created_at }));
  res.json({ badges, total_signalements: stats.total });
});

// Vérifier et attribuer les badges automatiquement (appelé après chaque signalement)
router.post('/check', auth, async (req, res) => {
  const userId = req.user.id;
  const [[{ nb }]] = await pool.query('SELECT COUNT(*) AS nb FROM signalements WHERE user_id=?', [userId]);
  const awarded = [];
  const give = async (slug) => {
    try {
      await pool.query('INSERT IGNORE INTO user_badges (user_id,badge_slug) VALUES (?,?)', [userId, slug]);
      awarded.push(slug);
    } catch {}
  };
  if (nb >= 1)  await give('pionnier');
  if (nb >= 5)  await give('citoyen_actif');
  if (nb >= 20) await give('gardien_quartier');
  if (nb >= 50) await give('signaleur_or');
  res.json({ awarded, total: nb });
});

module.exports = router;
