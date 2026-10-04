import { Router } from 'express';
import * as ctrl from '../controllers/liaisonController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createVisitSchema, updateVisitSchema, finishVisitSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate, requireRole('liaison'));

router.get('/visits', ctrl.getVisits);
router.get('/visits/:id', ctrl.getVisitById);
router.post('/visits', validate(createVisitSchema), ctrl.createVisit);
router.patch('/visits/:id', validate(updateVisitSchema), ctrl.updateVisit);
router.post('/visits/:id/start', ctrl.startVisit);
router.post('/visits/:id/finish', validate(finishVisitSchema), ctrl.finishVisit);

export default router;
