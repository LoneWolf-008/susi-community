import { Router } from 'express';
import * as ctrl from '../controllers/discussionsController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTopicSchema, createReplySchema, topicPositionSchema, extendTopicSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listTopics);
router.get('/:id', ctrl.getTopic);
router.post('/', validate(createTopicSchema), ctrl.createTopic);
router.post('/:id/replies', validate(createReplySchema), ctrl.createReply);
router.patch('/:id/position', validate(topicPositionSchema), ctrl.updatePosition);
// U1: masa pajang & hapus.
router.patch('/:id/extend', validate(extendTopicSchema), ctrl.extendTopic);
router.delete('/replies/:id', ctrl.deleteReply);
router.delete('/:id', ctrl.deleteTopic);

export default router;
