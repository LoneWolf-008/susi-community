import { Router } from 'express';
import * as ctrl from '../controllers/skillsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listSkills);

export default router;
