const { pool }  = require('../config/database');
const bcrypt    = require('bcryptjs');

const listerUtilisateurs = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const offset = (page - 1) * limit;
  let where = ['1=1'], params = [];

  if (role)   { where.push('role = ?'); params.push(role); }
  if (search) { where.push('(nom LIKE ? OR prenom LIKE ? OR email LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const whereStr = where.join(' AND ');
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE ${whereStr}`, params);
  const [rows] = await pool.query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.role, u.is_active, u.created_at,
            s.nom AS service_nom,
            COUNT(sig.id) AS nb_signalements
     FROM users u
     LEFT JOIN services s ON u.service_id = s.id
     LEFT JOIN signalements sig ON sig.user_id = u.id
     WHERE ${whereStr}
     GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );
  res.json({ data: rows, total, page: parseInt(page) });
};

const toggleActif = async (req, res) => {
  const [rows] = await pool.query('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Introuvable' });
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [!rows[0].is_active, req.params.id]);
  res.json({ message: 'Statut modifié', is_active: !rows[0].is_active });
};

const modifierRole = async (req, res) => {
  const { role } = req.body;
  if (!['citoyen','agent','admin'].includes(role)) return res.status(400).json({ message: 'Rôle invalide' });
  await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  res.json({ message: 'Rôle modifié' });
};

const listerServices = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM services ORDER BY nom');
  res.json(rows);
};

const listerCategories = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, s.nom AS service_nom FROM categories c
     LEFT JOIN services s ON c.service_id = s.id ORDER BY c.nom`
  );
  res.json(rows);
};

module.exports = { listerUtilisateurs, toggleActif, modifierRole, listerServices, listerCategories };
