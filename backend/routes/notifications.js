import { Router } from 'express';
import * as ctrl from '../controllers/notificationsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getMyNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/:id/read', ctrl.markAsRead);
router.patch('/read-all', ctrl.markAllAsRead);
router.delete('/:id', ctrl.deleteNotification);

export default router;