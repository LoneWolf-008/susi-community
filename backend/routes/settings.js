import { Router } from 'express';
import * as ctrl from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { settingsSchema } from '../validators/schemas.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getMySettings);
router.patch('/', validate(settingsSchema), ctrl.updateMySettings);

export default router;
