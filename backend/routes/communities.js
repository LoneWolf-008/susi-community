import { Router } from 'express';
import * as ctrl from '../controllers/communitiesController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createCommunitySchema, joinRequestSchema, joinDecisionSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
// Permintaan gabung PENDING di semua komunitas yang dikelola pemanggil (sebelum /:id).
router.get('/join-requests', ctrl.listMyJoinRequests);
router.get('/:id', ctrl.getById);
router.post('/', validate(createCommunitySchema), ctrl.create);
// U1: gabung hanya untuk talenta, lewat persetujuan pengurus.
router.post('/:id/join', requireRole('talent'), validate(joinRequestSchema), ctrl.join);
router.delete('/:id/join', ctrl.leave);
router.delete('/:id/leave', ctrl.leave); // nama lama, tetap didukung
router.get('/:id/join-requests', ctrl.listJoinRequests);
router.patch('/:id/join-requests/:userId', validate(joinDecisionSchema), ctrl.decideJoinRequest);

export default router;
