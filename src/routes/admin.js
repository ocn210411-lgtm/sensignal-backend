const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');
const A = [auth, requireRole('admin')];

// Utilisateurs
router.get('/users',              ...A, ctrl.listerUtilisateurs);
router.post('/users',             ...A, ctrl.creerUtilisateur);
router.put('/users/:id',          ...A, ctrl.modifierUtilisateur);
router.delete('/users/:id',       ...A, ctrl.supprimerUtilisateur);

// Services
router.get('/services',           auth, ctrl.listerServices);
router.post('/services',          ...A, ctrl.creerService);
router.put('/services/:id',       ...A, ctrl.modifierService);
router.delete('/services/:id',    ...A, ctrl.supprimerService);

// Catégories
router.get('/categories',         auth, ctrl.listerCategories);
router.post('/categories',        ...A, ctrl.creerCategorie);
router.put('/categories/:id',     ...A, ctrl.modifierCategorie);
router.delete('/categories/:id',  ...A, ctrl.supprimerCategorie);

// Stats
router.get('/stats',              ...A, ctrl.statsGlobales);

module.exports = router;
