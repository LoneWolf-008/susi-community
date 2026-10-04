import { Router } from 'express';
import * as ctrl from '../controllers/communitiesController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/:id/join', ctrl.join);
router.delete('/:id/leave', ctrl.leave);

export default router;