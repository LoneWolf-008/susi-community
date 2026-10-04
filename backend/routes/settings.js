import { Router } from 'express';
import * as ctrl from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getMySettings);
router.patch('/', ctrl.updateMySettings);

export default router;