// Smoke browser (T16) dengan Chromium headless — bukan suite E2E. Mencetak LULUS/GAGAL dan menyimpan
// screenshot 1440×900 ke docs/screenshots/. Butuh backend + frontend berjalan dengan data demo
// (npm run demo:reset). Password akun demo dibaca dari backend/.env dan tidak dicetak.
//
//   node scripts/smoke-browser.mjs [--base http://localhost:5181]
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const i = process.argv.indexOf('--base');
const BASE = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const SHOTS = new URL('../../docs/screenshots/', import.meta.url);
mkdirSync(SHOTS, { recursive: true });
const envText = readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8');
const env = (k) => envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const DESKTOP = { width: 1440, height: 900 };

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`   ${pass ? 'LULUS' : 'GAGAL'}  ${name}${detail ? `  [${detail}]` : ''}`);
  return pass;
};
async function section(title, fn) {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (err) {
    check(`galat: ${err.message.split('\n')[0]}`, false);
  }
}

const browser = await chromium.launch();

/** Konteks baru (cookie kosong); login lewat API → cookie refresh tersimpan di konteks. */
async function session(email, password = env('SEED_USER_PASSWORD')) {
  const context = await browser.newContext({ viewport: DESKTOP, locale: 'id-ID' });
  const page = await context.newPage();
  const errors = [];
  // 401 dari /api/auth/refresh = pengunjung tanpa sesi (cek sesi saat halaman dimuat), bukan galat aplikasi.
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url ?? '').includes('/api/auth/refresh')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  if (email) {
    const res = await context.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
    if (!res.ok()) throw new Error(`login ${email} gagal (${res.status()})`);
  }
  return { context, page, errors };
}
async function settle(page, extra = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(extra); // animasi GSAP
}
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, SHOTS)) });
async function openTab(page, label) {
  await page.locator('aside button', { hasText: label }).first().click();
  await settle(page, 800);
}
async function askChat(page, question) {
  const launcher = page.getByRole('button', { name: /Buka Tanya SUSI/ });
  if (await launcher.isVisible()) await launcher.click();
  const input = page.getByPlaceholder(/Ketik pertanyaan|Tulis pesan untuk AgenSUSI/);
  await input.fill(question);
  await input.press('Enter');
}

