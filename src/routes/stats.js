const router = require('express').Router();
const ctrl   = require('../controllers/statsController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/dashboard', auth, requireRole('agent','admin'), ctrl.dashboard);

module.exports = router;
