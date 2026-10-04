import { Router } from 'express';
import * as ctrl from '../controllers/communitiesController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCommunitySchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', validate(createCommunitySchema), ctrl.create);
router.post('/:id/join', ctrl.join);
router.delete('/:id/leave', ctrl.leave);

export default router;
