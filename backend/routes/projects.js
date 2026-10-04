import { Router } from 'express';
import * as ctrl from '../controllers/projectsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import {
  deliverySchema, verifySchema, revisionSchema, openDisputeSchema, disputeStatementSchema, cancelProjectSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mine', ctrl.getMyProjects);
router.get('/:id', ctrl.getProjectById);
router.get('/:id/dispute', ctrl.getProjectDispute);
router.patch('/:id/agree', requireRole('talent'), ctrl.agreeProject);
router.post('/:id/cancel', requireRole('talent'), validate(cancelProjectSchema), ctrl.cancelProject);
router.post('/:id/deliveries', requireRole('talent'), validate(deliverySchema), ctrl.submitDelivery);
// Pemilik efektif (requester, atau liaison untuk jalur Assisted) & sign-off dua arah
// dicek di services/projectService.js.
router.post('/:id/verify', requireRole('requester', 'liaison', 'admin'), validate(verifySchema), ctrl.verifyProject);
router.post('/:id/revisions', requireRole('requester', 'liaison'), validate(revisionSchema), ctrl.requestRevision);
router.post('/:id/dispute', validate(openDisputeSchema), ctrl.openDispute);
router.post('/:id/dispute/statement', validate(disputeStatementSchema), ctrl.submitDisputeStatement);

export default router;
