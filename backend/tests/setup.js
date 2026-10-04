// Dijalankan di awal setiap berkas test: tutup pool MySQL setelah berkas selesai.
import { afterAll } from 'vitest';
import { pool } from '../config/db.js';

afterAll(async () => {
  await pool.end();
});
