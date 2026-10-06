// Paket deploy cPanel (Setup Node.js App, satu origin). Menghasilkan ../dist-cpanel/susi-app/ dan
// ../dist-cpanel/susi-app.zip berisi:
//   backend/        kode server tanpa node_modules, .env, uploads, test, dan seed/skrip demo;
//                   package.json produksi (tanpa devDependencies & skrip perusak DB); startup file app.cjs
//   frontend/dist/  hasil build frontend saja (bukan kode sumbernya); VITE_API_URL dikosongkan → /api
//   db/install.sql  skema + migrasi + data referensi, untuk diimpor lewat phpMyAdmin (tanpa data demo)
//   DEPLOY-CPANEL.md
//
//   npm run pack:cpanel                 (build frontend dulu)
//   npm run pack:cpanel -- --no-build   (pakai frontend/dist yang sudah ada)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildInstallSql } from './build-install-sql.mjs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(BACKEND, '..');
const OUT_DIR = path.join(ROOT, 'dist-cpanel');
const APP = path.join(OUT_DIR, 'susi-app');

// Relatif terhadap backend/ (pemisah '/'). Direktori berakhiran '/'.
const EXCLUDE = new Set([
  'node_modules/', 'uploads/', 'tests/', 'coverage/', '.env', 'vitest.config.js',
  'db/seeds/demo.js', 'utils/seed.js',
  'scripts/demo-login.mjs', 'scripts/smoke-api.mjs', 'scripts/personal-live.mjs', 'scripts/failure-paths-live.mjs',
  'scripts/check-cookie.mjs', 'scripts/check-bcrypt-compat.mjs', 'scripts/pack-cpanel.mjs', 'scripts/build-install-sql.mjs',
  'scripts/verify-cpanel-pack.mjs',
]);
const excluded = (rel, isDir) => EXCLUDE.has(isDir ? `${rel}/` : rel) || (!isDir && /^\.env\./.test(path.basename(rel)) && rel !== '.env.example');

function copyBackend(src, dest, rel = '') {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (excluded(childRel, entry.isDirectory())) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyBackend(from, to, childRel);
    else fs.copyFileSync(from, to);
  }
}

const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} gagal (kode ${res.status})`);
};

// 1. Build frontend (satu origin: API di /api yang sama).
const frontendDir = path.join(ROOT, 'frontend');
if (!process.argv.includes('--no-build')) {
  console.log('[pack] build frontend (VITE_API_URL kosong → /api)…');
  run('npm', ['run', 'build'], { cwd: frontendDir, env: { ...process.env, VITE_API_URL: '' } });
}
const dist = path.join(frontendDir, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('frontend/dist/index.html tidak ada; jalankan tanpa --no-build');

// 2. Folder paket bersih.
fs.rmSync(OUT_DIR, { recursive: true, force: true });
copyBackend(BACKEND, path.join(APP, 'backend'));
fs.cpSync(dist, path.join(APP, 'frontend', 'dist'), { recursive: true });

// 3. package.json produksi: dependensi runtime saja, skrip aman.
const pkg = JSON.parse(fs.readFileSync(path.join(BACKEND, 'package.json'), 'utf8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  type: pkg.type,
  main: 'app.cjs',
  engines: pkg.engines,
  scripts: {
    start: 'node app.cjs',
    'db:status': 'node utils/migrate.js status',
    'db:migrate': 'node utils/migrate.js migrate',
    'make-admin-sql': 'node scripts/make-admin-sql.mjs',
  },
  dependencies: pkg.dependencies,
};
fs.writeFileSync(path.join(APP, 'backend', 'package.json'), `${JSON.stringify(prodPkg, null, 2)}\n`);

// 4. install.sql + panduan.
fs.mkdirSync(path.join(APP, 'db'), { recursive: true });
fs.writeFileSync(path.join(APP, 'db', 'install.sql'), await buildInstallSql());
const guide = path.join(ROOT, 'docs', 'DEPLOY-CPANEL.md');
if (fs.existsSync(guide)) fs.copyFileSync(guide, path.join(APP, 'DEPLOY-CPANEL.md'));

// 5. Pengaman: tidak boleh ada .env, node_modules, atau seed demo di paket.
const leaks = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === 'node_modules' || e.name === '.env' || e.name === 'demo.js' || e.name === 'seed.js') leaks.push(path.relative(APP, p));
    if (e.isDirectory() && e.name !== 'node_modules') walk(p);
  }
};
walk(APP);
if (leaks.length) throw new Error(`Paket memuat berkas terlarang: ${leaks.join(', ')}`);

// 6. Zip (Windows: Compress-Archive; lainnya: zip bila tersedia).
const zip = path.join(OUT_DIR, 'susi-app.zip');
const zipped = process.platform === 'win32'
  ? spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${APP}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' })
  : spawnSync('zip', ['-rq', zip, 'susi-app'], { cwd: OUT_DIR, stdio: 'inherit' });
const size = (p) => `${Math.round(fs.statSync(p).size / 1024)} KB`;
console.log(`[pack] folder: ${path.relative(ROOT, APP)}`);
console.log(zipped.status === 0 && fs.existsSync(zip)
  ? `[pack] zip: ${path.relative(ROOT, zip)} (${size(zip)})`
  : '[pack] zip tidak dibuat (alat zip tidak tersedia); unggah foldernya atau kompres manual');
