// Verifikasi paket cPanel tanpa browser (setelah `npm run pack:cpanel`). Dijalankan dari folder backend
// dengan .env lokal (koneksi root MySQL & ADMIN_EMAIL/ADMIN_PASSWORD; password tidak pernah dicetak).
//  1. install.sql diimpor ke DB kosong → dibandingkan dengan DB hasil `db:init` (tabel, view, migrasi),
//     plus data referensi (KB, keahlian) dan tanpa data demo.
//  2. Admin dibuat dari keluaran make-admin-sql.
//  3. Server dari FOLDER PAKET dimuat seperti Passenger (require('./app.cjs')) dengan NODE_ENV=production,
//     SERVE_FRONTEND=true, LLM mock, dan user MySQL sementara berpassword (production mewajibkannya).
//  4. Cek HTTP: / & /dashboard → index.html (no-cache), aset ber-hash 200 (immutable), /api/health 200,
//     /api/tidak-ada 404 JSON, berkas tidak ada 404, header CSP, login → refresh → logout dengan cookie.
// Semua DB & user sementara dihapus di akhir.
//
//   node scripts/verify-cpanel-pack.mjs
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(BACKEND, '..', 'dist-cpanel', 'susi-app');
const PACK_BACKEND = path.join(APP, 'backend');
const DB_INSTALL = 'susi_cpanel_verify_install';
const DB_INIT = 'susi_cpanel_verify_init';
const DB_USER = 'susi_cpanel_verify';
const DB_PASS = crypto.randomBytes(18).toString('hex');
const PORT = 3029;
const BASE = `http://127.0.0.1:${PORT}`;

if (!fs.existsSync(path.join(APP, 'db', 'install.sql'))) {
  console.error('Paket belum ada: jalankan `npm run pack:cpanel` dulu.');
  process.exit(2);
}

let failed = 0;
const check = (label, ok, note = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${note ? `  (${note})` : ''}`);
};
const rootConn = (database) => mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '', database, multipleStatements: true, charset: 'utf8mb4_unicode_ci',
});

async function describe(conn) {
  const [tables] = await conn.query(`SELECT table_name AS n, table_type AS t FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name`);
  const out = {};
  for (const { n, t } of tables) {
    if (t === 'VIEW') {
      const [[row]] = await conn.query(`SELECT view_definition AS d, DATABASE() AS db FROM information_schema.views WHERE table_schema = DATABASE() AND table_name = ?`, [n]);
      out[n] = `VIEW ${row.d.split(`\`${row.db}\`.`).join('')}`; // definisi view memuat nama DB-nya sendiri
    } else {
      const [[row]] = await conn.query(`SHOW CREATE TABLE \`${n}\``);
      out[n] = row['Create Table'].replace(/ AUTO_INCREMENT=\d+/, '');
    }
  }
  return out;
}

