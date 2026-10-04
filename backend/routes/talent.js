import { Router } from 'express';
import * as ctrl from '../controllers/talentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { talentProfileSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/profile', requireRole('talent'), ctrl.getProfile);
router.patch('/profile', requireRole('talent'), validate(talentProfileSchema), ctrl.updateProfile);
router.get('/top', ctrl.getTopTalents);
router.get('/:id/testimonials', ctrl.getTestimonials);

export default router;
