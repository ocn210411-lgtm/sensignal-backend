const { pool } = require('../config/database');

const mesNotifications = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.*, s.numero, s.titre AS signalement_titre
     FROM notifications n
     LEFT JOIN signalements s ON n.signalement_id = s.id
     WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 30`,
    [req.user.id]
  );
  const [[{ non_lues }]] = await pool.query(
    'SELECT COUNT(*) AS non_lues FROM notifications WHERE user_id = ? AND lu = 0',
    [req.user.id]
  );
  res.json({ data: rows, non_lues });
};

const marquerLue = async (req, res) => {
  await pool.query(
    'UPDATE notifications SET lu = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Marquée comme lue' });
};

const toutMarquerLu = async (req, res) => {
  await pool.query('UPDATE notifications SET lu = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'Toutes lues' });
};

module.exports = { mesNotifications, marquerLue, toutMarquerLu };
