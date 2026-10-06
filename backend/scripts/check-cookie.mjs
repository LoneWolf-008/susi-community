// Cek mode cookie refresh (COOKIE_SAMESITE). Menjalankan aplikasi di proses anak untuk tiap mode (port
// acak, DB dari .env), login sebagai admin .env (password tidak pernah dicetak), lalu memeriksa:
//  - lax : cookie SameSite=Lax; /auth/refresh tetap diterima apa pun Origin-nya (perilaku lama).
//  - none: cookie SameSite=None; Secure; /auth/refresh & /auth/logout hanya menerima Origin = FRONTEND_URL.
//
//   node scripts/check-cookie.mjs
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!mode) {
  let failed = 0;
  for (const m of ['lax', 'none']) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), m], { stdio: 'inherit' });
    if (child.status !== 0) failed += 1;
  }
  console.log(failed ? '\nHASIL: ada cek GAGAL' : '\nHASIL: semua cek cookie LULUS');
  process.exit(failed ? 1 : 0);
}

process.env.COOKIE_SAMESITE = mode;
const { env } = await import('../config/env.js');
const { pool } = await import('../config/db.js');
const { app } = await import('../app.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/api/auth`;
const FRONTEND = env.frontendUrls[0];
const EVIL = 'https://situs-lain.example';

const cookieOf = (res) => res.headers.getSetCookie().find((c) => c.startsWith('susi_refresh_token=')) ?? '';
const post = (path, { cookie, origin, body } = {}) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie.split(';')[0] } : {}), ...(origin ? { Origin: origin } : {}) },
  body: JSON.stringify(body ?? {}),
});

let failed = 0;
const check = (label, ok, note = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${note ? `  (${note})` : ''}`);
};

console.log(`\n[COOKIE_SAMESITE=${mode}] FRONTEND_URL=${env.frontendUrls.join(',')}`);
try {
  const login = await post('/login', { origin: FRONTEND, body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  let cookie = cookieOf(login);
  check('login admin', login.status === 200 && cookie !== '', `HTTP ${login.status}`);
  const attrs = cookie.split(';').slice(1).map((s) => s.trim().toLowerCase());
  if (mode === 'lax') {
    check('cookie SameSite=Lax', attrs.includes('samesite=lax'), attrs.join('; '));
    for (const [label, origin] of [['Origin benar', FRONTEND], ['Origin lain tetap diterima (tidak berubah)', EVIL], ['tanpa Origin tetap diterima', null]]) {
      const res = await post('/refresh', { cookie, origin });
      check(`refresh: ${label}`, res.status === 200, `HTTP ${res.status}`);
      cookie = cookieOf(res) || cookie;
    }
  } else {
    check('cookie SameSite=None; Secure', attrs.includes('samesite=none') && attrs.includes('secure'), attrs.join('; '));
    for (const [label, origin] of [['Origin lain', EVIL], ['tanpa Origin', null]]) {
      const res = await post('/refresh', { cookie, origin });
      check(`refresh ${label} ditolak 403`, res.status === 403, `HTTP ${res.status}`);
    }
    const ok = await post('/refresh', { cookie, origin: FRONTEND });
    check('refresh Origin = FRONTEND_URL diterima', ok.status === 200, `HTTP ${ok.status}`);
    cookie = cookieOf(ok) || cookie;
    const badOut = await post('/logout', { cookie, origin: EVIL });
    check('logout Origin lain ditolak 403', badOut.status === 403, `HTTP ${badOut.status}`);
    const out = await post('/logout', { cookie, origin: FRONTEND });
    const cleared = cookieOf(out).toLowerCase();
    check('logout Origin benar diterima & cookie dihapus dengan SameSite=None; Secure', out.status === 200 && cleared.includes('samesite=none') && cleared.includes('secure'), `HTTP ${out.status}`);
  }
  if (mode === 'lax') await post('/logout', { cookie, origin: FRONTEND });
} finally {
  // Tutup soket keep-alive dulu: process.exit saat soket masih menutup memicu assertion libuv di Windows.
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
process.exitCode = failed ? 1 : 0;
