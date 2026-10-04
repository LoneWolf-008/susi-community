import { fail } from '../utils/response.js';

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 'Autentikasi diperlukan', 401);
    }
    if (!roles.includes(req.user.role)) {
      return fail(res, 'Akses ditolak: peran tidak diizinkan', 403);
    }
    next();
  };
};