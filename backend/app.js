// Aplikasi Express tanpa listen, agar bisa diuji dengan supertest.
// Harus paling awal: memuat .env dan menghentikan proses bila konfigurasi wajib kosong.
import { env } from './config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import needsRoutes from './routes/needs.js';
import projectsRoutes from './routes/projects.js';
import applicationsRoutes from './routes/applications.js';
import communitiesRoutes from './routes/communities.js';
import discussionsRoutes from './routes/discussions.js';
import liaisonRoutes from './routes/liaison.js';
import escalationRoutes from './routes/escalations.js';
import talentRoutes from './routes/talent.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import testimonialsRoutes from './routes/testimonials.js';
import skillsRoutes from './routes/skills.js';
import publicRoutes from './routes/public.js';
import chatbotRoutes from './routes/chatbot.js';
import recommendationsRoutes from './routes/recommendations.js';
import { talentRouter as certificationRoutes, reviewRouter as certificationReviewRoutes } from './routes/certifications.js';

// Folder unggahan dibuat saat boot agar multer tidak gagal di instalasi baru.
fs.mkdirSync(env.deliveriesDir, { recursive: true });

export const app = express();

// Dibutuhkan agar req.ip (rate limit, log token) benar di balik proxy Railway/Render.
app.set('trust proxy', env.trustProxy);

// ===== MIDDLEWARE =====
// CSP juga berlaku untuk halaman frontend bila SERVE_FRONTEND=true: font Google, tile & gaya peta
// OpenFreeMap, pencarian alamat Nominatim, avatar dari URL https, dan worker MapLibre (blob:).
// upgrade-insecure-requests tidak dipakai: semua aset sama origin, dan cek lokal berjalan di http.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://tiles.openfreemap.org', 'https://nominatim.openstreetmap.org'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: env.frontendUrls,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Berkas tidak lewat JSON (multer), jadi batas body JSON cukup kecil.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== ROUTES =====
// Tidak ada express.static('/uploads'): berkas hasil kerja hanya bisa diunduh lewat
// /api/upload/delivery/:filename yang memeriksa login dan keterlibatan di proyek.
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/needs', needsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/communities', communitiesRoutes);
app.use('/api/discussions', discussionsRoutes);
// Antrean eskalasi (liaison + admin) harus dipasang sebelum router /api/liaison yang khusus liaison.
app.use('/api/liaison/escalations', escalationRoutes);
app.use('/api/liaison', liaisonRoutes);
app.use('/api/talent', talentRoutes);
// Peninjauan sertifikasi (U5) untuk admin & AgenSUSI: sebelum /api/admin yang khusus admin.
app.use('/api/admin/certifications', certificationReviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/recommendations', recommendationsRoutes);

// ===== FRONTEND (satu origin, mis. cPanel) =====
// SERVE_FRONTEND=true: sajikan hasil `npm run build` frontend. Aset ber-hash di /assets di-cache lama
// (immutable); berkas lain di dist (gambar hero, favicon) sehari; index.html tidak pernah di-cache agar
// rilis baru langsung terpakai. Rute non-/api tanpa ekstensi berkas → index.html (fallback SPA, mis.
// /dashboard saat halaman dimuat ulang). /api dan berkas yang tidak ada tetap jatuh ke 404 JSON di bawah.
if (env.serveFrontend) {
  const indexFile = path.join(env.frontendDist, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`SERVE_FRONTEND=true tetapi ${indexFile} tidak ada. Build frontend dulu atau atur FRONTEND_DIST.`);
  }
  const noCache = (res) => res.set('Cache-Control', 'no-cache');
  app.use('/assets', express.static(path.join(env.frontendDist, 'assets'), { index: false, immutable: true, maxAge: '365d' }));
  app.use(express.static(env.frontendDist, {
    index: false,
    maxAge: '1d',
    setHeaders: (res, file) => { if (file.endsWith('.html')) noCache(res); },
  }));
  app.get(/^\/(?!api(?:\/|$))/, (req, res, next) => {
    if (path.extname(req.path)) return next();
    noCache(res);
    return res.sendFile(indexFile);
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Endpoint tidak ditemukan' } });
});

// Error handler
app.use(errorHandler);

export default app;
