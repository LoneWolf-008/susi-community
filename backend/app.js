// Aplikasi Express tanpa listen, agar bisa diuji dengan supertest.
// Harus paling awal: memuat .env dan menghentikan proses bila konfigurasi wajib kosong.
import { env } from './config/env.js';
import fs from 'node:fs';
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
import talentRoutes from './routes/talent.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import testimonialsRoutes from './routes/testimonials.js';
import skillsRoutes from './routes/skills.js';
import publicRoutes from './routes/public.js';
import chatbotRoutes from './routes/chatbot.js';

// Folder unggahan dibuat saat boot agar multer tidak gagal di instalasi baru.
fs.mkdirSync(env.deliveriesDir, { recursive: true });

export const app = express();

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
app.use('/api/liaison', liaisonRoutes);
app.use('/api/talent', talentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/chatbot', chatbotRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Endpoint tidak ditemukan' } });
});

// Error handler
app.use(errorHandler);

export default app;