// Kode sertifikat terbit (seed) diambil lewat API admin.
let certCode = null;
{
  const { context } = await session(env('ADMIN_EMAIL'), env('ADMIN_PASSWORD'));
  const login = await context.request.post(`${BASE}/api/auth/login`, { data: { email: env('ADMIN_EMAIL'), password: env('ADMIN_PASSWORD') } });
  const token = (await login.json()).data.accessToken;
  const certs = await context.request.get(`${BASE}/api/admin/certifications?status=APPROVED&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  certCode = (await certs.json()).data.items[0]?.certificate?.code;
  await context.close();
}

try {
  await section('Landing', async () => {
    const { context, page, errors } = await session(null);
    await page.goto(`${BASE}/`);
    await settle(page);
    check('landing tampil tanpa galat konsol', errors.length === 0, errors[0] ?? '');
    await shot(page, '01-landing');
    await context.close();
  });

  await section('Dasbor komunitas & peta (Ibu Siti)', async () => {
    const { context, page, errors } = await session('siti@umkm.test');
    const tiles = { ok: 0, failed: [] };
    page.on('response', (r) => { if (r.url().includes('tiles.openfreemap.org')) (r.ok() ? tiles.ok += 1 : tiles.failed.push(`${r.status()} ${r.url()}`)); });
    page.on('requestfailed', (r) => { if (r.url().includes('tiles.openfreemap.org')) tiles.failed.push(`${r.failure()?.errorText} ${r.url()}`); });
    await page.goto(`${BASE}/dashboard`);
    await settle(page);
    check('dasbor komunitas tampil', await page.getByText('Ibu Siti', { exact: false }).first().isVisible().catch(() => false) || page.url().endsWith('/dashboard'));
    await shot(page, '02-dasbor-komunitas');
    await openTab(page, 'Komunitas & Peta');
    await page.locator('.maplibregl-canvas').first().waitFor({ timeout: 15000 });
    await settle(page, 2500);
    const canvasBox = await page.locator('.maplibregl-canvas').first().boundingBox();
    const mapBox = await page.locator('.susi-map [role=region]').first().boundingBox();
    check('canvas MapLibre muncul dan terlihat (bukan setinggi 0)', Boolean(canvasBox && mapBox) && mapBox.height > 200 && canvasBox.height > 200,
      `wadah ${Math.round(mapBox?.height ?? 0)} px, canvas ${Math.round(canvasBox?.height ?? 0)} px`);
    check('tile OpenFreeMap termuat tanpa request gagal', tiles.ok > 0 && tiles.failed.length === 0, `${tiles.ok} ok, ${tiles.failed.length} gagal`);
    const markers = await page.locator('.susi-marker').count();
    check('marker tampil', markers > 0, `${markers} marker`);
    await page.locator('.susi-marker--own').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    check('klik marker → popup + "Rute di Google Maps"', await page.locator('.maplibregl-popup a', { hasText: 'RUTE DI GOOGLE MAPS' }).isVisible());
    check('tanpa galat konsol di halaman peta', errors.length === 0, errors[0] ?? '');
    await shot(page, '06-peta');
    // Kartu talenta di Tanya SUSI (pemilik): "Lihat" membuka kebutuhan, "Undang" mengirim undangan.
    await askChat(page, 'talenta mana yang cocok untuk kebutuhan saya?');
    const talentCards = page.locator('ul[aria-label="Rekomendasi"] li', { has: page.getByRole('button', { name: 'Lihat' }) });
    await talentCards.first().waitFor({ timeout: 15000 });
    check('chat: kartu talenta tampil', await talentCards.count() > 0, `${await talentCards.count()} kartu`);
    const needTitle = (await talentCards.first().locator('p', { hasText: 'UNTUK:' }).innerText()).replace('UNTUK:', '').trim();
    // Kartu talenta yang belum melamar/diundang punya tombol "Undang".
    // Kunci kartu lewat urutan: setelah diklik, tombol "Undang" berganti "✓ Diundang".
    const cardsWithInvite = await talentCards.evaluateAll((els) => els.map((el) => [...el.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Undang')));
    const inviteIndex = cardsWithInvite.indexOf(true);
    const invitable = talentCards.nth(Math.max(inviteIndex, 0));
    if (inviteIndex >= 0) {
      const who = (await invitable.locator('p').first().innerText()).trim();
      await invitable.getByRole('button', { name: 'Undang' }).click();
      await page.waitForTimeout(1200);
      check('"Undang" → undangan terkirim (✓ Diundang)', await invitable.getByText('✓ Diundang').isVisible(), who);
    } else {
      check('ada kartu talenta yang bisa diundang', false, 'semua sudah melamar/diundang');
    }
    await talentCards.first().getByRole('button', { name: 'Lihat' }).click();
    await settle(page, 1000);
    check('"Lihat" membuka detail kebutuhan yang benar', await page.getByRole('heading', { name: needTitle }).first().isVisible().catch(() => false), needTitle);
    await context.close();
  });

  await section('Dasbor talenta, kartu chat, dan AgenSUSI (Nabila)', async () => {
    const { context, page, errors } = await session('nabila@talenta.test');
    await page.goto(`${BASE}/dashboard`);
    await settle(page);
    check('rekomendasi tampil di dasbor talenta', await page.getByText('Rekomendasi untuk Anda', { exact: false }).first().isVisible());
    await shot(page, '03-dasbor-talenta-rekomendasi');
    await askChat(page, 'proyek apa yang cocok buat aku?');
    const needCards = page.locator('ul[aria-label="Rekomendasi"] li', { has: page.getByRole('button', { name: /Lihat & lamar/ }) });
    await needCards.first().waitFor({ timeout: 15000 });
    check('chat: kartu kebutuhan tampil', await needCards.count() > 0, `${await needCards.count()} kartu`);
    await page.waitForTimeout(500);
    await shot(page, '04-chat-kartu');
    const title = (await needCards.first().locator('p').first().innerText()).trim();
    await needCards.first().getByRole('button', { name: /Lihat & lamar/ }).click();
    await settle(page, 1000);
    check('"Lihat & lamar" membuka detail kebutuhan yang benar', await page.getByRole('heading', { name: title }).first().isVisible().catch(() => false), title);
    // Tawaran AgenSUSI → Ruang AgenSUSI di widget.
    await askChat(page, 'apakah ada aplikasi android susi di play store?');
    await page.getByText('Lanjutkan dengan AgenSUSI?').waitFor({ timeout: 15000 });
    check('kartu "Lanjutkan dengan AgenSUSI?" tampil', true);
    await page.getByRole('button', { name: /YA, HUBUNGKAN/ }).click();
    await page.getByRole('heading', { name: 'Ruang AgenSUSI' }).waitFor({ timeout: 15000 });
    check('Ruang AgenSUSI tampil (AI dijeda)', await page.getByText('AI DIJEDA').first().isVisible());
    check('catatan "Pesan ke AgenSUSI tetap disimpan…" tampil', await page.getByText('Pesan ke AgenSUSI tetap disimpan agar agen dapat membacanya.', { exact: false }).isVisible());
    check('tanpa galat konsol (dasbor talenta & chat)', errors.length === 0, errors[0] ?? '');
    await context.close();
  });

  await section('Ruang AgenSUSI halaman penuh (Ibu Siti, tiket seed)', async () => {
    const { context, page, errors } = await session('siti@umkm.test');
    await page.goto(`${BASE}/dashboard/ruang-agen?tiket=1`);
    await settle(page);
    check('/dashboard/ruang-agen terbuka dengan percakapan agen', await page.getByRole('heading', { name: 'Ruang AgenSUSI' }).isVisible() && await page.getByText('Budi Santoso').first().isVisible());
    check('tanpa galat konsol', errors.length === 0, errors[0] ?? '');
    await shot(page, '05-ruang-agensusi');
    await context.close();
  });

  await section('Sertifikat: verifikasi publik (konteks baru tanpa cookie) & tampilan cetak', async () => {
    const { context, page, errors } = await session(null);
    check('konteks baru tanpa cookie', (await context.cookies()).length === 0);
    await page.goto(`${BASE}/verifikasi/${certCode}`);
    await settle(page, 800);
    check('/verifikasi/:code valid tanpa login', await page.getByRole('heading', { name: 'Sertifikat berlaku' }).isVisible(), certCode);
    await page.goto(`${BASE}/sertifikat/${certCode}`);
    await settle(page, 800);
    await page.emulateMedia({ media: 'print' });
    const box = await page.locator('.certificate-sheet').boundingBox();
    const toolbarHidden = !(await page.locator('.no-print').first().isVisible());
    // 297 × 210 mm pada 96 dpi ≈ 1123 × 794 px.
    check('/sertifikat/:code media print: lembar A4 lanskap, tombol disembunyikan', Boolean(box) && Math.abs(box.width - 1123) < 4 && Math.abs(box.height - 794) < 4 && toolbarHidden, box ? `${Math.round(box.width)}×${Math.round(box.height)} px` : 'tidak ada');
    check('tanpa galat konsol', errors.length === 0, errors[0] ?? '');
    await shot(page, '07-sertifikat-cetak');
    await context.close();
  });
} finally {
  await browser.close();
}

const failed = results.filter((x) => !x).length;
console.log(failed ? `\nHASIL: ${failed} dari ${results.length} cek GAGAL` : `\nHASIL: semua ${results.length} cek LULUS`);
process.exit(failed ? 1 : 0);
