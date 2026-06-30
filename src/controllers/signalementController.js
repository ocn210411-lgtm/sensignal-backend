const { pool }                     = require('../config/database');
const { analyserSignalement, detecterDoublons } = require('../services/aiService');
const { creerNotification, notifierChangementStatut } = require('../services/notificationService');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// Calcule le SHA-256 d'un fichier — détecte la même photo exacte (0 dépendance)
function computeFileHash(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch { return null; }
}

function genNumero() {
  const d = new Date();
  return `SIG-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
}

// ─── Notifier tous les agents d'un service ───────────────
async function notifierAgentsService(serviceId, signalement) {
  if (!serviceId) return;
  const [agents] = await pool.query(
    "SELECT id FROM users WHERE service_id = ? AND role = 'agent' AND is_active = 1",
    [serviceId]
  );
  for (const agent of agents) {
    await creerNotification({
      userId:        agent.id,
      titre:         '🆕 Nouveau signalement assigné',
      message:       `Un nouveau signalement "${signalement.titre}" (priorité: ${signalement.priorite}) vient d'être affecté à votre service.`,
      type:          signalement.priorite === 'critique' ? 'alerte' : 'nouveau',
      signalementId: signalement.id,
    });
  }
}

const creer = async (req, res) => {
  const { titre, description, latitude, longitude, adresse, quartier, commune, ville } = req.body;
  if (!titre || !description) return res.status(400).json({ message: 'Titre et description requis' });

  const image_url = req.files?.image?.[0] ? `/uploads/images/${req.files.image[0].filename}` : null;
  const video_url = req.files?.video?.[0] ? `/uploads/videos/${req.files.video[0].filename}` : null;

  // ── Hash image (crypto natif — détecte la même photo exacte) ──
  let image_hash = null;
  if (req.files?.image?.[0]) {
    const imgPath = path.join(__dirname, '../../', image_url);
    image_hash = computeFileHash(imgPath);
  }

  try {
    // ── Analyse IA ─────────────────────────────────
    const ai = await analyserSignalement(titre, description);

    // ── Résoudre categorie_id et service_id ────────
    const [cats] = await pool.query("SELECT id FROM categories WHERE slug = ?", [ai.categorie.replace(/_/g,'-')]);
    const [svcs] = await pool.query("SELECT id FROM services WHERE nom = ?",    [ai.service]);

    // Fallback: chercher par mot-clé dans le nom du service
    let service_id = svcs[0]?.id || null;
    if (!service_id && ai.service) {
      const [svcs2] = await pool.query("SELECT id FROM services WHERE nom LIKE ? LIMIT 1", [`%${ai.service.split(' ')[0]}%`]);
      service_id = svcs2[0]?.id || null;
    }
    const categorie_id = cats[0]?.id || null;

    // ── Détection doublons ─────────────────────────
    let doublon_de = null;
    {
      // Priorité 0 : même hash d'image → doublon certain, instantané
      if (image_hash) {
        const [hashMatch] = await pool.query(
          `SELECT id FROM signalements WHERE image_hash = ? AND statut NOT IN ('ferme','traite') LIMIT 1`,
          [image_hash]
        );
        if (hashMatch.length) {
          doublon_de = hashMatch[0].id;
          console.log(`[Doublon] Même image détectée → sig #${doublon_de}`);
        }
      }

      let existing = [];

      if (!doublon_de && latitude && longitude) {
        // Priorité 1 : doublons géographiques (rayon ~550m)
        const [byGps] = await pool.query(
          `SELECT id, titre, adresse, latitude, longitude, created_at FROM signalements
           WHERE statut NOT IN ('ferme','traite')
             AND ABS(latitude-?) < 0.005 AND ABS(longitude-?) < 0.005
           ORDER BY created_at DESC LIMIT 8`,
          [latitude, longitude]
        );
        existing = byGps;
      }

      if (!doublon_de && !existing.length) {
        // Priorité 2 : doublons textuels — même ville, titre similaire, 30 derniers jours
        const mots = titre.split(/\s+/).slice(0, 4).filter(m => m.length > 3);
        if (mots.length) {
          const likeClause = mots.map(() => 's.titre LIKE ?').join(' OR ');
          const likeParams = mots.map(m => `%${m}%`);
          const [byText] = await pool.query(
            `SELECT id, titre, adresse, latitude, longitude, created_at FROM signalements s
             WHERE statut NOT IN ('ferme','traite')
               AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
               AND (${likeClause})
             ORDER BY created_at DESC LIMIT 8`,
            likeParams
          );
          existing = byText;
        }
      }

      if (!doublon_de && existing.length) {
        const dup = await detecterDoublons({ titre, adresse, latitude, longitude }, existing);
        if (dup.estDoublon) doublon_de = dup.doublonId;
      }
    }

    const numero = genNumero();
    const [result] = await pool.query(
      `INSERT INTO signalements
       (numero,titre,description,categorie_id,user_id,service_id,priorite,
        latitude,longitude,adresse,quartier,commune,ville,
        image_url,video_url,ai_categorie,ai_priorite,ai_confiance,ai_analyse,doublon_de,image_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [numero, titre, description, categorie_id, req.user.id, service_id, ai.priorite,
       latitude||null, longitude||null, adresse||null, quartier||null, commune||null, ville||'Dakar',
       image_url, video_url, ai.categorie, ai.priorite, ai.confiance, ai.resume, doublon_de, image_hash]
    );

    // ── Notifier les agents du bon service ─────────
    await notifierAgentsService(service_id, { id: result.insertId, titre, priorite: ai.priorite });

    // ── Notifier l'admin ───────────────────────────
    const [admins] = await pool.query("SELECT id FROM users WHERE role='admin' AND is_active=1");
    for (const admin of admins) {
      await creerNotification({
        userId: admin.id, titre: 'Nouveau signalement',
        message: `"${titre}" — priorité ${ai.priorite} — service: ${ai.service}`,
        type: 'info', signalementId: result.insertId,
      });
    }

    res.status(201).json({
      message: 'Signalement créé et transmis au service compétent',
      id: result.insertId, numero,
      ai: { categorie: ai.categorieLabel, priorite: ai.priorite, service: ai.service, confiance: ai.confiance, resume: ai.resume },
      doublon: doublon_de ? { estDoublon: true, doublonId: doublon_de } : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const lister = async (req, res) => {
  const { page = 1, limit = 12, statut, priorite, categorie, search, ville } = req.query;
  const offset = (page - 1) * limit;
  const where = ['1=1'], params = [];

  if (req.user.role === 'citoyen') { where.push('s.user_id = ?'); params.push(req.user.id); }
  else if (req.user.role === 'agent' && req.user.service_id) {
    where.push('s.service_id = ?'); params.push(req.user.service_id);
  }

  if (statut)    { where.push('s.statut = ?');   params.push(statut); }
  if (priorite)  { where.push('s.priorite = ?'); params.push(priorite); }
  if (categorie) { where.push('c.slug = ?');      params.push(categorie); }
  if (ville)     { where.push('s.ville = ?');    params.push(ville); }
  if (search)    { where.push('(s.titre LIKE ? OR s.description LIKE ? OR s.adresse LIKE ?)'); params.push(`%${search}%`,`%${search}%`,`%${search}%`); }

  const w = where.join(' AND ');
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM signalements s LEFT JOIN categories c ON s.categorie_id=c.id WHERE ${w}`, params
  );
  const [rows] = await pool.query(
    `SELECT s.id, s.numero, s.titre, s.statut, s.priorite, s.image_url,
            s.latitude, s.longitude, s.adresse, s.quartier, s.ville, s.created_at,
            s.ai_confiance, s.doublon_de, s.vues, s.votes_count,
            c.nom AS categorie, c.slug AS categorie_slug, c.icone, c.couleur,
            u.nom AS citoyen_nom, u.prenom AS citoyen_prenom,
            sv.nom AS service_nom, sv.couleur AS service_couleur
     FROM signalements s
     LEFT JOIN categories c  ON s.categorie_id = c.id
     LEFT JOIN users u       ON s.user_id = u.id
     LEFT JOIN services sv   ON s.service_id = sv.id
     WHERE ${w}
     ORDER BY FIELD(s.priorite,'critique','eleve','moyen','faible'), s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );
  res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total/limit) });
};

const detail = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, c.nom AS categorie, c.slug AS categorie_slug, c.icone, c.couleur,
            u.nom AS citoyen_nom, u.prenom AS citoyen_prenom, u.email AS citoyen_email, u.telephone AS citoyen_tel,
            sv.nom AS service_nom, sv.email AS service_email, sv.telephone AS service_tel, sv.couleur AS service_couleur
     FROM signalements s
     LEFT JOIN categories c ON s.categorie_id=c.id
     LEFT JOIN users u      ON s.user_id=u.id
     LEFT JOIN services sv  ON s.service_id=sv.id
     WHERE s.id=?`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Signalement introuvable' });

  const [commentaires] = await pool.query(
    `SELECT cm.*, u.nom, u.prenom, u.role, u.avatar
     FROM commentaires cm JOIN users u ON cm.user_id=u.id
     WHERE cm.signalement_id=? AND (cm.is_internal=0 OR ?<>'citoyen')
     ORDER BY cm.created_at ASC`, [req.params.id, req.user.role]
  );
  const [historique] = await pool.query(
    `SELECT h.*, u.nom, u.prenom FROM historique_statuts h
     LEFT JOIN users u ON h.user_id=u.id
     WHERE h.signalement_id=? ORDER BY h.created_at DESC`, [req.params.id]
  );

  await pool.query('UPDATE signalements SET vues=vues+1 WHERE id=?', [req.params.id]);
  res.json({ ...rows[0], commentaires, historique });
};

const mettreAJourStatut = async (req, res) => {
  const { statut, commentaire } = req.body;
  const valides = ['en_attente','en_cours','traite','rejete','ferme'];
  if (!valides.includes(statut)) return res.status(400).json({ message: 'Statut invalide' });

  const [rows] = await pool.query('SELECT * FROM signalements WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Introuvable' });

  const ancien = rows[0].statut;
  await pool.query('UPDATE signalements SET statut=? WHERE id=?', [statut, req.params.id]);
  await pool.query(
    'INSERT INTO historique_statuts (signalement_id,ancien_statut,nouveau_statut,commentaire,user_id) VALUES (?,?,?,?,?)',
    [req.params.id, ancien, statut, commentaire||null, req.user.id]
  );
  await notifierChangementStatut({ ...rows[0], statut }, ancien, req.user);
  res.json({ message: 'Statut mis à jour' });
};

const ajouterCommentaire = async (req, res) => {
  const { message, is_internal = false } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message vide' });
  await pool.query(
    'INSERT INTO commentaires (signalement_id,user_id,message,is_internal) VALUES (?,?,?,?)',
    [req.params.id, req.user.id, message, is_internal && req.user.role !== 'citoyen']
  );
  // Notifier le citoyen si c'est une réponse officielle
  if (req.user.role !== 'citoyen') {
    const [sig] = await pool.query('SELECT user_id, titre FROM signalements WHERE id=?', [req.params.id]);
    if (sig.length) {
      await creerNotification({
        userId: sig[0].user_id, titre: 'Réponse à votre signalement',
        message: `${req.user.prenom} ${req.user.nom} a répondu à votre signalement "${sig[0].titre}"`,
        type: 'info', signalementId: parseInt(req.params.id),
      });
    }
  }
  res.status(201).json({ message: 'Commentaire ajouté' });
};

const voter = async (req, res) => {
  try {
    await pool.query('INSERT INTO votes (signalement_id,user_id) VALUES (?,?)', [req.params.id, req.user.id]);
    await pool.query('UPDATE signalements SET votes_count=votes_count+1 WHERE id=?', [req.params.id]);
    res.json({ message: 'Vote enregistré' });
  } catch {
    await pool.query('DELETE FROM votes WHERE signalement_id=? AND user_id=?', [req.params.id, req.user.id]);
    await pool.query('UPDATE signalements SET votes_count=GREATEST(0,votes_count-1) WHERE id=?', [req.params.id]);
    res.json({ message: 'Vote retiré' });
  }
};

const supprimer = async (req, res) => {
  const [rows] = await pool.query('SELECT image_url,video_url FROM signalements WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Introuvable' });
  [rows[0].image_url, rows[0].video_url].forEach(url => {
    if (url) { const p = path.join(__dirname,'../../',url); if(fs.existsSync(p)) fs.unlinkSync(p); }
  });
  await pool.query('DELETE FROM signalements WHERE id=?', [req.params.id]);
  res.json({ message: 'Signalement supprimé' });
};

