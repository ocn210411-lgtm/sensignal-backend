const router = require('express').Router();
const ctrl   = require('../controllers/userController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/',              auth, requireRole('admin'),        ctrl.listerUtilisateurs);
router.put('/:id/toggle',    auth, requireRole('admin'),        ctrl.toggleActif);
router.put('/:id/role',      auth, requireRole('admin'),        ctrl.modifierRole);
router.get('/services',      auth,                              ctrl.listerServices);
router.get('/categories',    auth,                              ctrl.listerCategories);

module.exports = router;
