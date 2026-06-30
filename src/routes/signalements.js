const router = require('express').Router();
const ctrl   = require('../controllers/signalementController');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fields = upload.fields([{ name:'image',maxCount:1 },{ name:'video',maxCount:1 }]);

router.get('/carte',                      auth, ctrl.carte);
router.get('/',                           auth, ctrl.lister);
router.post('/',                    auth, fields, ctrl.creer);
router.get('/:id',                        auth, ctrl.detail);
router.put('/:id/statut', auth, requireRole('agent','admin'), ctrl.mettreAJourStatut);
router.post('/:id/commentaires',          auth, ctrl.ajouterCommentaire);
router.post('/:id/voter',                 auth, ctrl.voter);
router.delete('/:id', auth, requireRole('admin'), ctrl.supprimer);
router.post('/:id/photo-apres', auth, requireRole('agent','admin'), upload.single('photo'), ctrl.ajouterPhotoApres);
router.post('/:id/satisfaction', auth, ctrl.noterSatisfaction);

module.exports = router;
