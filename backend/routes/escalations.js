import { Router } from 'express';
import * as ctrl from '../controllers/escalationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { escalationReplySchema, resolveEscalationSchema } from '../validators/schemas.js';

// Dipasang di /api/liaison/escalations SEBELUM router /api/liaison (yang khusus liaison),
// karena antrean eskalasi juga untuk admin.
const router = Router();

router.use(authenticate, requireRole('liaison', 'admin'));

router.get('/', ctrl.listEscalations);
router.get('/:id', ctrl.getEscalation);
router.patch('/:id/claim', ctrl.claimEscalation);
router.post('/:id/reply', validate(escalationReplySchema), ctrl.replyEscalation);
router.patch('/:id/resolve', validate(resolveEscalationSchema), ctrl.resolveEscalation);

export default router;
