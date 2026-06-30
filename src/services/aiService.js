const axios = require('axios');

const GROQ_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const API_KEY  = process.env.GROQ_API_KEY;

// Modèles Groq disponibles
const MODEL_TEXT   = 'llama-3.3-70b-versatile';     // texte — ultra-rapide
const MODEL_VISION = 'llama-3.2-11b-vision-preview'; // images — vision gratuite

const CATEGORIES = {
  'route_degradee':  { label: 'Route dégradée',         service: 'Voirie',              priorite_defaut: 'moyen' },
  'dechets':         { label: 'Déchets',                 service: 'Service Propreté',    priorite_defaut: 'faible' },
  'eclairage':       { label: 'Éclairage public',        service: 'Électricité',         priorite_defaut: 'moyen' },
  'inondation':      { label: 'Inondation',              service: 'Assainissement',      priorite_defaut: 'eleve' },
  'incendie':        { label: 'Incendie',                service: 'Services Techniques', priorite_defaut: 'critique' },
  'assainissement':  { label: 'Assainissement',          service: 'Assainissement',      priorite_defaut: 'moyen' },
  'accident':        { label: 'Accident',                service: 'Police Municipale',   priorite_defaut: 'critique' },
  'nuisance_sonore': { label: 'Nuisance sonore',         service: 'Police Municipale',   priorite_defaut: 'faible' },
  'construction':    { label: 'Construction dangereuse', service: 'Services Techniques', priorite_defaut: 'eleve' },
};

async function callGroq(messages, model = MODEL_TEXT) {
  const { data } = await axios.post(`${GROQ_URL}/chat/completions`, {
    model,
    messages,
    temperature: 0.1,
    max_tokens:  512,
  }, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });
  return data.choices[0].message.content;
}

// ─── Classification texte ────────────────────────────────
async function analyserSignalement(titre, description) {
  if (!API_KEY) return fallbackAnalyse(titre, description);

  const prompt = `Tu es un système d'analyse d'incidents urbains pour une mairie sénégalaise (Dakar, Thiès, Saint-Louis…).

Analyse ce signalement citoyen. Choisis la catégorie la plus adaptée parmi celles-ci :
- route_degradee : nid de poule, route barrée, route bloquée, trottoir cassé, chaussée dégradée
- dechets        : ordures, déchets, poubelle, saletés, tas d'ordures
- eclairage      : lampadaire en panne, éclairage défaillant, rue sombre
- inondation     : eau stagnante, inondation, mare, égout bouché qui déborde
- incendie       : feu, flamme, incendie, fumée
- assainissement : égout ouvert, canalisation cassée, odeur nauséabonde
- accident       : collision, accident de voiture, blessé sur voie publique
- nuisance_sonore: bruit excessif, tapage nocturne, musique trop forte
- construction   : chantier dangereux, bâtiment menaçant, effondrement

Retourne UNIQUEMENT ce JSON valide, sans texte autour :
{
  "categorie": "<exactement une des 9 valeurs ci-dessus>",
  "priorite": "<faible|moyen|eleve|critique>",
  "confiance": <0-100>,
  "resume": "<1 phrase courte décrivant l'incident>"
}

Titre: "${titre}"
Description: "${description}"`;

  try {
    const raw  = await callGroq([{ role: 'user', content: prompt }]);
    const json = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());

    // Valider que la catégorie retournée est bien dans notre liste
    const categorie = CATEGORIES[json.categorie] ? json.categorie : fallbackCategorie(titre, description);
    const cat       = CATEGORIES[categorie];

    return {
      categorie,
      categorieLabel: cat.label,
      priorite:       json.priorite || cat.priorite_defaut,
      service:        cat.service,   // ← toujours dérivé de la catégorie, jamais inventé par l'IA
      confiance:      json.confiance || 75,
      resume:         json.resume    || '',
    };
  } catch (err) {
    console.error('Groq analyse error:', err.message);
    return fallbackAnalyse(titre, description);
  }
}

// ─── Analyse d'image (vision) ────────────────────────────
async function analyserImage(imageBase64, mimeType = 'image/jpeg') {
  if (!API_KEY) return { detecte: 'inconnu', confiance: 0, description: 'IA non configurée' };

  const prompt = `Analyse cette image d'un incident urbain. Identifie le type de problème visible.
Retourne UNIQUEMENT ce JSON:
{ "detecte": "<type: dechets|route_degradee|inondation|incendie|accident|eclairage|construction|autre>", "confiance": <0-100>, "description": "<description courte>" }`;

  try {
    const raw = await callGroq([{
      role: 'user',
      content: [
        { type: 'text',      text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
      ]
    }], MODEL_VISION);

    return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    return { detecte: 'inconnu', confiance: 0, description: 'Analyse image échouée' };
  }
}

// ─── Détection de doublons ───────────────────────────────
async function detecterDoublons(newSig, existants) {
  if (!existants.length || !API_KEY) return { estDoublon: false, doublonId: null, similarite: 0 };

  const liste = existants.slice(0, 8).map(s =>
    `ID:${s.id} | "${s.titre}" | ${s.adresse || 'sans adresse'}`
  ).join('\n');

  const prompt = `Est-ce que ce nouveau signalement est un doublon d'un des signalements existants dans la même zone?

NOUVEAU: "${newSig.titre}" à "${newSig.adresse || 'coords: ' + newSig.latitude + ',' + newSig.longitude}"

EXISTANTS PROCHES:
${liste}

Retourne UNIQUEMENT ce JSON:
{ "estDoublon": <true|false>, "doublonId": <id ou null>, "similarite": <0-100> }`;

  try {
    const raw = await callGroq([{ role: 'user', content: prompt }]);
    const res = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return {
      estDoublon: res.estDoublon || false,
      doublonId:  res.doublonId  || null,
      similarite: res.similarite || 0,
    };
  } catch {
    return { estDoublon: false, doublonId: null, similarite: 0 };
  }
}

// ─── Détection de catégorie par mots-clés ────────────────
function fallbackCategorie(titre, description) {
  const text = `${titre} ${description}`.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // retire les accents pour comparer

  if (text.match(/route|nid.?de.?poule|trottoir|chaussee|asphalte|barre|bloque|barricade|obstacle|impraticable/))
    return 'route_degradee';
  if (text.match(/lampadaire|eclairage|lumiere|panne.?elec|rue.?sombre|obscurite/))
    return 'eclairage';
  if (text.match(/inondation|eau.?stagnante|mare|deborde|pluviale/))
    return 'inondation';
  if (text.match(/egout|canalisation|odeur|nauseabond|assainissement/))
    return 'assainissement';
  if (text.match(/feu|incendie|flamme|fumee|brule/))
    return 'incendie';
  if (text.match(/accident|collision|blesse|renverse|choc/))
    return 'accident';
  if (text.match(/bruit|tapage|musique|sono|voisin.?bruit/))
    return 'nuisance_sonore';
  if (text.match(/chantier|construction|batiment|effondrement|dangereux/))
    return 'construction';
  if (text.match(/ordure|dechet|poubelle|salet|tas|decharge/))
    return 'dechets';
  return 'dechets';
}

// ─── Fallback sans IA ────────────────────────────────────
function fallbackAnalyse(titre, description) {
  const categorie = fallbackCategorie(titre, description);
  const cat = CATEGORIES[categorie];
  return { categorie, categorieLabel: cat.label, priorite: cat.priorite_defaut, service: cat.service, confiance: 60, resume: '' };
}

module.exports = { analyserSignalement, analyserImage, detecterDoublons };
