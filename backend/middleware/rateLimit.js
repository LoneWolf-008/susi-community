import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const errorBody = (message) => ({ error: { message } });
const common = { standardHeaders: 'draft-7', legacyHeaders: false };

export const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimit.apiMax,
  message: errorBody('Terlalu banyak request, coba lagi nanti.'),
});

// Hanya percobaan gagal yang dihitung, agar demo dengan banyak akun dari satu IP tidak terkunci.
export const loginLimiter = rateLimit({
  ...common,
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  skipSuccessfulRequests: true,
  message: errorBody('Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'),
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  message: errorBody('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam 15 menit.'),
});
