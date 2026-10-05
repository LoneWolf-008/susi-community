import { createHmac, randomBytes } from 'node:crypto';
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

// Endpoint publik (tanpa login) dibatasi lebih ketat dari /api umum.
export const publicLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: env.rateLimit.publicMax,
  message: errorBody('Terlalu banyak request ke data publik, coba lagi sebentar lagi.'),
});

export const visitLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimit.visitMax,
  message: errorBody('Kunjungan sudah tercatat.'),
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  message: errorBody('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam 15 menit.'),
});

// ===== Chatbot (T12.5) — dipasang setelah optionalAuth agar req.user sudah terisi =====
// Pengguna dihitung per akun. Anonim dihitung per IP + sesi chat (satu IP sekolah/venue bisa
// dipakai banyak orang), dengan plafon per IP agar ganti-ganti sesi tidak membuka kuota tanpa batas.
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// IP pengunjung anonim tidak disimpan mentah (T15): kunci memakai HMAC dengan garam acak per proses.
// Penyimpanan rate limit ada di memori, jadi garam tidak perlu bertahan antar-restart, dan hash dari
// proses lain tidak bisa dicocokkan.
const IP_SALT = randomBytes(32);
export const hashIp = (ip) => createHmac('sha256', IP_SALT).update(String(ip ?? '')).digest('base64url').slice(0, 22);

const chatSession = (req) => {
  const id = req.body?.session_id;
  return typeof id === 'string' && UUID_RE.test(id) ? id.toLowerCase() : null;
};
const chatKey = (req) => (req.user ? `u:${req.user.id}` : `a:${hashIp(req.ip)}|${chatSession(req) ?? 'baru'}`);
const ipKey = (req) => `ip:${hashIp(req.ip)}`;
const isLoggedIn = (req) => Boolean(req.user);

export const chatbotLimiters = [
  rateLimit({
    ...common,
    windowMs: MINUTE_MS,
    limit: (req) => (req.user ? env.chatbot.rateLimitPerMin : env.chatbot.anonRateLimitPerMin),
    keyGenerator: chatKey,
    message: errorBody('Pesan terlalu cepat. Tunggu sebentar lalu coba lagi.'),
  }),
  rateLimit({
    ...common,
    windowMs: MINUTE_MS,
    limit: env.chatbot.anonIpRateLimitPerMin,
    keyGenerator: ipKey,
    skip: isLoggedIn,
    message: errorBody('Terlalu banyak pesan dari jaringan ini. Tunggu sebentar lalu coba lagi.'),
  }),
  rateLimit({
    ...common,
    windowMs: DAY_MS,
    limit: (req) => (req.user ? env.chatbot.dailyLimitUser : env.chatbot.dailyLimitAnon),
    keyGenerator: chatKey,
    // Pesan pertama percakapan anonim (belum punya sesi) dibatasi plafon per IP di bawah.
    skip: (req) => !req.user && !chatSession(req),
    message: (req) => errorBody(req.user
      ? 'Batas pertanyaan harian Tanya SUSI sudah tercapai. Silakan coba lagi besok.'
      : 'Batas pertanyaan harian untuk pengunjung sudah tercapai. Masuk ke akun Anda untuk bertanya lebih banyak, atau coba lagi besok.'),
  }),
  rateLimit({
    ...common,
    windowMs: DAY_MS,
    limit: env.chatbot.dailyLimitAnonIp,
    keyGenerator: ipKey,
    skip: isLoggedIn,
    message: errorBody('Batas pertanyaan harian dari jaringan ini sudah tercapai. Masuk ke akun Anda atau coba lagi besok.'),
  }),
];
