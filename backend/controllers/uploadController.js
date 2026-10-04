import { success, fail } from '../utils/response.js';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'deliveries');

export const uploadDelivery = async (req, res, next) => {
  try {
    if (!req.file) {
      return fail(res, 'File wajib diunggah', 400);
    }

    return success(res, {
      file_name: req.file.originalname,
      file_path: `/uploads/deliveries/${req.file.filename}`,
      file_size: req.file.size,
    }, 'File berhasil diunggah');
  } catch (err) {
    next(err);
  }
};

export const downloadDelivery = async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return fail(res, 'File tidak ditemukan', 404);
    }

    return res.download(filePath);
  } catch (err) {
    next(err);
  }
};