// Harus paling awal: memuat .env dan menghentikan proses bila konfigurasi wajib kosong.
import { env } from './config/env.js';
import { app } from './app.js';
import { pool } from './config/db.js';
import { startRetentionJob } from './services/chatbot/retention.js';

// ===== START SERVER =====
// env.port: angka (port TCP) atau path socket. Di Passenger (cPanel) listen() pertama diambil alih ke
// socket Passenger, jadi tidak ada port tetap yang diikat.
const server = app.listen(env.port, () => {
  const where = typeof env.port === 'number' ? `http://localhost:${env.port}` : `socket ${env.port}`;
  console.log(`SUSI Community API berjalan di ${where}${env.serveFrontend ? ' (+ frontend)' : ''}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

// Retensi riwayat Tanya SUSI: harian (CHATBOT_RETENTION_DAYS, 0 = dimatikan).
const stopRetention = startRetentionJob(pool);

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`${signal} diterima, menutup server dan koneksi DB...`);
  stopRetention?.();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
