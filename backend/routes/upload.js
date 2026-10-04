import { Router } from 'express';
import * as ctrl from '../controllers/uploadController.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';

const UPLOAD_DIR = env.deliveriesDir;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `delivery-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(zip|rar|pdf|png|jpg|jpeg|doc|docx|txt|mp4|mov)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung'));
    }
  },
});

const router = Router();
router.use(authenticate);

router.post('/delivery', upload.single('file'), ctrl.uploadDelivery);
router.get('/delivery/:filename', ctrl.downloadDelivery);

export default router;