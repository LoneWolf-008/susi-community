import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', registerLimiter, ctrl.register);
router.post('/login', loginLimiter, ctrl.login);
// Logout cukup dengan cookie refresh: access token yang sudah kedaluwarsa tidak boleh
// membuat pengguna gagal keluar.
router.post('/logout', ctrl.logout);
router.post('/refresh', ctrl.refresh);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, ctrl.updateMe);

export default router;
