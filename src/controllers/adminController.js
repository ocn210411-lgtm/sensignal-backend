const bcrypt   = require('bcryptjs');
const { pool } = require('../config/database');
const { creerNotification } = require('../services/notificationService');

// ─── Utilisateurs ────────────────────────────────────────
const listerUtilisateurs = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const offset = (page - 1) * limit;
  const where = ['1=1'], params = [];
  if (role)   { where.push('u.role = ?');   params.push(role); }
  if (search) { where.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR u.telephone LIKE ?)'); params.push(...Array(4).fill(`%${search}%`)); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u WHERE ${where.join(' AND ')}`, params
  );
  const [rows] = await pool.query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.quartier, u.ville,
            u.role, u.is_active, u.created_at, s.nom AS service_nom, s.id AS service_id,
            (SELECT COUNT(*) FROM signalements sg WHERE sg.user_id = u.id) AS nb_signalements
     FROM users u LEFT JOIN services s ON u.service_id = s.id
     WHERE ${where.join(' AND ')}
     ORDER BY u.role, u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );
  res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
};

const creerUtilisateur = async (req, res) => {
  const { nom, prenom, email, password, telephone, quartier, ville, role, service_id } = req.body;
  if (!nom || !prenom || !email || !password || !role)
    return res.status(400).json({ message: 'Champs obligatoires manquants' });
  if (!['citoyen','agent','admin'].includes(role))
    return res.status(400).json({ message: 'Rôle invalide' });
  if (role === 'agent' && !service_id)
    return res.status(400).json({ message: 'Un agent doit être assigné à un service' });

  try {
    const [exist] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exist.length) return res.status(409).json({ message: 'Email déjà utilisé' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (nom, prenom, email, password, telephone, quartier, ville, role, service_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nom, prenom, email, hash, telephone||null, quartier||null, ville||'Dakar', role, service_id||null]
    );
    res.status(201).json({ message: 'Utilisateur créé', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const modifierUtilisateur = async (req, res) => {
  const { nom, prenom, telephone, quartier, ville, role, service_id, is_active, password } = req.body;
  const id = req.params.id;

  const updates = [];
  const params  = [];
  if (nom        !== undefined) { updates.push('nom = ?');        params.push(nom); }
  if (prenom     !== undefined) { updates.push('prenom = ?');     params.push(prenom); }
  if (telephone  !== undefined) { updates.push('telephone = ?');  params.push(telephone); }
  if (quartier   !== undefined) { updates.push('quartier = ?');   params.push(quartier); }
  if (ville      !== undefined) { updates.push('ville = ?');      params.push(ville); }
  if (role       !== undefined) { updates.push('role = ?');       params.push(role); }
  if (service_id !== undefined) { updates.push('service_id = ?'); params.push(service_id || null); }
  if (is_active  !== undefined) { updates.push('is_active = ?');  params.push(is_active); }
  if (password)                 { updates.push('password = ?');   params.push(await bcrypt.hash(password, 10)); }

  if (!updates.length) return res.status(400).json({ message: 'Aucune modification' });
  params.push(id);

  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ message: 'Utilisateur modifié' });
};

const supprimerUtilisateur = async (req, res) => {
  const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Introuvable' });
  if (rows[0].role === 'admin') return res.status(403).json({ message: 'Impossible de supprimer un admin' });
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'Utilisateur supprimé' });
};

