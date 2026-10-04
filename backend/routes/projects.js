import { Router } from 'express';
import * as ctrl from '../controllers/projectsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

router.get('/mine', ctrl.getMyProjects);
router.get('/:id', ctrl.getProjectById);
router.patch('/:id/agree', requireRole('talent'), ctrl.agreeProject);
router.post('/:id/deliveries', requireRole('talent'), ctrl.submitDelivery);
router.post('/:id/verify', requireRole('requester'), ctrl.verifyProject);
router.post('/:id/revisions', requireRole('requester'), ctrl.requestRevision);
router.post('/:id/dispute', ctrl.openDispute);

export default router;