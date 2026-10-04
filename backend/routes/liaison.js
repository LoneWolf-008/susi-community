import { Router } from 'express';
import * as ctrl from '../controllers/liaisonController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate, requireRole('liaison'));

router.get('/visits', ctrl.getVisits);
router.get('/visits/:id', ctrl.getVisitById);
router.post('/visits', ctrl.createVisit);
router.patch('/visits/:id', ctrl.updateVisit);
router.post('/visits/:id/start', ctrl.startVisit);
router.post('/visits/:id/finish', ctrl.finishVisit);

export default router;