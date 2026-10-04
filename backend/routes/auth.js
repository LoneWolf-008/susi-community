import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.post('/refresh', ctrl.refresh);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, ctrl.updateMe);

export default router;