const carte = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id,s.numero,s.titre,s.statut,s.priorite,s.latitude,s.longitude,
            s.adresse,s.quartier,s.ville,s.image_url,s.created_at,s.votes_count,
            c.nom AS categorie, c.icone, c.couleur
     FROM signalements s LEFT JOIN categories c ON s.categorie_id=c.id
     WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL AND s.statut!='ferme'
     ORDER BY s.created_at DESC LIMIT 500`
  );
  res.json(rows);
};

const ajouterPhotoApres = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Photo requise' });
  const photo_apres_url = `/uploads/images/${req.file.filename}`;
  await pool.query('UPDATE signalements SET photo_apres_url=? WHERE id=?', [photo_apres_url, req.params.id]);
  // Notifier le citoyen
  const [sig] = await pool.query('SELECT user_id, titre FROM signalements WHERE id=?', [req.params.id]);
  if (sig.length) {
    await creerNotification({
      userId: sig[0].user_id,
      titre: '📸 Photo de résolution ajoutée',
      message: `Une photo "après intervention" a été ajoutée à votre signalement "${sig[0].titre}"`,
      type: 'succes', signalementId: parseInt(req.params.id),
    });
  }
  res.json({ message: 'Photo ajoutée', photo_apres_url });
};

const noterSatisfaction = async (req, res) => {
  const { note, commentaire } = req.body;
  if (!note || note < 1 || note > 5) return res.status(400).json({ message: 'Note invalide (1-5)' });
  // Vérifier que c'est le citoyen du signalement
  const [sig] = await pool.query('SELECT user_id, statut, titre FROM signalements WHERE id=?', [req.params.id]);
  if (!sig.length) return res.status(404).json({ message: 'Introuvable' });
  if (sig[0].user_id !== req.user.id) return res.status(403).json({ message: 'Non autorisé' });
  if (sig[0].statut !== 'traite') return res.status(400).json({ message: 'Le signalement doit être traité' });
  await pool.query(
    'UPDATE signalements SET satisfaction_note=?, satisfaction_commentaire=? WHERE id=?',
    [note, commentaire || null, req.params.id]
  );
  // Attribuer badge si c'est la 1ère note
  try {
    await pool.query('INSERT IGNORE INTO user_badges (user_id, badge_slug) VALUES (?,?)', [req.user.id, 'voix_citoyenne']);
  } catch {}
  res.json({ message: 'Merci pour votre avis !' });
};

module.exports = { creer, lister, detail, mettreAJourStatut, ajouterCommentaire, voter, supprimer, carte, ajouterPhotoApres, noterSatisfaction };