let server = null;
const junction = path.join(PACK_BACKEND, 'node_modules');
const admin = await rootConn();
try {
  console.log('\n[1] install.sql vs db:init');
  await admin.query(`DROP DATABASE IF EXISTS ${DB_INSTALL}; DROP DATABASE IF EXISTS ${DB_INIT};
    CREATE DATABASE ${DB_INSTALL} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  const installConn = await rootConn(DB_INSTALL);
  await installConn.query(fs.readFileSync(path.join(APP, 'db', 'install.sql'), 'utf8'));
  const init = spawnSync(process.execPath, ['utils/migrate.js', 'init'], { cwd: BACKEND, env: { ...process.env, DB_NAME: DB_INIT }, encoding: 'utf8' });
  check('db:init pada DB pembanding', init.status === 0, init.status === 0 ? '' : init.stderr.slice(0, 200));
  const initConn = await rootConn(DB_INIT);
  const [a, b] = [await describe(installConn), await describe(initConn)];
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const diff = names.filter((n) => a[n] !== b[n]);
  check(`struktur sama dengan db:init (${Object.keys(a).length} tabel/view)`, diff.length === 0, diff.join(', '));
  const [[ma]] = await installConn.query(`SELECT COUNT(*) n, GROUP_CONCAT(CONCAT(name, checksum) ORDER BY name) s FROM schema_migrations`);
  const [[mb]] = await initConn.query(`SELECT COUNT(*) n, GROUP_CONCAT(CONCAT(name, checksum) ORDER BY name) s FROM schema_migrations`);
  check(`schema_migrations sama (${ma.n} baris)`, ma.s === mb.s);
  const status = spawnSync(process.execPath, ['utils/migrate.js', 'migrate'], { cwd: BACKEND, env: { ...process.env, DB_NAME: DB_INSTALL }, encoding: 'utf8' });
  check('db:migrate setelah impor: tidak ada migrasi tertunda', status.status === 0 && /Tidak ada migrasi tertunda/.test(status.stdout));
  const [[ref]] = await installConn.query(`SELECT (SELECT COUNT(*) FROM kb_entries WHERE status = 'active') kb, (SELECT COUNT(*) FROM skills) skills,
    (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM communities) comms, (SELECT COUNT(*) FROM needs) needs`);
  check('data referensi ada, tanpa data demo', ref.kb > 0 && ref.skills > 0 && ref.users === 0 && ref.comms === 0 && ref.needs === 0,
    `KB aktif ${ref.kb}, keahlian ${ref.skills}, pengguna ${ref.users}, komunitas ${ref.comms}, kebutuhan ${ref.needs}`);
  await initConn.end();

  console.log('\n[2] make-admin-sql');
  const adminSql = spawnSync(process.execPath, ['scripts/make-admin-sql.mjs'], { cwd: BACKEND, encoding: 'utf8' });
  check('make-admin-sql menghasilkan INSERT tanpa password mentah', adminSql.status === 0 && /INSERT IGNORE INTO users/.test(adminSql.stdout)
    && !adminSql.stdout.includes(process.env.ADMIN_PASSWORD));
  await installConn.query(adminSql.stdout);
  await installConn.query(adminSql.stdout); // dijalankan ulang: aman (INSERT IGNORE)
  const [[admins]] = await installConn.query(`SELECT COUNT(*) n FROM users WHERE role = 'admin'`);
  check('admin dibuat sekali (aman dijalankan ulang)', admins.n === 1);
  await installConn.end();

  console.log('\n[3] server produksi dari folder paket (seperti Passenger)');
  await admin.query(`DROP USER IF EXISTS '${DB_USER}'@'localhost'; CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
    GRANT ALL PRIVILEGES ON ${DB_INSTALL}.* TO '${DB_USER}'@'localhost';`);
  if (!fs.existsSync(junction)) fs.symlinkSync(path.join(BACKEND, 'node_modules'), junction, 'junction');
  const env = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    NODE_ENV: 'production', SERVE_FRONTEND: 'true', PORT: String(PORT),
    DB_HOST: '127.0.0.1', DB_PORT: String(process.env.DB_PORT || 3306), DB_USER, DB_PASSWORD: DB_PASS, DB_NAME: DB_INSTALL,
    JWT_ACCESS_SECRET: crypto.randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    FRONTEND_URL: BASE, COOKIE_SAMESITE: 'lax', LLM_PROVIDER: 'mock', CHATBOT_DAILY_BUDGET_USD: '0.25', TRUST_PROXY: '1',
  };
  server = spawn(process.execPath, ['-e', "require('./app.cjs')"], { cwd: PACK_BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  server.stdout.on('data', (d) => { logs += d; });
  server.stderr.on('data', (d) => { logs += d; });
  let up = false;
  for (let i = 0; i < 40 && !up; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
    up = await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false);
  }
  check('server start via require(app.cjs)', up, up ? '' : logs.slice(-300));
  if (!up) throw new Error('server tidak start');

  console.log('\n[4] cek HTTP');
  const home = await fetch(`${BASE}/`);
  const html = await home.text();
  check('/ → index.html, no-cache', home.status === 200 && /<div id="root">/.test(html) && /no-cache/.test(home.headers.get('cache-control') ?? ''),
    `${home.status} ${home.headers.get('cache-control')}`);
  check('/ memuat header CSP', /default-src 'self'/.test(home.headers.get('content-security-policy') ?? ''));
  const deep = await fetch(`${BASE}/dashboard`);
  check('/dashboard (muat ulang rute dalam) → index.html', deep.status === 200 && (await deep.text()) === html);
  const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
  const assetRes = asset ? await fetch(`${BASE}${asset}`) : null;
  check('aset ber-hash 200, cache panjang immutable', assetRes?.status === 200 && /max-age=31536000/.test(assetRes.headers.get('cache-control') ?? '')
    && /immutable/.test(assetRes.headers.get('cache-control') ?? ''), `${asset} ${assetRes?.headers.get('cache-control')}`);
  const health = await fetch(`${BASE}/api/health`);
  check('/api/health 200 JSON', health.status === 200 && (await health.json()).status === 'OK');
  const missingApi = await fetch(`${BASE}/api/tidak-ada`);
  const missingBody = await missingApi.json().catch(() => null);
  check('/api/tidak-ada → 404 JSON', missingApi.status === 404 && Boolean(missingBody?.error?.message));
  const missingFile = await fetch(`${BASE}/tidak-ada.png`);
  check('/tidak-ada.png → 404 (bukan index.html)', missingFile.status === 404);

  const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('susi_refresh_token=')) ?? '';
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  const cookie = cookieOf(login);
  check('login admin → cookie refresh HttpOnly; Secure; SameSite=Lax', login.status === 200 && /HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=Lax/i.test(cookie),
    `HTTP ${login.status}`);
  const send = (p, c) => fetch(`${BASE}/api/auth/${p}`, { method: 'POST', headers: { Cookie: c.split(';')[0] } });
  const refresh = await send('refresh', cookie);
  const cookie2 = cookieOf(refresh);
  check('refresh dengan cookie → 200 + cookie baru (rotasi)', refresh.status === 200 && cookie2 !== '' && cookie2 !== cookie, `HTTP ${refresh.status}`);
  const logout = await send('logout', cookie2);
  check('logout → 200', logout.status === 200);
  const after = await send('refresh', cookie2);
  check('refresh setelah logout → 401', after.status === 401, `HTTP ${after.status}`);

  // Opsional: CSP hanya bisa diuji di browser. Chromium headless (Playwright dari frontend/node_modules)
  // membuka / dan /tentang (font Google, peta OpenFreeMap + worker) dan menghitung pelanggaran CSP.
  if (process.argv.includes('--browser')) {
    console.log('\n[5] browser headless: CSP & aset');
    const { chromium } = await import(new URL('../../frontend/node_modules/playwright/index.mjs', import.meta.url).href);
    const browser = await chromium.launch();
    try {
      for (const route of ['/', '/tentang']) {
        const page = await browser.newPage();
        const problems = [];
        page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text().slice(0, 140)); });
        page.on('requestfailed', (r) => { if (!/\/api\/auth\/refresh/.test(r.url())) problems.push(`gagal: ${r.url().slice(0, 100)}`); });
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
        if (route === '/tentang') {
          // Peta dimuat malas saat bagiannya terlihat: gulir bertahap sampai bawah.
          for (let y = 0; y < 12; y += 1) {
            await page.mouse.wheel(0, 700);
            await page.waitForTimeout(250);
          }
          await page.locator('.maplibregl-canvas').first().waitFor({ timeout: 15000 }).catch(() => problems.push('kanvas peta tidak muncul'));
        }
        await page.waitForTimeout(1500);
        check(`${route}: tanpa pelanggaran CSP / aset gagal`, problems.length === 0, problems.slice(0, 3).join(' | '));
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  if (server) server.kill();
  if (fs.existsSync(junction)) fs.rmdirSync(junction); // hanya link junction, isi node_modules tidak tersentuh
  await admin.query(`DROP DATABASE IF EXISTS ${DB_INSTALL}; DROP DATABASE IF EXISTS ${DB_INIT}; DROP USER IF EXISTS '${DB_USER}'@'localhost';`);
  await admin.end();
}
console.log(failed ? `\nHASIL: ${failed} GAGAL` : '\nHASIL: semua cek paket cPanel LULUS');
process.exitCode = failed ? 1 : 0;
