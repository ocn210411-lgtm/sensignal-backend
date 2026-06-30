const router = require('express').Router();
const ctrl   = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

router.get('/',            auth, ctrl.mesNotifications);
router.put('/:id/lire',    auth, ctrl.marquerLue);
router.put('/tout-lire',   auth, ctrl.toutMarquerLu);

module.exports = router;
