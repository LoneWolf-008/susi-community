// Cetak SQL pembuat akun admin untuk dijalankan di phpMyAdmin (hosting tanpa SSH). Email & password dari
// ADMIN_EMAIL / ADMIN_PASSWORD (environment atau backend/.env). Yang dicetak hanya email dan HASH bcrypt
// (12 putaran, sama dengan pendaftaran), bukan password. Aman dijalankan ulang: email yang sudah ada
// tidak ditimpa (INSERT IGNORE).
//
//   npm run make-admin-sql            → salin keluarannya ke tab SQL phpMyAdmin
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || 'Admin SUSI').trim();
const errors = [];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('ADMIN_EMAIL wajib berisi email yang valid');
if (password.length < 10) errors.push('ADMIN_PASSWORD wajib, minimal 10 karakter');
if (errors.length > 0) {
  console.error(`make-admin-sql: ${errors.join('; ')}`);
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const sql = (text, values) => mysql.format(text, values);
process.stdout.write([
  `-- Akun admin SUSI (${email}). Jalankan di phpMyAdmin → database aplikasi → tab SQL.`,
  sql(`INSERT IGNORE INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'AKTIF');`, [name, email, hash]),
  sql(`INSERT IGNORE INTO user_settings (user_id) SELECT id FROM users WHERE email = ?;`, [email]),
  '',
].join('\n'));
