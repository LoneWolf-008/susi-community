import { Router } from 'express';
import * as ctrl from '../controllers/recommendationsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

// R1: rekomendasi berbasis skor deterministik. Kepemilikan kebutuhan dicek di controller.
const router = Router();

router.use(authenticate);

router.get('/needs', requireRole('talent'), ctrl.needsForTalent);
router.get('/talents', requireRole('requester', 'liaison', 'admin'), ctrl.talentsForNeed);

export default router;
