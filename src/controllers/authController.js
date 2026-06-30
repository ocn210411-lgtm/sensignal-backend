const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/database');

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

const register = async (req, res) => {
  const { nom, prenom, email, password, telephone } = req.body;
  if (!nom || !prenom || !email || !password)
    return res.status(400).json({ message: 'Champs obligatoires manquants' });

  try {
    const [exist] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exist.length) return res.status(409).json({ message: 'Email déjà utilisé' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (nom, prenom, email, password, telephone) VALUES (?, ?, ?, ?, ?)',
      [nom, prenom, email, hash, telephone || null]
    );
    const user = { id: result.insertId, nom, prenom, email, role: 'citoyen' };
    res.status(201).json({ message: 'Compte créé', token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

  try {
    const [rows] = await pool.query(
      'SELECT id, nom, prenom, email, password, role, avatar, service_id FROM users WHERE email = ? AND is_active = 1',
      [email]
    );
    if (!rows.length) return res.status(401).json({ message: 'Identifiants incorrects' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Identifiants incorrects' });

    delete user.password;
    res.json({ token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const me = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.role, u.avatar, u.created_at,
            s.nom AS service_nom
     FROM users u LEFT JOIN services s ON u.service_id = s.id
     WHERE u.id = ?`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Introuvable' });
  res.json(rows[0]);
};

const updateProfile = async (req, res) => {
  const { nom, prenom, telephone } = req.body;
  await pool.query(
    'UPDATE users SET nom = ?, prenom = ?, telephone = ? WHERE id = ?',
    [nom, prenom, telephone, req.user.id]
  );
  res.json({ message: 'Profil mis à jour' });
};

const changePassword = async (req, res) => {
  const { ancienPassword, nouveauPassword } = req.body;
  const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
  const valid = await bcrypt.compare(ancienPassword, rows[0].password);
  if (!valid) return res.status(400).json({ message: 'Ancien mot de passe incorrect' });

  const hash = await bcrypt.hash(nouveauPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Mot de passe modifié' });
};

module.exports = { register, login, me, updateProfile, changePassword };
