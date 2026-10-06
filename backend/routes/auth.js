import { Router } from 'express';
import { env } from '../config/env.js';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { fail } from '../utils/response.js';
import { registerSchema, loginSchema, updateMeSchema } from '../validators/schemas.js';

const router = Router();

// COOKIE_SAMESITE=none: peramban mengirim cookie refresh dari situs mana pun, jadi endpoint yang
// memakainya hanya menerima Origin yang tercantum di FRONTEND_URL (cegah CSRF). Mode lax tidak memeriksa.
const requireFrontendOrigin = (req, res, next) => {
  if (env.cookie.sameSite !== 'none' || env.frontendUrls.includes(req.get('Origin'))) return next();
  return fail(res, 'Origin tidak diizinkan', 403);
};

router.post('/register', registerLimiter, validate(registerSchema), ctrl.register);
router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
// Logout cukup dengan cookie refresh: access token yang sudah kedaluwarsa tidak boleh
// membuat pengguna gagal keluar.
router.post('/logout', requireFrontendOrigin, ctrl.logout);
router.post('/refresh', requireFrontendOrigin, ctrl.refresh);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, validate(updateMeSchema), ctrl.updateMe);

export default router;
