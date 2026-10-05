import { verifyAccessToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';
import { fail } from '../utils/response.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 'Token tidak ditemukan', 401);
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    const [users] = await pool.query(
      `SELECT id, name, email, role, status FROM users WHERE id = ? AND deleted_at IS NULL`,
      [decoded.userId]
    );

    if (!users[0]) {
      return fail(res, 'User tidak ditemukan', 401);
    }

    if (users[0].status !== 'AKTIF') {
      return fail(res, 'Akun Anda ditangguhkan', 403);
    }

    req.user = users[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return fail(res, 'Token kedaluwarsa', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return fail(res, 'Token tidak valid', 401);
    }
    return fail(res, 'Autentikasi gagal', 401);
  }
};

/**
 * Login opsional: tanpa header Authorization → lanjut sebagai anonim. Bila token DIKIRIM tetapi tidak
 * sah/kedaluwarsa → 401 (bukan diam-diam anonim), agar klien memperbarui token lalu mengulang;
 * kalau tidak, pengguna yang tokennya habis kehilangan akses ke datanya sendiri secara membingungkan.
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  return authenticate(req, res, next);
};