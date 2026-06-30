const { pool } = require('../config/database');

const dashboard = async (req, res) => {
  try {
    const isAgent = req.user.role === 'agent';
    const serviceId = req.user.service_id;

    // For agents: filter only their service's signalements
    const whereService        = isAgent && serviceId ? 'WHERE service_id = ?'   : '';
    const whereServiceAliased = isAgent && serviceId ? 'WHERE s.service_id = ?' : '';
    const andService          = isAgent && serviceId ? 'AND service_id = ?'     : '';
    const andServiceAliased   = isAgent && serviceId ? 'AND s.service_id = ?'   : '';
    const params = isAgent && serviceId ? [serviceId] : [];

    const [[totaux]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(statut = 'en_attente') AS en_attente,
        SUM(statut = 'en_cours')   AS en_cours,
        SUM(statut = 'traite')     AS traites,
        SUM(statut = 'rejete')     AS rejetes,
        SUM(priorite = 'critique') AS critiques,
        SUM(priorite = 'eleve')    AS eleves,
        ROUND(SUM(statut IN ('traite','ferme')) * 100.0 / NULLIF(COUNT(*), 0), 1) AS taux_resolution
      FROM signalements ${whereService}
    `, params);

    const [parCategorie] = await pool.query(`
      SELECT c.nom, c.icone, c.couleur, COUNT(s.id) AS nb
      FROM categories c
      LEFT JOIN signalements s ON s.categorie_id = c.id ${isAgent && serviceId ? 'AND s.service_id = ?' : ''}
      GROUP BY c.id ORDER BY nb DESC
    `, isAgent && serviceId ? [serviceId] : []);

    const [parStatut] = await pool.query(
      `SELECT statut, COUNT(*) AS nb FROM signalements ${whereService} GROUP BY statut`,
      params
    );

    const [parPriorite] = await pool.query(
      `SELECT priorite, COUNT(*) AS nb FROM signalements ${whereService} GROUP BY priorite`,
      params
    );

    const [evolution7j] = await pool.query(`
      SELECT DATE(created_at) AS jour, COUNT(*) AS nb
      FROM signalements
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ${isAgent && serviceId ? 'AND service_id = ?' : ''}
      GROUP BY jour ORDER BY jour
    `, isAgent && serviceId ? [serviceId] : []);

    const [parService] = await pool.query(`
      SELECT sv.nom, COUNT(s.id) AS nb,
             SUM(s.statut IN ('traite','ferme')) AS resolus
      FROM services sv
      LEFT JOIN signalements s ON s.service_id = sv.id
      ${isAgent && serviceId ? 'WHERE sv.id = ?' : ''}
      GROUP BY sv.id ORDER BY nb DESC
    `, isAgent && serviceId ? [serviceId] : []);

    const [tempsTraitement] = await pool.query(`
      SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, s.created_at,
        (SELECT h.created_at FROM historique_statuts h
         WHERE h.signalement_id = s.id AND h.nouveau_statut = 'traite'
         ORDER BY h.created_at DESC LIMIT 1))), 1) AS heures_moy
      FROM signalements s WHERE s.statut = 'traite' ${andServiceAliased}
    `, params);

    const [recents] = await pool.query(`
      SELECT s.id, s.numero, s.titre, s.statut, s.priorite, s.created_at,
             c.nom AS categorie, c.icone, c.couleur,
             u.prenom AS citoyen_prenom, u.nom AS citoyen
      FROM signalements s
      LEFT JOIN categories c ON s.categorie_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      ${whereServiceAliased}
      ORDER BY s.created_at DESC LIMIT 8
    `, params);

    // Service info for agent header
    let agentService = null;
    if (isAgent && serviceId) {
      const [[svc]] = await pool.query('SELECT nom, couleur FROM services WHERE id = ?', [serviceId]);
      agentService = svc || null;
    }

    res.json({
      totaux,
      parCategorie,
      parStatut,
      parPriorite,
      evolution7j,
      parService,
      tempsTraitementMoyen: tempsTraitement[0]?.heures_moy || 0,
      recents,
      agentService,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur stats', error: err.message });
  }
};

module.exports = { dashboard };
