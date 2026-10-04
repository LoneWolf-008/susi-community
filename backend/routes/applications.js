import { Router } from 'express';
import * as ctrl from '../controllers/applicationsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

router.get('/mine', requireRole('talent'), ctrl.getMyApplications);
router.get('/for-need/:needId', requireRole('requester'), ctrl.getApplicationsForNeed);
router.post('/needs/:needId', requireRole('talent'), ctrl.apply);
router.patch('/:id/decide', requireRole('requester'), ctrl.decide);

export default router;