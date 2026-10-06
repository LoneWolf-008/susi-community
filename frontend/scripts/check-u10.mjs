// Cek U10 (Beranda Komunitas, bilah bawah mobile, panel notifikasi mobile) dengan Chromium headless.
// Mencetak LULUS/GAGAL per butir dan menyimpan screenshot ke docs/screenshots/u10-*.png.
//
//   node scripts/check-u10.mjs --base http://localhost:5181
// Butuh backend (proxy /api) & frontend berjalan dengan data seed. Membuat akun komunitas baru (untuk
// Beranda kosong), jadi --base WAJIB diisi dan harus menunjuk stack dengan DB sekali pakai, bukan server
// dev yang memakai DB kerja. Password dari backend/.env, tidak dicetak.
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const i = process.argv.indexOf('--base');
if (i < 0 || !process.argv[i + 1]) {
  console.error('Wajib: --base <url> ke stack ber-DB sekali pakai (skrip ini membuat akun uji).');
  process.exit(2);
}
const BASE = process.argv[i + 1];
const envText = readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8');
const env = (k) => envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const SHOTS = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const MOBILE = { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID' };
const DESKTOP = { viewport: { width: 1440, height: 900 }, locale: 'id-ID' };

let failed = 0;
const check = (label, ok, note = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${note ? `  (${note})` : ''}`);
};
const settle = (page, ms = 1200) => page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}).then(() => page.waitForTimeout(ms));
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const browser = await chromium.launch();
async function open(device, login) {
  const context = await browser.newContext(device);
  if (login.register) {
    const res = await context.request.post(`${BASE}/api/auth/register`, { data: login.register });
    if (!res.ok()) throw new Error(`register gagal: ${res.status()}`);
  } else {
    const res = await context.request.post(`${BASE}/api/auth/login`, { data: { email: login.email, password: login.password ?? env('SEED_USER_PASSWORD') } });
    if (!res.ok()) throw new Error(`login ${login.email} gagal: ${res.status()}`);
  }
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`);
  await settle(page, 1800);
  return { context, page };
}
const createButtons = (page) => page.getByRole('button', { name: /Ajukan Kebutuhan/ }).filter({ visible: true });
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

