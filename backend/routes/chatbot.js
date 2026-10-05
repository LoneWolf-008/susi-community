import { Router } from 'express';
import * as ctrl from '../controllers/chatbotController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { chatbotLimiters } from '../middleware/rateLimit.js';
import { chatMessageSchema, chatFeedbackSchema } from '../validators/schemas.js';

const router = Router();

// Anonim boleh bertanya; token yang dikirim tetapi tidak sah → 401 agar klien memperbarui sesi.
// Rate limit setelah optionalAuth (kunci per akun / per IP+sesi) dan dipakai bersama kedua endpoint.
router.post('/message', optionalAuth, chatbotLimiters, validate(chatMessageSchema), ctrl.postMessage);
router.post('/stream', optionalAuth, chatbotLimiters, validate(chatMessageSchema), ctrl.streamMessage);
router.post('/feedback', optionalAuth, validate(chatFeedbackSchema), ctrl.postFeedback);
router.get('/session/:id', optionalAuth, ctrl.getSession);
router.get('/health', authenticate, requireRole('admin'), ctrl.health);

export default router;
