import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import * as chatbot from '../controllers/chatbotAdminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import {
  moderationDecisionSchema, takedownSchema, resolveDisputeSchema, adminMessageSchema,
  userStatusSchema, createLiaisonSchema, createKbSchema, updateKbSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

// Stats & audit
router.get('/stats', ctrl.getStats);
router.get('/audit-logs', ctrl.getAuditLogs);

// Moderasi
router.get('/moderation', ctrl.getModerationQueue);
router.patch('/moderation/:id', validate(moderationDecisionSchema), ctrl.decideModeration);
router.patch('/testimonials/:id/takedown', validate(takedownSchema), ctrl.takedownTestimonial);

// Sengketa
router.get('/disputes', ctrl.getDisputes);
router.get('/disputes/:id', ctrl.getDisputeById);
router.patch('/disputes/:id/resolve', validate(resolveDisputeSchema), ctrl.resolveDispute);
router.post('/disputes/:id/messages', validate(adminMessageSchema), ctrl.sendMessage);

// Users
router.get('/users', ctrl.getUsers);
router.patch('/users/:id/status', validate(userStatusSchema), ctrl.updateUserStatus);

// Liaison
router.get('/liaisons', ctrl.getLiaisons);
router.post('/liaisons', validate(createLiaisonSchema), ctrl.createLiaison);
router.patch('/liaisons/:id/status', validate(userStatusSchema), ctrl.updateLiaisonStatus);

// Tanya SUSI: basis pengetahuan, pertanyaan tak terjawab, statistik (T14)
router.get('/kb', chatbot.listKb);
router.post('/kb', validate(createKbSchema), chatbot.createKb);
router.patch('/kb/:id', validate(updateKbSchema), chatbot.updateKb);
router.get('/chatbot/unanswered', chatbot.listUnanswered);
router.get('/chatbot/stats', chatbot.chatbotStats);

export default router;
