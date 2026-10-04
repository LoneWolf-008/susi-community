import fs from 'node:fs';
import { pool } from '../config/db.js';
import { success, fail } from '../utils/response.js';
import { getNeedOwnerId } from '../utils/ownership.js';
import { DELIVERY_FILENAME_RE, deliveryFilePath, deliveryAbsolutePath } from '../utils/uploads.js';

export const uploadDelivery = async (req, res, next) => {
  try {
    if (!req.file) {
      return fail(res, 'File wajib diunggah', 400);
    }

    return success(res, {
      file_name: req.file.originalname,
      file_path: deliveryFilePath(req.file.filename),
      file_size: req.file.size,
    }, 'File berhasil diunggah');
  } catch (err) {
    next(err);
  }
};

// Hanya berkas yang tercatat di project_deliveries, dan hanya untuk talenta,
// pemilik kebutuhan, atau admin proyek tersebut.
export const downloadDelivery = async (req, res, next) => {
  try {
    const filename = req.params.filename;
    if (!DELIVERY_FILENAME_RE.test(filename)) {
      return fail(res, 'File tidak ditemukan', 404);
    }

    const [rows] = await pool.query(
      `SELECT pd.file_name, p.talent_id, n.requester_id, n.created_by
       FROM project_deliveries pd
       JOIN projects p ON p.id = pd.project_id
       JOIN needs n ON n.id = p.need_id
       WHERE pd.file_path = ?
       LIMIT 1`,
      [deliveryFilePath(filename)]
    );
    const delivery = rows[0];
    if (!delivery) return fail(res, 'File tidak ditemukan', 404);

    const allowed = req.user.role === 'admin'
      || Number(delivery.talent_id) === Number(req.user.id)
      || Number(getNeedOwnerId(delivery)) === Number(req.user.id);
    if (!allowed) return fail(res, 'Akses ditolak', 403);

    const absolutePath = deliveryAbsolutePath(filename);
    if (!fs.existsSync(absolutePath)) {
      return fail(res, 'File tidak ditemukan', 404);
    }

    return res.download(absolutePath, delivery.file_name || filename);
  } catch (err) {
    next(err);
  }
};