// ─── Services ────────────────────────────────────────────
const listerServices = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, COUNT(u.id) AS nb_agents, COUNT(sg.id) AS nb_signalements
     FROM services s
     LEFT JOIN users u  ON u.service_id = s.id AND u.role = 'agent'
     LEFT JOIN signalements sg ON sg.service_id = s.id
     GROUP BY s.id ORDER BY s.nom`
  );
  res.json(rows);
};

const creerService = async (req, res) => {
  const { nom, description, email, telephone, couleur, icone } = req.body;
  if (!nom) return res.status(400).json({ message: 'Nom requis' });
  const [r] = await pool.query(
    'INSERT INTO services (nom, description, email, telephone, couleur, icone) VALUES (?,?,?,?,?,?)',
    [nom, description||null, email||null, telephone||null, couleur||'#6366F1', icone||'building']
  );
  res.status(201).json({ message: 'Service créé', id: r.insertId });
};

const modifierService = async (req, res) => {
  const { nom, description, email, telephone, couleur, icone } = req.body;
  await pool.query(
    'UPDATE services SET nom=?, description=?, email=?, telephone=?, couleur=?, icone=? WHERE id=?',
    [nom, description||null, email||null, telephone||null, couleur||'#6366F1', icone||'building', req.params.id]
  );
  res.json({ message: 'Service modifié' });
};

const supprimerService = async (req, res) => {
  await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.json({ message: 'Service supprimé' });
};

// ─── Catégories ──────────────────────────────────────────
const listerCategories = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, s.nom AS service_nom,
            COUNT(sg.id) AS nb_signalements
     FROM categories c
     LEFT JOIN services s ON c.service_id = s.id
     LEFT JOIN signalements sg ON sg.categorie_id = c.id
     GROUP BY c.id ORDER BY c.nom`
  );
  res.json(rows);
};

const creerCategorie = async (req, res) => {
  const { nom, slug, icone, couleur, service_id } = req.body;
  if (!nom || !slug) return res.status(400).json({ message: 'Nom et slug requis' });
  const [r] = await pool.query(
    'INSERT INTO categories (nom, slug, icone, couleur, service_id) VALUES (?,?,?,?,?)',
    [nom, slug, icone||'tag', couleur||'#6366F1', service_id||null]
  );
  res.status(201).json({ message: 'Catégorie créée', id: r.insertId });
};

const modifierCategorie = async (req, res) => {
  const { nom, slug, icone, couleur, service_id } = req.body;
  await pool.query(
    'UPDATE categories SET nom=?, slug=?, icone=?, couleur=?, service_id=? WHERE id=?',
    [nom, slug, icone||'tag', couleur||'#6366F1', service_id||null, req.params.id]
  );
  res.json({ message: 'Catégorie modifiée' });
};

const supprimerCategorie = async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ message: 'Catégorie supprimée' });
};

// ─── Stats globales ──────────────────────────────────────
const statsGlobales = async (req, res) => {
  const [[totaux]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(statut='en_attente') AS en_attente,
      SUM(statut='en_cours')   AS en_cours,
      SUM(statut='traite')     AS traites,
      SUM(statut='rejete')     AS rejetes,
      SUM(priorite='critique') AS critiques,
      SUM(priorite='eleve')    AS eleves,
      ROUND(SUM(statut IN ('traite','ferme'))*100.0/NULLIF(COUNT(*),0),1) AS taux_resolution
    FROM signalements
  `);
  const [[users_count]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(role='agent') AS agents, SUM(role='citoyen') AS citoyens FROM users"
  );
  const [parService] = await pool.query(`
    SELECT s.nom, s.couleur, s.icone, COUNT(sg.id) AS nb,
           SUM(sg.statut IN ('traite','ferme')) AS resolus
    FROM services s LEFT JOIN signalements sg ON sg.service_id = s.id
    GROUP BY s.id ORDER BY nb DESC
  `);
  const [parVille] = await pool.query(`
    SELECT COALESCE(ville,'Dakar') AS ville, COUNT(*) AS nb
    FROM signalements GROUP BY ville ORDER BY nb DESC LIMIT 10
  `);
  const [evolution30j] = await pool.query(`
    SELECT DATE(created_at) AS jour, COUNT(*) AS nb
    FROM signalements WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY jour ORDER BY jour
  `);
  const [parCategorie] = await pool.query(`
    SELECT c.nom, c.icone, c.couleur, COUNT(s.id) AS nb
    FROM categories c LEFT JOIN signalements s ON s.categorie_id = c.id
    GROUP BY c.id ORDER BY nb DESC
  `);
  res.json({ totaux, users_count, parService, parVille, evolution30j, parCategorie });
};

module.exports = {
  listerUtilisateurs, creerUtilisateur, modifierUtilisateur, supprimerUtilisateur,
  listerServices, creerService, modifierService, supprimerService,
  listerCategories, creerCategorie, modifierCategorie, supprimerCategorie,
  statsGlobales,
};
