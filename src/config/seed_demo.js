/**
 * seed_demo.js — Données de démonstration pour CivicPulse Sénégal
 * Lance avec : node src/config/seed_demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt   = require('bcryptjs');
const { pool } = require('./database');

async function seedDemo() {
  console.log('🌱 Insertion des données de démonstration...\n');
  const hash = await bcrypt.hash('CivicPulse2026!', 10);

  /* ── 1. UTILISATEURS ────────────────────────────── */
  await pool.query(`
    INSERT IGNORE INTO users
      (nom, prenom, email, password, telephone, quartier, ville, role, service_id) VALUES
    ('Administrateur','CivicPulse','admin@civicpulse.sn',       ?,'+221 77 000 00 01','Plateau',         'Dakar',      'admin',   NULL),
    ('Diallo',  'Moussa',  'agent.proprete@civicpulse.sn',      ?,'+221 77 000 00 02','Médina',          'Dakar',      'agent',   1),
    ('Ndiaye',  'Fatou',   'agent.voirie@civicpulse.sn',        ?,'+221 77 000 00 03','Fann',            'Dakar',      'agent',   2),
    ('Sow',  'Ibrahima',   'agent.police@civicpulse.sn',        ?,'+221 77 000 00 04','Parcelles',       'Dakar',      'agent',   5),
    ('Mbaye', 'Ousmane',   'agent.senelec@civicpulse.sn',       ?,'+221 77 000 00 05','Grand Dakar',     'Dakar',      'agent',   3),
    ('Fall',  'Aminata',   'aminata.fall@gmail.com',            ?,'+221 77 111 11 11','Yoff',            'Dakar',      'citoyen', NULL),
    ('Ba',    'Cheikh',    'cheikh.ba@gmail.com',               ?,'+221 77 222 22 22','Pikine',          'Pikine',     'citoyen', NULL),
    ('Sarr',  'Mariama',   'mariama.sarr@gmail.com',            ?,'+221 77 333 33 33','Plateau',         'Dakar',      'citoyen', NULL),
    ('Gueye', 'Moustapha', 'moustapha.gueye@gmail.com',         ?,'+221 77 444 44 44','Ouakam',          'Dakar',      'citoyen', NULL),
    ('Diouf', 'Rokhaya',   'rokhaya.diouf@gmail.com',           ?,'+221 77 555 55 55','HLM',             'Dakar',      'citoyen', NULL)
  `, Array(10).fill(hash));
  console.log('✅ 10 utilisateurs créés (5 citoyens + 4 agents + 1 admin)');

  /* ── IDs des users ──────────────────────────────── */
  const [uRows] = await pool.query('SELECT id, email FROM users ORDER BY id');
  const U = {};
  uRows.forEach(u => { U[u.email] = u.id; });
  const admin   = U['admin@civicpulse.sn'];
  const agt_pro = U['agent.proprete@civicpulse.sn'];
  const agt_voi = U['agent.voirie@civicpulse.sn'];
  const agt_pol = U['agent.police@civicpulse.sn'];
  const agt_sel = U['agent.senelec@civicpulse.sn'];
  const c1 = U['aminata.fall@gmail.com'];
  const c2 = U['cheikh.ba@gmail.com'];
  const c3 = U['mariama.sarr@gmail.com'];
  const c4 = U['moustapha.gueye@gmail.com'];
  const c5 = U['rokhaya.diouf@gmail.com'];

  /* ── 2. SIGNALEMENTS ────────────────────────────── */
  const sigs = [
    // [numero, titre, description, cat_id, user_id, svc_id, statut, priorite, lat, lng, adresse, quartier, commune, ville, ai_cat, ai_pri, ai_conf, ai_ana, vues, votes, created_at]
    ['SIG-20260601-1001','Nid de poule dangereux — Corniche Ouest',
     'Il y a un énorme nid de poule sur la Corniche Ouest au niveau de la Soumbédioune. Plusieurs motos ont failli tomber. La profondeur est d\'environ 20 cm et le diamètre fait 60 cm. Très dangereux surtout la nuit.',
     1,c1,2,'traite','eleve',14.69200000,-17.44500000,'Corniche Ouest, Soumbédioune','Médina','Dakar Plateau','Dakar',
     'route_degradee','eleve',94.50,'Route dégradée avec nid de poule dangereux nécessitant une intervention urgente.',87,12,'2026-06-01 08:30:00'],

    ['SIG-20260602-1002','Tas d\'ordures abandonné — Marché Sandaga',
     'Un tas d\'ordures ménagères s\'accumule depuis 5 jours devant l\'entrée du marché Sandaga, côté Boulevard Lamine Guèye. L\'odeur est insupportable et attire les mouches. Risque épidémique.',
     2,c2,1,'traite','eleve',14.67300000,-17.43800000,'Boulevard Lamine Guèye, Sandaga','Plateau','Dakar Plateau','Dakar',
     'dechets','eleve',97.00,'Dépôt sauvage d\'ordures ménagères constituant un risque sanitaire.',143,28,'2026-06-02 09:15:00'],

    ['SIG-20260603-1003','Lampadaires en panne — Rue 10 Médina',
     'Depuis 3 semaines, tous les lampadaires de la Rue 10 (entre Avenue Blaise Diagne et Rue 12) sont en panne. Le quartier est dans le noir total la nuit. Des agressions ont déjà eu lieu.',
     3,c3,3,'en_cours','critique',14.68100000,-17.45200000,'Rue 10 x Avenue Blaise Diagne, Médina','Médina','Médina','Dakar',
     'eclairage','critique',91.00,'Panne électrique affectant toute une rue, situation sécuritaire critique.',201,45,'2026-06-03 19:00:00'],

    ['SIG-20260604-1004','Inondation persistante — Parcelles Assainies Unité 16',
     'L\'avenue principale de l\'Unité 16 des Parcelles Assainies est inondée depuis les dernières pluies. L\'eau stagnante atteint 30 cm de profondeur. Les habitants ne peuvent plus accéder à leurs maisons en voiture.',
     4,c4,4,'en_cours','critique',14.74500000,-17.45800000,'Avenue Principale, Parcelles Assainies Unité 16','Parcelles Assainies','Guédiawaye','Dakar',
     'inondation','critique',96.00,'Inondation massive bloquant la circulation et l\'accès aux habitations.',312,67,'2026-06-04 07:00:00'],

    ['SIG-20260605-1005','Égout à ciel ouvert — Rue Moussé Diop',
     'La canalisation d\'égout s\'est rompue au niveau de la Rue Moussé Diop. Les eaux usées coulent directement dans la rue depuis 2 jours. Odeur pestilentielle et risque de contamination.',
     6,c5,4,'en_attente','critique',14.67800000,-17.44100000,'Rue Moussé Diop, Médina','Médina','Médina','Dakar',
     'assainissement','critique',93.00,'Rupture de canalisation avec déversement d\'eaux usées dans la voie publique.',89,34,'2026-06-05 11:00:00'],

    ['SIG-20260605-1006','Construction illégale bloquant la voie — Ouakam',
     'Un particulier a commencé une construction qui empiète sur la voie publique au niveau de la Route de Ngor. Des parpaings et du matériel de construction occupent la moitié de la chaussée depuis 1 semaine.',
     9,c1,6,'en_attente','eleve',14.73200000,-17.49000000,'Route de Ngor, Ouakam','Ouakam','Ouakam','Dakar',
     'construction','eleve',88.00,'Occupation illégale de la voie publique par du matériel de construction.',56,19,'2026-06-05 14:30:00'],

    ['SIG-20260606-1007','Panne d\'eau potable — HLM Grand Yoff',
     'Pas d\'eau potable dans tout le quartier HLM Grand Yoff depuis 48 heures. Les résidents sont obligés d\'acheter de l\'eau en bidon à prix exorbitant. La SDE n\'a donné aucune information.',
     11,c2,8,'en_attente','eleve',14.72000000,-17.45500000,'HLM Grand Yoff','HLM','Grand Dakar','Dakar',
     'eau_potable','eleve',90.00,'Coupure d\'eau potable affectant tout un quartier résidentiel.',178,52,'2026-06-06 06:00:00'],

    ['SIG-20260606-1008','Nuisance sonore nocturne — Yoff Village',
     'Un bar à Yoff Village fait jouer de la musique à volume très élevé jusqu\'à 4h du matin tous les weekends. Les voisins ne peuvent plus dormir. Des plaintes verbales ont été ignorées.',
     10,c3,5,'en_attente','faible',14.75800000,-17.49500000,'Yoff Village, près de la plage','Yoff','Yoff','Dakar',
     'nuisance_sonore','faible',85.00,'Nuisance sonore nocturne récurrente dans un quartier résidentiel.',34,8,'2026-06-06 10:00:00'],

    ['SIG-20260606-1009','Nid de poule Corniche Ouest (doublon)',
     'Gros trou dans la route à la Corniche, déjà signalé par quelqu\'un d\'autre.',
     1,c4,2,'rejete','moyen',14.69210000,-17.44510000,'Corniche Ouest','Médina','Dakar Plateau','Dakar',
     'route_degradee','moyen',88.00,'Signalement similaire à un incident déjà existant.',5,0,'2026-06-06 11:00:00'],

    ['SIG-20260607-1010','Route défoncée — Avenue L.S. Senghor, Thiès',
     'La section de l\'avenue Léopold Sédar Senghor entre le rond-point Médina et le marché central de Thiès est dans un état catastrophique. Des nids de poule sur toute la largeur rendent la circulation très difficile.',
     1,c5,2,'en_attente','moyen',14.79100000,-16.92600000,'Avenue L.S. Senghor, Thiès','Médina','Thiès','Thiès',
     'route_degradee','moyen',92.00,'Route gravement dégradée sur une avenue principale de Thiès.',67,23,'2026-06-07 08:00:00'],

    ['SIG-20260520-1011','Déversement d\'huile de vidange — Saint-Louis',
     'Un garage automobile déverse ses huiles usagées directement dans la canalisation pluviale de la Rue Abdel Nasser à Saint-Louis. La pollution est visible sur 50 mètres.',
     6,c1,4,'traite','eleve',16.02700000,-16.50500000,'Rue Abdel Nasser, Saint-Louis','Sor','Saint-Louis','Saint-Louis',
     'assainissement','eleve',89.00,'Pollution par huiles usagées dans le réseau d\'assainissement.',124,31,'2026-05-20 09:00:00'],

    ['SIG-20260510-1012','Éclairage éteint — Boulevard de la République',
     '4 lampadaires consécutifs sont éteints sur le Boulevard de la République entre l\'Hôtel de Ville et le Monument de la Renaissance. Signalé il y a 3 semaines.',
     3,c2,3,'ferme','moyen',14.66900000,-17.43600000,'Boulevard de la République, Plateau','Plateau','Dakar Plateau','Dakar',
     'eclairage','moyen',95.00,'Panne d\'éclairage sur un boulevard principal du centre-ville.',98,17,'2026-05-10 20:00:00'],

    ['SIG-20260607-1013','Tas de déchets non collecté — Ziguinchor',
     'Le point de collecte de déchets du marché de Boucotte à Ziguinchor n\'a pas été vidé depuis 15 jours. L\'accumulation est énorme et attire des animaux errants.',
     2,c4,1,'en_attente','eleve',12.55800000,-16.27200000,'Marché de Boucotte, Ziguinchor','Boucotte','Ziguinchor','Ziguinchor',
     'dechets','eleve',94.00,'Accumulation critique de déchets non collectés.',45,16,'2026-06-07 07:30:00'],

    ['SIG-20260606-1014','Trottoir effondré — Avenue Valdiodio Ndiaye, Kaolack',
     'Le trottoir de l\'Avenue Valdiodio Ndiaye s\'est effondré sur 8 mètres. Des passants ont failli tomber dans la cavité. Il y a une canalisation cassée en dessous qui a fragilisé la structure.',
     1,c5,2,'en_cours','critique',14.14900000,-16.07300000,'Avenue Valdiodio Ndiaye, Kaolack','Centre','Kaolack','Kaolack',
     'route_degradee','critique',96.00,'Effondrement de trottoir dû à une canalisation cassée, danger immédiat.',213,48,'2026-06-06 13:00:00'],

    ['SIG-20260613-1015','Brûlage de déchets plastiques — Cambérène',
     'Des personnes brûlent des déchets plastiques en plein air dans le terrain vague de Cambérène. La fumée noire est visible de loin et l\'odeur est toxique.',
     2,c1,1,'en_attente','moyen',14.76500000,-17.46300000,'Terrain vague de Cambérène','Cambérène','Parcelles Assainies','Dakar',
     'dechets','moyen',87.00,'Brûlage illégal de déchets plastiques causant une pollution atmosphérique.',12,5,'2026-06-13 08:00:00'],
  ];

  for (const s of sigs) {
    await pool.query(
      `INSERT IGNORE INTO signalements
       (numero,titre,description,categorie_id,user_id,service_id,statut,priorite,
        latitude,longitude,adresse,quartier,commune,ville,
        ai_categorie,ai_priorite,ai_confiance,ai_analyse,
        vues,votes_count,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      s
    );
  }

  /* ── IDs des signalements ───────────────────────── */
  const [sRows] = await pool.query('SELECT id, numero FROM signalements ORDER BY id');
  const SID = {};
  sRows.forEach(s => { SID[s.numero] = s.id; });
  const s1=SID['SIG-20260601-1001'], s2=SID['SIG-20260602-1002'],
        s3=SID['SIG-20260603-1003'], s4=SID['SIG-20260604-1004'],
        s5=SID['SIG-20260605-1005'], s7=SID['SIG-20260606-1007'],
        s9=SID['SIG-20260606-1009'], s11=SID['SIG-20260520-1011'],
        s12=SID['SIG-20260510-1012'],s14=SID['SIG-20260606-1014'];
  console.log('✅', sigs.length, 'signalements créés (Dakar, Thiès, Saint-Louis, Kaolack, Ziguinchor)');

  /* ── Doublon + photos + satisfaction ───────────── */
  await pool.query('UPDATE signalements SET doublon_de=? WHERE numero=?', [s1, 'SIG-20260606-1009']);
  await pool.query('UPDATE signalements SET photo_apres_url=? WHERE id=?', ['/uploads/images/after-route-corniche.jpg', s1]);
  await pool.query('UPDATE signalements SET photo_apres_url=? WHERE id=?', ['/uploads/images/after-dechets-sandaga.jpg', s2]);
  await pool.query('UPDATE signalements SET satisfaction_note=4, satisfaction_commentaire=? WHERE id=?',
    ['Intervention rapide, merci ! Mais la route pourrait être mieux finie.', s1]);
  console.log('✅ Doublon, photos après, satisfaction configurés');

  /* ── 3. HISTORIQUE DES STATUTS ──────────────────── */
  const histo = [
    [s1,  null,         'en_attente', 'Signalement créé par le citoyen',                           c1,       '2026-06-01 08:30:00'],
    [s1,  'en_attente', 'en_cours',   'Équipe voirie dépêchée sur place',                          agt_voi,  '2026-06-02 09:00:00'],
    [s1,  'en_cours',   'traite',     'Nid de poule comblé et asphalt refait. Photo jointe.',      agt_voi,  '2026-06-04 16:00:00'],
    [s2,  null,         'en_attente', 'Signalement créé',                                           c2,       '2026-06-02 09:15:00'],
    [s2,  'en_attente', 'en_cours',   'Camion de collecte programmé pour demain',                  agt_pro,  '2026-06-03 08:00:00'],
    [s2,  'en_cours',   'traite',     'Nettoyage effectué. Zone désinfectée.',                     agt_pro,  '2026-06-04 11:00:00'],
    [s3,  null,         'en_attente', 'Signalement créé',                                           c3,       '2026-06-03 19:00:00'],
    [s3,  'en_attente', 'en_cours',   'Techniciens SENELEC programmés pour intervention.',         agt_sel,  '2026-06-05 08:00:00'],
    [s4,  null,         'en_attente', 'Signalement créé',                                           c4,       '2026-06-04 07:00:00'],
    [s4,  'en_attente', 'en_cours',   'Pompes de relevage en route.',                              agt_pol,  '2026-06-05 10:00:00'],
    [s9,  null,         'en_attente', 'Signalement créé',                                           c4,       '2026-06-06 11:00:00'],
    [s9,  'en_attente', 'rejete',     'Doublon du signalement SIG-20260601-1001 déjà traité.',     admin,    '2026-06-06 11:30:00'],
    [s11, null,         'en_attente', 'Signalement créé',                                           c1,       '2026-05-20 09:00:00'],
    [s11, 'en_attente', 'en_cours',   'Agent ONAS contacté pour PV d\'infraction',                 agt_pol,  '2026-05-21 10:00:00'],
    [s11, 'en_cours',   'traite',     'PV dressé, garage mis en demeure. Canalisation nettoyée.', agt_pol,  '2026-05-25 14:00:00'],
    [s12, null,         'en_attente', 'Signalement créé',                                           c2,       '2026-05-10 20:00:00'],
    [s12, 'en_attente', 'en_cours',   'Ordre de travaux SENELEC émis',                             agt_sel,  '2026-05-12 09:00:00'],
    [s12, 'en_cours',   'traite',     'Lampadaires réparés',                                       agt_sel,  '2026-05-20 15:00:00'],
    [s12, 'traite',     'ferme',      'Dossier clôturé après 30 jours sans réclamation',           admin,    '2026-06-19 00:00:00'],
    [s14, null,         'en_attente', 'Signalement créé',                                           c5,       '2026-06-06 13:00:00'],
    [s14, 'en_attente', 'en_cours',   'Travaux d\'urgence déclenchés. Périmètre sécurisé.',       agt_voi,  '2026-06-07 08:00:00'],
  ];
  for (const h of histo) {
    await pool.query(
      'INSERT INTO historique_statuts (signalement_id,ancien_statut,nouveau_statut,commentaire,user_id,created_at) VALUES (?,?,?,?,?,?)', h
    );
  }
  console.log('✅', histo.length, 'entrées d\'historique créées');

  /* ── 4. COMMENTAIRES ────────────────────────────── */
  const comments = [
    [s1, c2,     'J\'ai failli tomber avec ma moto hier soir à cause de ce trou !',              false, '2026-06-01 10:00:00'],
    [s1, c3,     'Pareil, ce nid de poule est vraiment dangereux. Merci d\'avoir signalé.',       false, '2026-06-01 12:30:00'],
    [s1, agt_voi,'Nous avons pris en compte votre signalement. Intervention prévue demain matin.',false, '2026-06-02 09:05:00'],
    [s1, c4,     'Super, merci pour la réactivité ! 👍',                                          false, '2026-06-02 11:00:00'],
    [s1, agt_voi,'[INTERNE] Matériaux commandés — bon de commande BC-2026-0412',                  true,  '2026-06-02 09:30:00'],
    [s1, c1,     'Réparation effectuée, super travail de la Direction des Travaux Publics !',     false, '2026-06-04 18:00:00'],
    [s2, c1,     'La situation empire de jour en jour, c\'est urgent !',                          false, '2026-06-02 11:00:00'],
    [s2, c4,     'Je confirme, l\'odeur est insupportable, on ne peut plus aller au marché.',     false, '2026-06-02 14:00:00'],
    [s2, agt_pro,'Camion programmé pour demain 7h. Merci pour votre signalement.',               false, '2026-06-03 08:05:00'],
    [s2, agt_pro,'[INTERNE] Prévoir désinfection — risque épidémique confirmé.',                  true,  '2026-06-03 08:10:00'],
    [s3, c1,     'Mon enfant a été agressé dans cette rue la semaine dernière à cause du noir.',  false, '2026-06-03 20:00:00'],
    [s3, c2,     'Nous sommes obligés d\'éclairer avec nos téléphones. C\'est dangereux !',       false, '2026-06-04 08:00:00'],
    [s3, agt_sel,'Dossier transmis à SENELEC ce matin. Intervention sous 48h.',                   false, '2026-06-05 08:15:00'],
    [s4, c1,     'L\'eau est montée encore cette nuit. On ne peut plus sortir.',                  false, '2026-06-04 08:00:00'],
    [s4, c5,     'Même problème chez nous à l\'Unité 17 !',                                       false, '2026-06-04 09:00:00'],
    [s4, c3,     'Des enfants jouent dans cette eau stagnante, risque de maladies !',             false, '2026-06-04 10:00:00'],
    [s4, agt_pol,'L\'ONAS a déployé 2 pompes ce matin. Travaux estimés à 6h.',                  false, '2026-06-05 10:15:00'],
    [s5, c2,     'L\'odeur est insupportable ! Pas possible de rester dans la rue.',              false, '2026-06-05 12:00:00'],
    [s5, c3,     'Je passe par cette rue tous les jours pour aller au travail. Catastrophique.',  false, '2026-06-05 13:00:00'],
    [s7, c5,     'Voilà 2 jours qu\'on n\'a pas d\'eau. Les enfants souffrent de la chaleur.',   false, '2026-06-06 07:00:00'],
    [s7, c1,     'On achète des bidons à 1500 FCFA chacun. C\'est inacceptable.',                false, '2026-06-06 09:00:00'],
    [s7, c4,     'La SDE doit s\'expliquer ! On paye nos factures régulièrement.',               false, '2026-06-06 11:00:00'],
    [s14,c5,     'J\'ai vu une dame tomber dans le trou ce matin. C\'est très dangereux !',      false, '2026-06-06 14:00:00'],
    [s14,agt_voi,'Périmètre sécurisé avec des barrières. Travaux de nuit prévus.',               false, '2026-06-07 08:15:00'],
  ];
  for (const c of comments) {
    await pool.query(
      'INSERT INTO commentaires (signalement_id,user_id,message,is_internal,created_at) VALUES (?,?,?,?,?)', c
    );
  }
  console.log('✅', comments.length, 'commentaires créés');

  /* ── 5. VOTES ───────────────────────────────────── */
  const voteData = [
    [s1,c2],[s1,c3],[s1,c4],[s1,c5],[s1,agt_pro],[s1,agt_voi],[s1,agt_pol],[s1,admin],
    [s2,c1],[s2,c4],[s2,c3],[s2,c5],[s2,agt_pro],[s2,agt_pol],[s2,agt_sel],[s2,admin],
    [s3,c1],[s3,c2],[s3,c4],[s3,c5],[s3,agt_pro],[s3,agt_pol],
    [s4,c2],[s4,c3],[s4,c1],[s4,c5],[s4,agt_pro],[s4,agt_voi],
    [s5,c2],[s5,c3],[s5,c1],[s5,c4],
    [s7,c5],[s7,c1],[s7,c4],[s7,c3],
    [s14,c5],[s14,c1],[s14,c2],[s14,c3],
  ];
  for (const [sig, usr] of voteData) {
    await pool.query(
      'INSERT IGNORE INTO votes (signalement_id,user_id) VALUES (?,?)', [sig, usr]
    );
  }
  console.log('✅', voteData.length, 'votes créés');

  /* ── 6. NOTIFICATIONS ───────────────────────────── */
  const notifs = [
    [c1,  '✅ Signalement traité',      `Votre signalement "Nid de poule — Corniche Ouest" a été résolu !`,         'succes', true,  s1,  '2026-06-04 16:05:00'],
    [c1,  '🔄 En cours de traitement', `Votre signalement "Nid de poule — Corniche Ouest" est pris en charge.`,    'info',   true,  s1,  '2026-06-02 09:05:00'],
    [c1,  '🏅 Badge débloqué !',        `Félicitations ! Vous avez obtenu le badge "Premier Signalement" 🌟`,       'succes', true,  null,'2026-06-01 08:35:00'],
    [c2,  '✅ Signalement traité',      `Votre signalement "Tas d'ordures — Sandaga" a été résolu !`,               'succes', true,  s2,  '2026-06-04 11:05:00'],
    [c2,  '🏅 Badge débloqué !',        `Félicitations ! Badge "Premier Signalement" obtenu 🌟`,                   'succes', true,  null,'2026-06-02 09:20:00'],
    [c3,  '🔄 En cours de traitement', `Votre signalement "Lampadaires — Rue 10" est pris en charge.`,              'info',   true,  s3,  '2026-06-05 08:05:00'],
    [c4,  '❌ Signalement rejeté',      `Votre signalement est un doublon de SIG-20260601-1001 déjà traité.`,       'alerte', true,  s9,  '2026-06-06 11:35:00'],
    [agt_pro,'🆕 Nouveau signalement',  `"Tas d'ordures — Sandaga" affecté à votre service (priorité: élevée)`,    'nouveau',true,  s2,  '2026-06-02 09:16:00'],
    [agt_voi,'🆕 Nouveau signalement',  `"Nid de poule — Corniche Ouest" affecté à votre service (élevée)`,        'nouveau',true,  s1,  '2026-06-01 08:31:00'],
    [agt_sel,'🚨 CRITIQUE !',           `"Lampadaires en panne — Rue 10" affecté à SENELEC — CRITIQUE`,            'alerte', true,  s3,  '2026-06-03 19:01:00'],
    [agt_pol,'🚨 CRITIQUE !',           `"Inondation — Parcelles Assainies" — intervention urgente requise`,        'alerte', false, s4,  '2026-06-04 07:01:00'],
    [agt_pol,'🚨 CRITIQUE !',           `"Égout à ciel ouvert — Rue Moussé Diop" — CRITIQUE`,                      'alerte', false, s5,  '2026-06-05 11:01:00'],
  ];
  for (const n of notifs) {
    await pool.query(
      'INSERT INTO notifications (user_id,titre,message,type,lu,signalement_id,created_at) VALUES (?,?,?,?,?,?,?)', n
    );
  }
  console.log('✅', notifs.length, 'notifications créées');

  /* ── 7. BADGES ──────────────────────────────────── */
  const userBadges = [
    [c1, 'premier_signalement', '2026-06-01 08:35:00'],
    [c1, 'citoyen_actif',       '2026-06-05 14:00:00'],
    [c1, 'probleme_resolu',     '2026-06-04 16:10:00'],
    [c1, 'satisfait',           '2026-06-04 18:05:00'],
    [c2, 'premier_signalement', '2026-06-02 09:20:00'],
    [c2, 'probleme_resolu',     '2026-06-04 11:10:00'],
    [c3, 'premier_signalement', '2026-06-03 19:05:00'],
    [c4, 'premier_signalement', '2026-06-04 07:05:00'],
    [c5, 'premier_signalement', '2026-06-05 11:05:00'],
  ];
  for (const b of userBadges) {
    await pool.query(
      'INSERT IGNORE INTO user_badges (user_id,badge_slug,created_at) VALUES (?,?,?)', b
    );
  }
  console.log('✅', userBadges.length, 'badges attribués');

  /* ── RÉSUMÉ FINAL ───────────────────────────────── */
  const tables = ['users','signalements','commentaires','votes','notifications','badges','user_badges','historique_statuts'];
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   BASE CIVICPULSE — ÉTAT FINAL       ║');
  console.log('╠══════════════════════════════════════╣');
  for (const t of tables) {
    const [[{n}]] = await pool.query(`SELECT COUNT(*) as n FROM ${t}`);
    console.log(`║  ${t.padEnd(25)} : ${String(n).padStart(3)}   ║`);
  }
  console.log('╠══════════════════════════════════════╣');
  console.log('║  🔑 Mot de passe : CivicPulse2026!   ║');
  console.log('╚══════════════════════════════════════╝\n');
  process.exit(0);
}

seedDemo().catch(e => { console.error('❌', e.message); process.exit(1); });
