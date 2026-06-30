require('dotenv').config();
const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const { testConnection } = require('./config/database');
const { setSocketIO }    = require('./services/notificationService');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
  // Optimisation Socket.io : compression + ping réduit
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout:  20000,
});

// ── Compression gzip — réduit la taille des réponses JSON de 70-80% ──
app.use(compression({ level: 6, threshold: 1024 }));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

// Logs concis en dev (pas de verbose qui ralentit les I/O)
app.use(morgan('tiny'));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false }));

// Fichiers statiques avec cache 7 jours
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  etag: true,
}));

// ── Middleware cache pour les GET sans auth ─────────────────────────
// Ajoute Cache-Control sur les réponses qui peuvent être mises en cache
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/admin/services')) {
    res.set('Cache-Control', 'private, max-age=30');
  } else if (req.method === 'GET' && req.path.startsWith('/api/admin/categories')) {
    res.set('Cache-Control', 'private, max-age=30');
  }
  next();
});

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/signalements',  require('./routes/signalements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stats',         require('./routes/stats'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/public',        require('./routes/public'));
app.use('/api/badges',        require('./routes/badges'));

app.get('/api/health', (_, res) => res.json({ status:'ok', app:'CivicPulse Sénégal', version:'2.0.0', time: new Date() }));

// Socket.io
setSocketIO(io);
io.on('connection', socket => {
  socket.on('authenticate', userId => {
    socket.join(`user_${userId}`);
  });
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await testConnection();
  console.log(`\n🚀 CivicPulse Sénégal v2.0 — http://localhost:${PORT}\n`);
});
