import { Router } from 'express';
import * as ctrl from '../controllers/uploadController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { MAX_UPLOAD_BYTES, isAllowedUpload, generateDeliveryFilename } from '../utils/uploads.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.deliveriesDir),
  filename: (req, file, cb) => cb(null, generateDeliveryFilename(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    // Ekstensi DAN mimetype harus cocok dengan daftar yang diizinkan.
    if (isAllowedUpload(file.originalname, file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Format file tidak didukung (zip, rar, pdf, png, jpg, doc, docx, txt, mp4, mov)'));
    }
  },
});

const router = Router();
router.use(authenticate);

router.post('/delivery', requireRole('talent'), upload.single('file'), ctrl.uploadDelivery);
router.get('/delivery/:filename', ctrl.downloadDelivery);

export default router;
