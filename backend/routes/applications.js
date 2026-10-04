import { Router } from 'express';
import * as ctrl from '../controllers/applicationsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { applySchema, decideApplicationSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

// Liaison = pemilik proksi kebutuhan jalur Assisted; kepemilikan efektif dicek di controller.
router.get('/mine', requireRole('talent'), ctrl.getMyApplications);
router.get('/for-need/:needId', requireRole('requester', 'liaison'), ctrl.getApplicationsForNeed);
router.post('/needs/:needId', requireRole('talent'), validate(applySchema), ctrl.apply);
router.patch('/:id/decide', requireRole('requester', 'liaison'), validate(decideApplicationSchema), ctrl.decide);

export default router;