try {
  const fresh = { name: 'Komunitas Uji U10', email: `u10.${Date.now().toString(36)}@e2e.test`, password: env('SEED_USER_PASSWORD'), role: 'requester' };

  for (const [label, device] of [['360', MOBILE], ['1440', DESKTOP]]) {
    console.log(`\n[Beranda kosong · ${label}]`);
    const { context, page } = await open(device, { register: { ...fresh, email: fresh.email.replace('@', `.${label}@`) } });
    check('tepat 1 tombol "Ajukan Kebutuhan"', await createButtons(page).count() === 1, `${await createButtons(page).count()}`);
    check('kartu sapaan tunggal (eyebrow, judul, 3 langkah)', await page.locator('[data-beranda="kosong"]').count() === 1
      && await page.locator('[data-beranda="kosong"] ol li').count() === 3 && /DASBOR KOMUNITAS/i.test(await page.locator('[data-beranda="kosong"]').innerText()));
    check('tanpa kartu "Belum ada kebutuhan" & tanpa kartu Rekomendasi AI', await page.getByText('Belum ada kebutuhan').count() === 0
      && await page.getByText('Talenta untuk kebutuhan Anda').count() === 0);
    check('0 scroll horizontal', await noHScroll(page));
    if (label === '360') {
      const fab = await page.locator('.chat-launcher').boundingBox();
      const cta = await createButtons(page).first().boundingBox();
      check('peluncur AI tidak menutupi tombol utama', !overlap(fab, cta));
    }
    await page.screenshot({ path: `${SHOTS}u10-beranda-kosong-${label}.png`, fullPage: true });
    await context.close();
  }

  for (const [label, device] of [['360', MOBILE], ['1440', DESKTOP]]) {
    console.log(`\n[Beranda berisi (Siti) · ${label}]`);
    const { context, page } = await open(device, { email: 'siti@umkm.test' });
    const buttons = createButtons(page);
    const cls = (await buttons.count()) === 1 ? await buttons.first().getAttribute('class') : '';
    check('tombol ajukan sekunder (1, gaya ghost, bukan merah)', (await buttons.count()) === 1 && /btn-ghost-dark/.test(cls) && !/btn-red/.test(cls));
    const order = await page.evaluate(() => {
      const board = [...document.querySelectorAll('h3')].find((h) => /Papan Kebutuhan/.test(h.textContent));
      const ai = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && /Talenta untuk kebutuhan Anda/.test(el.textContent));
      return { board: Boolean(board), ai: Boolean(ai), boardFirst: Boolean(board && ai && (board.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING)) };
    });
    check('daftar kebutuhan ada; kartu AI (bila ada) di bawahnya', order.board && (!order.ai || order.boardFirst), order.ai ? 'kartu AI tampil di bawah papan' : 'kartu AI tidak tampil');
    const h1 = await page.locator('h1').filter({ hasText: 'Halo' }).first().evaluate((el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2 }));
    check('sapaan ringkas 1 baris', h1.h <= h1.lh * 1.5, `${Math.round(h1.h)} px`);
    check('0 scroll horizontal', await noHScroll(page));
    await page.screenshot({ path: `${SHOTS}u10-beranda-berisi-${label}.png`, fullPage: label === '1440' });

    if (label === '360') {
      console.log('\n[Bilah bawah mobile · 360]');
      const nav = page.locator('nav[aria-label="Navigasi dasbor"]').filter({ visible: true });
      const info = await nav.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const btns = [...el.querySelectorAll('button')];
        return {
          navTop: r.top, navH: r.height,
          tabs: btns.map((b) => {
            const label = [...b.querySelectorAll('span')].reverse().find((s) => s.textContent.trim() && !s.querySelector('svg'));
            const lr = label.getBoundingClientRect();
            const cs = getComputedStyle(label);
            return {
              text: label.textContent.trim(), font: parseFloat(cs.fontSize), lines: Math.round(lr.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize))),
              h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width, current: b.getAttribute('aria-current'),
              marker: Boolean(b.querySelector('span.absolute')),
            };
          }),
          digits: [...el.querySelectorAll('span')].some((s) => /^0\d$/.test(s.textContent.trim())),
        };
      });
      check('4 tab: Beranda, Mading, Komunitas, Menu', info.tabs.map((t) => t.text).join(',') === 'Beranda,Mading,Komunitas,Menu', info.tabs.map((t) => t.text).join(','));
      check('label ≥ 12 px dan satu baris', info.tabs.every((t) => t.font >= 12 && t.lines <= 1), info.tabs.map((t) => `${t.text} ${t.font}px/${t.lines}`).join(' · '));
      check('tanpa angka 01–04', !info.digits);
      check('area sentuh tiap tab ≥ 44 px', info.tabs.every((t) => t.h >= 44 && t.w >= 44), info.tabs.map((t) => `${Math.round(t.w)}×${Math.round(t.h)}`).join(' '));
      check('tinggi bilah ± 60 px', info.navH >= 56 && info.navH <= 66, `${Math.round(info.navH)} px`);
      const active = info.tabs.find((t) => t.current === 'page');
      check('tab aktif bertanda (aria-current + garis penanda)', active?.text === 'Beranda' && active.marker);
      const fab = await page.locator('.chat-launcher').boundingBox();
      check('peluncur AI berjarak di atas bilah (≥ 8 px)', fab && fab.y + fab.height <= info.navTop - 8, fab ? `jarak ${Math.round(info.navTop - fab.y - fab.height)} px` : 'tidak ada');

      await page.locator('[data-dash-menu]').filter({ visible: true }).click();
      await page.waitForTimeout(400);
      const drawerEl = page.locator('[role="dialog"][aria-label="Menu dasbor"]');
      const drawer = await drawerEl.innerText();
      const drawerDigits = await drawerEl.evaluate((el) => [...el.querySelectorAll('span')].some((s) => /^0\d$/.test(s.textContent.trim())));
      check('Menu berisi Profil, Pengaturan, Ruang AgenSUSI; tanpa angka; "Komunitas" bukan "Komunitas & Peta"',
        /Profil/.test(drawer) && /Pengaturan/.test(drawer) && /Ruang AgenSUSI/.test(drawer) && !drawerDigits && !/Komunitas & Peta/.test(drawer));
      await page.screenshot({ path: `${SHOTS}u10-menu-360.png` });
      await page.keyboard.press('Escape'); // drawer ditutup dengan Esc
      await page.waitForTimeout(300);

      console.log('\n[Notifikasi mobile · 360]');
      await page.getByRole('button', { name: /^Notifikasi/ }).click();
      await page.waitForTimeout(600);
      const panel = page.locator('.notif-panel');
      const n = await panel.evaluate((el) => {
        const item = el.querySelector('[data-notif]');
        const title = item?.querySelector('button span span:nth-of-type(2)');
        const del = item?.querySelectorAll('button')[1];
        const r = el.getBoundingClientRect();
        const first = item?.getBoundingClientRect();
        return {
          // Benar-benar layar penuh: lebar DAN tinggi viewport, dan item pertama terlihat di dalamnya.
          full: r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1 && (!first || (first.top >= r.top && first.bottom <= window.innerHeight)),
          items: el.querySelectorAll('[data-notif]').length,
          titleFont: title ? parseFloat(getComputedStyle(title).fontSize) : null,
          delW: del?.getBoundingClientRect().width ?? null,
          noScrollX: el.scrollWidth <= el.clientWidth + 1,
          headerFont: parseFloat(getComputedStyle(el.querySelector('p')).fontSize),
        };
      });
      check('panel layar penuh (lebar & tinggi, item pertama terlihat), tanpa scroll samping', n.full && n.noScrollX);
      // Tidak ada yang tergambar di atas panel: titik di area bilah bawah & peluncur AI milik panel.
      const onTop = await page.evaluate(() => {
        const el = document.querySelector('.notif-panel');
        const pts = [[window.innerWidth / 2, window.innerHeight - 20], [window.innerWidth - 40, window.innerHeight - 100]];
        return pts.every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
      });
      check('bilah bawah & peluncur AI tidak menutupi panel', onTop);
      check(`item terbaca (${n.items} notifikasi): judul ≥ 15 px, tombol hapus ≥ 44 px, judul panel ≥ 18 px`,
        n.items === 0 || (n.titleFont >= 15 && n.delW >= 44 && n.headerFont >= 18), `judul ${n.titleFont}px · hapus ${Math.round(n.delW ?? 0)}px · kepala ${n.headerFont}px`);
      await page.screenshot({ path: `${SHOTS}u10-notifikasi-360.png` });
    } else {
      const sidebar = await page.locator('aside').first().innerText();
      check('desktop tetap: sidebar bernomor & "Komunitas & Peta"', /01/.test(sidebar) && /Komunitas & Peta/.test(sidebar));
    }
    await context.close();
  }

  console.log('\n[Peran lain tidak terpengaruh · talenta 360]');
  const { context, page } = await open(MOBILE, { email: 'rizky@talenta.test' });
  const old = await page.locator('nav[aria-label="Navigasi dasbor"]').filter({ visible: true }).evaluate((el) => ({
    buttons: el.querySelectorAll('button').length,
    digits: [...el.querySelectorAll('span')].some((s) => /^0\d$/.test(s.textContent.trim())),
    grid5: Boolean(el.querySelector('.grid-cols-5')),
  }));
  check('bilah talenta tetap model lama (4 tab bernomor + Menu)', old.buttons === 5 && old.digits && old.grid5);
  await context.close();
} finally {
  await browser.close();
}
console.log(failed ? `\nHASIL: ${failed} GAGAL` : '\nHASIL: semua cek U10 LULUS');
process.exitCode = failed ? 1 : 0;
