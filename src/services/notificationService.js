const { pool } = require('../config/database');

let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

async function creerNotification({ userId, titre, message, type = 'info', signalementId = null }) {
  const [result] = await pool.query(
    'INSERT INTO notifications (user_id, titre, message, type, signalement_id) VALUES (?, ?, ?, ?, ?)',
    [userId, titre, message, type, signalementId]
  );

  if (io) {
    io.to(`user_${userId}`).emit('notification', {
      id: result.insertId,
      titre,
      message,
      type,
      signalement_id: signalementId,
      created_at: new Date()
    });
  }

  return result.insertId;
}

async function notifierChangementStatut(signalement, ancienStatut, user) {
  const messages = {
    en_cours: `Votre signalement "${signalement.titre}" est en cours de traitement.`,
    traite:   `Votre signalement "${signalement.titre}" a été résolu. Merci!`,
    rejete:   `Votre signalement "${signalement.titre}" a été rejeté.`,
    ferme:    `Votre signalement "${signalement.titre}" a été fermé.`,
  };

  const types = { en_cours: 'info', traite: 'succes', rejete: 'alerte', ferme: 'info' };
  const msg   = messages[signalement.statut];
  if (!msg) return;

  await creerNotification({
    userId:        signalement.user_id,
    titre:         'Mise à jour de votre signalement',
    message:       msg,
    type:          types[signalement.statut] || 'info',
    signalementId: signalement.id
  });
}

module.exports = { setSocketIO, creerNotification, notifierChangementStatut };
