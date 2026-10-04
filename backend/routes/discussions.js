import { Router } from 'express';
import * as ctrl from '../controllers/discussionsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listTopics);
router.get('/:id', ctrl.getTopic);
router.post('/', ctrl.createTopic);
router.post('/:id/replies', ctrl.createReply);

export default router;