const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, nom, prenom, email, role, service_id, avatar FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ message: 'Utilisateur introuvable' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  next();
};

module.exports = { auth, requireRole };
