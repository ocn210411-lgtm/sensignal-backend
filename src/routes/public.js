const router = require('express').Router();
const { pool } = require('../config/database');

// Stats publiques — sans authentification
router.get('/stats', async (req, res) => {
  try {
    const [[totaux]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(statut IN ('traite','ferme')) AS resolus,
        SUM(statut = 'en_cours') AS en_cours,
        SUM(statut = 'en_attente') AS en_attente,
        ROUND(SUM(statut IN ('traite','ferme')) * 100.0 / NULLIF(COUNT(*),0),1) AS taux_resolution,
        ROUND(AVG(votes_count),1) AS votes_moy
      FROM signalements
    `);
    const [parVille] = await pool.query(`
      SELECT ville, COUNT(*) AS nb, SUM(statut IN ('traite','ferme')) AS resolus
      FROM signalements WHERE ville IS NOT NULL AND ville != ''
      GROUP BY ville ORDER BY nb DESC LIMIT 8
    `);
    const [parCategorie] = await pool.query(`
      SELECT c.nom, c.icone, c.couleur, COUNT(s.id) AS nb
      FROM categories c LEFT JOIN signalements s ON s.categorie_id=c.id
      GROUP BY c.id ORDER BY nb DESC LIMIT 8
    `);
    const [evolution30j] = await pool.query(`
      SELECT DATE(created_at) AS jour, COUNT(*) AS nb
      FROM signalements WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY jour ORDER BY jour
    `);
    const [topSignalements] = await pool.query(`
      SELECT s.id, s.titre, s.statut, s.priorite, s.votes_count, s.ville, s.created_at,
             c.nom AS categorie, c.icone, c.couleur
      FROM signalements s LEFT JOIN categories c ON s.categorie_id=c.id
      WHERE s.statut != 'ferme'
      ORDER BY s.votes_count DESC, s.created_at DESC LIMIT 5
    `);
    const [[nbCitoyens]] = await pool.query(`SELECT COUNT(*) AS nb FROM users WHERE role='citoyen'`);
    const [[nbServices]] = await pool.query(`SELECT COUNT(*) AS nb FROM services`);
    res.json({ totaux, parVille, parCategorie, evolution30j, topSignalements, nbCitoyens: nbCitoyens.nb, nbServices: nbServices.nb });
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
});

module.exports = router;
