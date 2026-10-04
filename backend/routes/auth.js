import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateMeSchema } from '../validators/schemas.js';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), ctrl.register);
router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
// Logout cukup dengan cookie refresh: access token yang sudah kedaluwarsa tidak boleh
// membuat pengguna gagal keluar.
router.post('/logout', ctrl.logout);
router.post('/refresh', ctrl.refresh);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, validate(updateMeSchema), ctrl.updateMe);

export default router;
