import { Router } from 'express';
import * as ctrl from '../controllers/chatbotController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { chatMessageSchema } from '../validators/schemas.js';

const router = Router();

// Anonim boleh bertanya; token yang dikirim tetapi tidak sah → 401 agar klien memperbarui sesi.
router.post('/message', optionalAuth, validate(chatMessageSchema), ctrl.postMessage);
router.get('/session/:id', optionalAuth, ctrl.getSession);
router.get('/health', authenticate, requireRole('admin'), ctrl.health);

export default router;
