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

// openrouter = OpenRouter sungguhan; mock = jawaban tiruan deterministik untuk dev & test tanpa key.
export const LLM_PROVIDERS = ['openrouter', 'mock'];
export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high'];

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

  // Chatbot / LLM: semuanya opsional (tanpa key chatbot menjawab dari KB), tapi nilai yang
  // diisi harus valid agar salah ketik tidak diam-diam mematikan LLM.
  const oneOf = (key, allowed) => {
    if (!isBlank(source[key]) && !allowed.includes(String(source[key]).trim().toLowerCase())) {
      errors.push(`${key} harus salah satu dari: ${allowed.join(', ')}`);
    }
  };
  oneOf('LLM_PROVIDER', LLM_PROVIDERS);
  oneOf('OPENROUTER_DATA_COLLECTION', ['allow', 'deny']);
  oneOf('OPENROUTER_REASONING_EFFORT', REASONING_EFFORTS);
  for (const key of ['OPENROUTER_TIMEOUT_MS', 'CHATBOT_MAX_TOKENS']) {
    if (!isBlank(source[key]) && !(Number.isInteger(Number(source[key])) && Number(source[key]) > 0)) {
      errors.push(`${key} harus bilangan bulat positif`);
    }
  }
  if (!isBlank(source.CHATBOT_DAILY_BUDGET_USD) && !(Number(source.CHATBOT_DAILY_BUDGET_USD) >= 0)) {
    errors.push('CHATBOT_DAILY_BUDGET_USD harus angka ≥ 0');
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

const intOr = (raw, fallback) => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const numberOr = (raw, fallback) => (isBlank(raw) || !Number.isFinite(Number(raw)) ? fallback : Number(raw));
const listOf = (raw) => (isBlank(raw) ? [] : String(raw).split(',').map((s) => s.trim()).filter(Boolean));
const lower = (raw, fallback) => (isBlank(raw) ? fallback : String(raw).trim().toLowerCase());

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
  rateLimit: Object.freeze({
    // Semua /api per IP per 15 menit.
    apiMax: intOr(process.env.RATE_LIMIT_MAX, 500),
    // Login (hanya percobaan gagal) dan registrasi per IP.
    authMax: intOr(process.env.AUTH_RATE_LIMIT_MAX, 10),
    authWindowMs: intOr(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    // Endpoint publik tanpa login: per IP per menit, dan pencatatan kunjungan per 15 menit.
    publicMax: intOr(process.env.PUBLIC_RATE_LIMIT_MAX, 60),
    visitMax: intOr(process.env.VISIT_RATE_LIMIT_MAX, 10),
  }),
  // Key OpenRouter hanya dibaca di sini dan dipakai klien LLM di backend; tidak pernah dikirim ke FE.
  llm: Object.freeze({
    provider: lower(process.env.LLM_PROVIDER, 'openrouter'),
    openrouter: Object.freeze({
      apiKey: isBlank(process.env.OPENROUTER_API_KEY) ? null : process.env.OPENROUTER_API_KEY.trim(),
      model: isBlank(process.env.OPENROUTER_MODEL) ? 'anthropic/claude-haiku-4.5' : process.env.OPENROUTER_MODEL.trim(),
      fallbackModels: listOf(process.env.OPENROUTER_FALLBACK_MODELS),
      timeoutMs: intOr(process.env.OPENROUTER_TIMEOUT_MS, 12000),
      // HTTP-Referer & X-OpenRouter-Title: atribusi aplikasi di OpenRouter (opsional).
      referer: isBlank(process.env.OPENROUTER_REFERER) ? null : process.env.OPENROUTER_REFERER.trim(),
      title: isBlank(process.env.OPENROUTER_TITLE) ? 'SUSI Community' : process.env.OPENROUTER_TITLE.trim(),
      // deny = hanya provider yang tidak menyimpan/melatih dengan data prompt (default, demi privasi).
      dataCollection: lower(process.env.OPENROUTER_DATA_COLLECTION, 'deny'),
      // Kosong = tidak mengirim parameter reasoning (Haiku 4.5 tidak memerlukannya).
      reasoningEffort: lower(process.env.OPENROUTER_REASONING_EFFORT, null),
    }),
  }),
  chatbot: Object.freeze({
    maxTokens: intOr(process.env.CHATBOT_MAX_TOKENS, 350),
    dailyBudgetUsd: numberOr(process.env.CHATBOT_DAILY_BUDGET_USD, 1),
    messageMaxChars: 500,
    historyMessages: 6,
  }),
});
