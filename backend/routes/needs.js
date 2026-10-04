import { Router } from 'express';
import * as ctrl from '../controllers/needsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createNeedSchema, updateNeedSchema, withdrawNeedSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

// Liaison = pemilik proksi kebutuhan jalur Assisted; kepemilikan dicek di controller.
const owners = requireRole('requester', 'liaison');

router.get('/catalog', ctrl.getCatalog);
router.get('/mine', owners, ctrl.getMyNeeds);
router.get('/:id', ctrl.getNeedById);
router.post('/', owners, validate(createNeedSchema), ctrl.createNeed);
router.patch('/:id', owners, validate(updateNeedSchema), ctrl.updateNeed);
router.post('/:id/withdraw', owners, validate(withdrawNeedSchema), ctrl.withdrawNeed);
router.delete('/:id', owners, ctrl.deleteNeed);

export default router;
