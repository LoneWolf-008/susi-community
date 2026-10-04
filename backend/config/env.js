// Memuat backend/.env dan memvalidasi variabel wajib.
// HARUS diimpor paling awal di server.js agar modul lain membaca konfigurasi yang sudah valid.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Path absolut: .env tetap terbaca walau server dijalankan dari folder lain.
// Variabel yang sudah ada di environment proses tidak ditimpa.
dotenv.config({ path: path.join(BACKEND_DIR, '.env'), quiet: true });

const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
];

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * Validasi murni (tanpa efek samping) agar mudah diuji.
 * @returns {string[]} daftar pesan kesalahan; kosong bila valid
 */
export function validateEnv(source) {
  const errors = [];
  const isProd = source.NODE_ENV === 'production';

  for (const key of REQUIRED) {
    if (isBlank(source[key])) errors.push(`${key} wajib diisi`);
  }

  if (!isBlank(source.DB_PORT) && !Number.isInteger(Number(source.DB_PORT))) {
    errors.push('DB_PORT harus berupa angka');
  }

  // Password kosong lazim untuk root MySQL lokal (Laragon/XAMPP), tapi tidak di production.
  if (isProd && isBlank(source.DB_PASSWORD)) {
    errors.push('DB_PASSWORD wajib diisi di production');
  }

  const access = source.JWT_ACCESS_SECRET;
  const refresh = source.JWT_REFRESH_SECRET;
  if (!isBlank(access) && access === refresh) {
    errors.push('JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET harus berbeda');
  }
  if (isProd) {
    for (const [key, value] of [['JWT_ACCESS_SECRET', access], ['JWT_REFRESH_SECRET', refresh]]) {
      if (!isBlank(value) && String(value).length < 32) {
        errors.push(`${key} minimal 32 karakter di production`);
      }
    }
  }

  return errors;
}

// 'true'/'false' → boolean, angka → jumlah hop, selain itu diteruskan apa adanya (mis. 'loopback').
const parseTrustProxy = (raw) => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
};

const errors = validateEnv(process.env);
if (errors.length > 0) {
  console.error(
    '\n[config] Konfigurasi environment tidak valid:\n' +
      errors.map((e) => `  - ${e}`).join('\n') +
      '\n\nSalin backend/.env.example menjadi backend/.env lalu lengkapi nilainya.\n',
  );
  process.exit(1);
}

const uploadDir = path.resolve(BACKEND_DIR, process.env.UPLOAD_DIR || 'uploads');

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3009,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY ?? '1'),
  frontendUrls: process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean),
  db: Object.freeze({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME,
  }),
  jwt: Object.freeze({
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  }),
  uploadDir,
  deliveriesDir: path.join(uploadDir, 'deliveries'),
});
