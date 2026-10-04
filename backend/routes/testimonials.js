import { Router } from 'express';
import * as ctrl from '../controllers/testimonialsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/mine', ctrl.getMyTestimonials);
router.get('/public/:userId', ctrl.getPublicTestimonials);
router.post('/', ctrl.createTestimonial);

export default router;