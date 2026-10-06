// Audit tampilan mobile (U3): buka semua rute (dan tab dasbor tiap peran) di 360×740 dengan Chromium
// headless, catat halaman yang bisa digulir ke samping, elemen yang melewati tepi kanan layar (sering
// tersembunyi oleh overflow-x-hidden), dan elemen interaktif < 40 px.
//
//   node scripts/audit-mobile.mjs [--base http://localhost:5173] [--out audit.json]
// Butuh backend (proxy /api) dan frontend berjalan. Login lewat API: password akun demo dari
// backend/.env (SEED_USER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD), tidak pernah dicetak.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:5173');
const OUT = arg('out', null);
const envText = readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8');
const env = (k) => envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const VIEWPORT = { width: 360, height: 740 };
const MIN_TARGET = 40;

const ROLES = {
  publik: { email: null, routes: ['/', '/tentang', '/masuk', '/admin', '/verifikasi/{code}', '/sertifikat/{code}', '/tidak-ada'] },
  komunitas: { email: 'siti@umkm.test', routes: ['/dashboard', '/ajukan', '/dashboard/ruang-agen', '/dashboard/ruang-agen?tiket=1'] },
  talenta: { email: 'dewi@talenta.test', routes: ['/dashboard', '/dashboard/ruang-agen'] },
  agensusi: { email: 'budi@susi.test', routes: ['/dashboard'] },
  admin: { email: env('ADMIN_EMAIL'), password: env('ADMIN_PASSWORD'), routes: ['/dashboard'] },
};

// Diukur di halaman: scroll samping dokumen, elemen yang keluar dari layar (bukan di dalam wadah
// scroll-x sendiri), dan target sentuh kecil.
function measure(minTarget) {
  const vw = window.innerWidth;
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : '';
    const text = (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el, r) => r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden';
  // Wadah yang menggulir/memotong sendiri dan muat di layar = disengaja (mis. bilah tab, kartu
  // overflow-hidden berhias). Div akar aplikasi (overflow-x-hidden) tidak dihitung: di level halaman,
  // ia justru menyembunyikan konten yang terpotong di tepi layar.
  const root = document.querySelector('#root > div');
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== root; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX) && p.scrollWidth > p.clientWidth + 1) {
        return p.getBoundingClientRect().right <= vw + 1; // wadahnya sendiri muat layar → disengaja
      }
    }
    return false;
  };
  const offenders = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    // Lewati: dekorasi tetap tanpa interaksi (noise-overlay) dan panel off-canvas yang sepenuhnya di luar layar.
    if (!visible(el, r) || r.right <= vw + 1 || r.left >= vw - 1 || (st.position === 'fixed' && st.pointerEvents === 'none')) continue;
    if (inScroller(el)) continue;
    // Hanya elemen terluar yang melewati tepi (anaknya ikut melewati).
    if (el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1 && !inScroller(el.parentElement)) continue;
    offenders.push(`${describe(el)} (kanan ${Math.round(r.right)}px)`);
  }
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=radio], summary')) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r) || el.closest('.sr-only, [aria-hidden="true"]')) continue;
    if (r.width < minTarget || r.height < minTarget) small.push(`${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')]
    .filter((el) => { const r = el.getBoundingClientRect(); return visible(el, r); })
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${describe(el)} ${getComputedStyle(el).fontSize}`);
  return {
    hScroll: document.documentElement.scrollWidth > vw + 1,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: offenders.slice(0, 6),
    offenderCount: offenders.length,
    smallCount: small.length,
    smallSample: small.slice(0, 5),
    smallAll: small,
    smallInputs: inputs.slice(0, 5),
    smallInputCount: inputs.length,
  };
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900); // animasi gsap & transisi rute
}

async function audit(page, label) {
  await settle(page);
  return { page: label, ...(await page.evaluate(measure, MIN_TARGET)) };
}

/** Tab dasbor = tombol navigasi (bilah mobile/drawer) yang terlihat; Ruang AgenSUSI diaudit sebagai rute. */
async function dashboardTabs(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-dash-nav] [data-tab]')]
    .map((b) => b.dataset.tab.trim()).filter((t, i, all) => t && all.indexOf(t) === i));
}

const browser = await chromium.launch();
const results = [];
let certCode = 'SUSI-0000-0000';
{
  // Kode sertifikat terbit (untuk /verifikasi & /sertifikat), diambil sebagai admin.
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: env('ADMIN_EMAIL'), password: env('ADMIN_PASSWORD') } });
  const token = (await res.json()).data?.accessToken;
  const certs = await ctx.request.get(`${BASE}/api/admin/certifications?status=APPROVED&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  certCode = (await certs.json()).data?.items?.[0]?.certificate?.code ?? certCode;
  await ctx.close();
}
try {
  for (const [role, def] of Object.entries(ROLES)) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID' });
    const page = await context.newPage();
    if (def.email) {
      const res = await context.request.post(`${BASE}/api/auth/login`, { data: { email: def.email, password: def.password ?? env('SEED_USER_PASSWORD') } });
      if (!res.ok()) throw new Error(`Login ${role} gagal: ${res.status()}`);
    }
    for (const route of def.routes) {
      const path = route.replace('{code}', certCode);
      await page.goto(`${BASE}${path}`);
      results.push({ role, ...(await audit(page, path)) });
      if (path === '/dashboard') {
        for (const tab of await dashboardTabs(page)) {
          if (/ruang agensusi/i.test(tab)) continue;
          const locate = () => page.locator(`[data-dash-nav] [data-tab="${tab}"]`).filter({ visible: true }).first();
          // Tab yang tidak ada di bilah bawah dibuka lewat drawer ("Menu").
          if (await locate().count() === 0) {
            const menu = page.locator('[data-dash-menu]').filter({ visible: true }).first();
            if (await menu.count() > 0) await menu.click();
          }
          if (await locate().count() === 0) continue;
          await locate().click();
          // Drawer menutup sendiri setelah memilih tab.
          results.push({ role, ...(await audit(page, `/dashboard · ${tab}`)) });
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.hScroll || r.offenderCount > 0);
console.log(`Diaudit ${results.length} halaman di ${VIEWPORT.width}×${VIEWPORT.height}.`);
console.log(`Scroll horizontal: ${results.filter((r) => r.hScroll).length} · elemen melewati tepi kanan: ${bad.length} halaman · target < ${MIN_TARGET}px: ${results.reduce((s, r) => s + r.smallCount, 0)} · input < 16px: ${results.reduce((s, r) => s + r.smallInputCount, 0)}`);
for (const r of results) {
  const flag = r.hScroll ? 'SCROLL-X' : r.offenderCount ? 'KELUAR-TEPI' : 'ok';
  console.log(`${flag.padEnd(11)} ${r.role.padEnd(9)} ${r.page.padEnd(34)} target<${MIN_TARGET}: ${String(r.smallCount).padStart(3)}  input<16: ${r.smallInputCount}`);
  for (const o of r.offenders.slice(0, 3)) console.log(`            ↳ ${o}`);
}
