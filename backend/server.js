// Harus paling awal: memuat .env dan menghentikan proses bila konfigurasi wajib kosong.
import { env } from './config/env.js';
import { app } from './app.js';
import { pool } from './config/db.js';

// ===== START SERVER =====
const server = app.listen(env.port, () => {
  console.log(`SUSI Community API berjalan di http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`${signal} diterima, menutup server dan koneksi DB...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
