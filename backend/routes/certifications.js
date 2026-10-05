import { Router } from 'express';
import * as ctrl from '../controllers/certificationsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { certificationRequestSchema, certificationDecisionSchema, certificateRevokeSchema } from '../validators/schemas.js';

// U5: sertifikasi talenta. `talentRouter` di /api/certifications; `reviewRouter` di
// /api/admin/certifications, dipasang SEBELUM router /api/admin (khusus admin) karena AgenSUSI
// (liaison) juga meninjau. Mencabut sertifikat hanya admin.
export const talentRouter = Router();
talentRouter.use(authenticate, requireRole('talent'));
talentRouter.get('/eligibility', ctrl.getEligibility);
talentRouter.get('/mine', ctrl.getMine);
talentRouter.post('/', validate(certificationRequestSchema), ctrl.createRequest);

export const reviewRouter = Router();
reviewRouter.use(authenticate, requireRole('admin', 'liaison'));
reviewRouter.get('/', ctrl.listRequests);
reviewRouter.patch('/:id', validate(certificationDecisionSchema), ctrl.decideRequest);
reviewRouter.patch('/:id/revoke', requireRole('admin'), validate(certificateRevokeSchema), ctrl.revokeCertificate);
