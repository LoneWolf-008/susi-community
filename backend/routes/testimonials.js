import { Router } from 'express';
import * as ctrl from '../controllers/testimonialsController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { testimonialSchema } from '../validators/schemas.js';

const router = Router();
router.use(authenticate);

router.get('/mine', ctrl.getMyTestimonials);
router.get('/public/:userId', ctrl.getPublicTestimonials);
router.post('/', validate(testimonialSchema), ctrl.createTestimonial);

export default router;
