import { Router } from 'express';
import * as ctrl from '../controllers/needsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

router.get('/catalog', ctrl.getCatalog);
router.get('/mine', requireRole('requester'), ctrl.getMyNeeds);
router.get('/:id', ctrl.getNeedById);
router.post('/', requireRole('requester', 'liaison'), ctrl.createNeed);
router.patch('/:id', requireRole('requester'), ctrl.updateNeed);
router.delete('/:id', requireRole('requester'), ctrl.deleteNeed);

export default router;