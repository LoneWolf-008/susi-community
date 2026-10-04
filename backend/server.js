// Harus paling awal: memuat .env dan menghentikan proses bila konfigurasi wajib kosong.
import { env } from './config/env.js';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import needsRoutes from './routes/needs.js';
import projectsRoutes from './routes/projects.js';
import applicationsRoutes from './routes/applications.js';
import communitiesRoutes from './routes/communities.js';
import discussionsRoutes from './routes/discussions.js';
import liaisonRoutes from './routes/liaison.js';
import talentRoutes from './routes/talent.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import testimonialsRoutes from './routes/testimonials.js';

// Folder unggahan dibuat saat boot agar multer tidak gagal di instalasi baru.
fs.mkdirSync(env.deliveriesDir, { recursive: true });

const app = express();
const PORT = env.port;

// Dibutuhkan agar req.ip (rate limit, log token) benar di balik proxy Railway/Render.
app.set('trust proxy', env.trustProxy);

// ===== MIDDLEWARE =====
app.use(helmet());
app.use(cors({
  origin: env.frontendUrls,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiter global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 500,
  message: { error: { message: 'Terlalu banyak request, coba lagi nanti.' } },
});
app.use('/api', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/needs', needsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/communities', communitiesRoutes);
app.use('/api/discussions', discussionsRoutes);
app.use('/api/liaison', liaisonRoutes);
app.use('/api/talent', talentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/uploads', express.static('uploads'));

// 404
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Endpoint tidak ditemukan' } });
});

// Error handler
app.use(errorHandler);

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`SUSI Community API berjalan di http://localhost:${PORT}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM diterima, menutup koneksi DB...');
  await pool.end();
  process.exit(0);
});