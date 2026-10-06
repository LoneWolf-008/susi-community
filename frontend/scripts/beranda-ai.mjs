// Screenshot Beranda dasbor per akun (kartu "Rekomendasi AI") dengan Chromium headless — bukan suite
// E2E. Login lewat API; dua akun BARU (talenta tanpa keahlian, komunitas tanpa kebutuhan) didaftarkan
// tiap putaran, jadi jalankan di DB sekali pakai (mis. susi_community_e2e), bukan DB kerja.
// Password akun demo dibaca dari backend/.env dan tidak dicetak.
//
//   node scripts/beranda-ai.mjs [--base http://localhost:5181] [--out ../docs/screenshots] [--toggles]
//
// --toggles: matikan sementara allows_ai_personalization lalu show_in_recommendations (Nabila),
// screenshot kartunya, lalu nyalakan lagi.
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:5173');
const OUT = path.resolve(arg('out', fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))));
const TOGGLES = process.argv.includes('--toggles');
mkdirSync(OUT, { recursive: true });
const envText = readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8');
const env = (k) => envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const PASSWORD = env('SEED_USER_PASSWORD');
const NEW_PASSWORD = `Beranda-${Date.now()}`;
const stamp = Date.now().toString(36);

const ACCOUNTS = [
  { key: 'talenta-nabila', email: 'nabila@talenta.test' },
  { key: 'talenta-fajar', email: 'fajar@talenta.test' },
  { key: 'talenta-baru-tanpa-skill', register: { role: 'talent', name: 'Talenta Baru', email: `talenta.baru.${stamp}@contoh.test` } },
  { key: 'komunitas-siti', email: 'siti@umkm.test' },
  { key: 'komunitas-baru-tanpa-kebutuhan', register: { role: 'requester', name: 'Komunitas Baru', email: `komunitas.baru.${stamp}@contoh.test` } },
];

const browser = await chromium.launch();

/** Konteks baru; daftar (akun baru, sekali) atau login lewat API → cookie refresh tersimpan di konteks. */
async function login(account, viewport) {
  const context = await browser.newContext({ viewport, locale: 'id-ID' });
  const page = await context.newPage();
  const errors = [];
  // 401 dari /api/auth/refresh = cek sesi saat halaman dimuat, bukan galat aplikasi.
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url ?? '').includes('/api/auth/refresh')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const res = account.register
    ? await context.request.post(`${BASE}/api/auth/register`, { data: { ...account.register, password: NEW_PASSWORD } })
    : await context.request.post(`${BASE}/api/auth/login`, { data: { email: account.email, password: account.password || PASSWORD } });
  if (!res.ok()) throw new Error(`${account.key}: ${account.register ? 'daftar' : 'login'} gagal (${res.status()})`);
  const { data } = await res.json();
  if (account.register) {
    account.email = account.register.email;
    account.password = NEW_PASSWORD;
    delete account.register;
  }
  return { context, page, errors, user: data.user, token: data.accessToken };
}
async function settle(page, extra = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(extra); // animasi GSAP
}
const shotPath = (name) => path.join(OUT, `${name}.png`);
const squash = (s) => s.replace(/\s+/g, ' ').trim();

/** Teks kartu AI (setelah perubahan) atau bagian "Rekomendasi untuk Anda" lama (sebelum). */
async function describe(page) {
  const card = page.locator('[data-ai-card]').first();
  const legacy = page.locator('section[aria-labelledby="recs-title"]').first();
  return {
    aiCard: (await card.count()) > 0 ? squash(await card.innerText()) : null,
    rekomendasiUntukAnda: (await legacy.count()) > 0 ? squash(await legacy.innerText()) : null,
    hScroll: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
  };
}

async function capture(account, suffix = '') {
  // Desktop: layar pertama Beranda.
  const desk = await login(account, { width: 1440, height: 900 });
  await desk.page.goto(`${BASE}/dashboard`);
  await settle(desk.page);
  const info = await describe(desk.page);
  await desk.page.screenshot({ path: shotPath(`beranda-${account.key}${suffix}`) });
  // Mobile 360 px: dari atas halaman sampai akhir kartu AI (atau layar pertama bila belum ada kartu).
  const mob = await login(account, { width: 360, height: 740 });
  await mob.page.goto(`${BASE}/dashboard`);
  await settle(mob.page);
  const mobile = await describe(mob.page);
  const cardLoc = mob.page.locator('[data-ai-card]').first();
  const box = await cardLoc.boundingBox().catch(() => null);
  if (box) {
    // Viewport ditinggikan (bukan fullPage) agar nav bawah & overlay `fixed` tidak menutupi kartu.
    await mob.page.setViewportSize({ width: 360, height: Math.min(Math.ceil(box.y + box.height) + 120, 3000) });
    await mob.page.waitForTimeout(600);
    const b = await cardLoc.boundingBox();
    await mob.page.screenshot({ path: shotPath(`beranda-${account.key}${suffix}-360`), clip: { x: 0, y: 0, width: 360, height: Math.ceil(b.y + b.height + 16) } });
  } else {
    await mob.page.screenshot({ path: shotPath(`beranda-${account.key}${suffix}-360`) });
  }
  const errors = [...desk.errors, ...mob.errors];
  await desk.context.close();
  await mob.context.close();
  return { role: desk.user.role, ...info, hScroll360: mobile.hScroll, errors };
}

function report(key, r) {
  console.log(`\n${key}  (peran dari BE: ${r.role})`);
  console.log(`  "Rekomendasi untuk Anda": ${r.rekomendasiUntukAnda ? 'MUNCUL' : 'tidak ada'}`);
  if (r.rekomendasiUntukAnda) console.log(`    ${r.rekomendasiUntukAnda.slice(0, 400)}`);
  console.log(`  Kartu Rekomendasi AI: ${r.aiCard ? 'MUNCUL' : 'tidak ada'}`);
  if (r.aiCard) console.log(`    ${r.aiCard.slice(0, 600)}`);
  console.log(`  scroll horizontal 360 px: ${r.hScroll360 ? 'ADA' : 'tidak'} · galat konsol: ${r.errors.length}`);
  for (const e of r.errors.slice(0, 5)) console.log(`    ! ${e.slice(0, 200)}`);
}

let failed = false;
for (const account of ACCOUNTS) {
  try {
    const r = await capture(account);
    report(account.key, r);
    if (r.errors.length || r.hScroll360) failed = true;
  } catch (err) {
    failed = true;
    console.log(`\n${account.key}: GALAT ${err.message.split('\n')[0]}`);
  }
}

if (TOGGLES) {
  const nabila = ACCOUNTS[0];
  for (const key of ['allows_ai_personalization', 'show_in_recommendations']) {
    let s;
    const patch = (value) => s.context.request.patch(`${BASE}/api/settings`, {
      data: { [key]: value }, headers: { Authorization: `Bearer ${s.token}` },
    });
    try {
      s = await login(nabila, { width: 1440, height: 900 });
      if (!(await patch(false)).ok()) throw new Error(`PATCH ${key} gagal`);
      const r = await capture(nabila, `-${key}-mati`);
      report(`talenta-nabila (${key} = 0)`, r);
      if (r.errors.length) failed = true;
    } catch (err) {
      failed = true;
      console.log(`\n${key}: GALAT ${err.message.split('\n')[0]}`);
    } finally {
      if (s) {
        await patch(true);
        await s.context.close();
      }
    }
  }
}

await browser.close();
console.log(`\nScreenshot: ${OUT}`);
process.exit(failed ? 1 : 0);
