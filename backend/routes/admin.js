import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

// Stats
router.get('/stats', ctrl.getStats);

// Moderasi
router.get('/moderation', ctrl.getModerationQueue);
router.patch('/moderation/:id', ctrl.decideModeration);
router.patch('/testimonials/:id/takedown', ctrl.takedownTestimonial);

// Sengketa
router.get('/disputes', ctrl.getDisputes);
router.get('/disputes/:id', ctrl.getDisputeById);
router.patch('/disputes/:id/resolve', ctrl.resolveDispute);
router.post('/disputes/:id/messages', ctrl.sendMessage);

// Users
router.get('/users', ctrl.getUsers);
router.patch('/users/:id/status', ctrl.updateUserStatus);

// Liaison
router.get('/liaisons', ctrl.getLiaisons);
router.post('/liaisons', ctrl.createLiaison);
router.patch('/liaisons/:id/status', ctrl.updateLiaisonStatus);

export default router;
