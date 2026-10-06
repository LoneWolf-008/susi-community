// Bukti kompatibilitas bcrypt → bcryptjs (deploy cPanel tanpa modul native). Membaca hash yang sudah ada
// di DB (dibuat bcrypt native) untuk akun admin & akun seed, lalu memverifikasinya dengan bcryptjs memakai
// password dari .env (ADMIN_PASSWORD, SEED_USER_PASSWORD; tidak pernah dicetak). Bila modul bcrypt native
// masih terpasang, juga diuji arah sebaliknya: hash bcryptjs diverifikasi bcrypt native.
//
//   node scripts/check-bcrypt-compat.mjs
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcryptjs from 'bcryptjs';

let failed = 0;
const check = (label, ok, note = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${label}${note ? `  (${note})` : ''}`);
};

const conn = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '', database: process.env.DB_NAME,
});
try {
  const [rows] = await conn.query(
    `SELECT email, role, password_hash FROM users WHERE role = 'admin' OR email LIKE '%.test' ORDER BY id LIMIT 12`,
  );
  console.log(`DB ${process.env.DB_NAME}: ${rows.length} akun diperiksa`);
  for (const row of rows) {
    const password = row.role === 'admin' ? process.env.ADMIN_PASSWORD : process.env.SEED_USER_PASSWORD;
    if (!password) continue;
    const ok = await bcryptjs.compare(password, row.password_hash);
    check(`hash lama ${row.password_hash.slice(0, 4)}… ${row.email} diverifikasi bcryptjs`, ok);
    const wrong = await bcryptjs.compare(`${password}x`, row.password_hash);
    if (wrong) check(`password salah ditolak untuk ${row.email}`, false);
  }
} finally {
  await conn.end();
}

const fresh = await bcryptjs.hash('contoh-password-uji', 12);
let native = null;
try {
  native = (await import('bcrypt')).default;
} catch {
  console.log('(bcrypt native tidak terpasang: arah bcryptjs → bcrypt dilewati)');
}
if (native) {
  check(`hash baru bcryptjs (${fresh.slice(0, 4)}…) diverifikasi bcrypt native`, await native.compare('contoh-password-uji', fresh));
  const nativeHash = await native.hash('contoh-password-uji', 12);
  check(`hash baru bcrypt native (${nativeHash.slice(0, 4)}…) diverifikasi bcryptjs`, await bcryptjs.compare('contoh-password-uji', nativeHash));
}
console.log(failed ? `\nHASIL: ${failed} GAGAL` : '\nHASIL: hash bcrypt lama tetap valid dengan bcryptjs');
process.exitCode = failed ? 1 : 0;
