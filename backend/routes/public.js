import { Router } from 'express';
import * as ctrl from '../controllers/publicController.js';
import { publicLimiter, visitLimiter } from '../middleware/rateLimit.js';

// Tanpa autentikasi. Rate limit lebih ketat dari /api umum.
const router = Router();
router.use(publicLimiter);

router.get('/stats', ctrl.getStats);
router.get('/catalog', ctrl.getCatalog);
router.get('/communities', ctrl.getCommunities);
router.post('/visit', visitLimiter, ctrl.recordVisit);

export default router;
