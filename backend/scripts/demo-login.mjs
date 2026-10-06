// Cek login semua akun demo (T16): akun dari db/seeds/demo.js + admin dari .env. Cetak LULUS/GAGAL
// beserta peran yang dikembalikan server. Password dibaca dari .env (SEED_USER_PASSWORD, ADMIN_*),
// tidak pernah dicetak.
//
//   npm run demo:login [-- http://localhost:3009/api]
import 'dotenv/config';
import { USERS } from '../db/seeds/demo.js';

const base = process.argv[2] || `http://localhost:${process.env.PORT || 3009}/api`;
const accounts = [
  { email: process.env.ADMIN_EMAIL, role: 'admin', password: process.env.ADMIN_PASSWORD },
  ...USERS.map((u) => ({ email: u.email, role: u.role, password: process.env.SEED_USER_PASSWORD })),
];

let failed = 0;
for (const a of accounts) {
  let result;
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: a.email, password: a.password }),
    });
    const json = await res.json().catch(() => ({}));
    const role = json.data?.user?.role;
    result = res.ok && role === a.role ? { ok: true, note: role } : { ok: false, note: `${res.status} ${role ?? json.message ?? ''}` };
  } catch (err) {
    result = { ok: false, note: err.message };
  }
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'LULUS' : 'GAGAL'}  ${a.email.padEnd(22)} ${a.role.padEnd(9)} ${result.ok ? '' : result.note}`);
}
console.log(failed ? `\nHASIL: ${failed} akun GAGAL` : `\nHASIL: semua ${accounts.length} akun demo bisa login`);
process.exit(failed ? 1 : 0);
