// Uji kontras teks hero landing per viewport (Playwright headless + sharp untuk membaca piksel).
// Untuk tiap teks hero (judul per baris, label SCROLL, wordmark navigasi): teks disembunyikan
// (visibility:hidden), latar di kotaknya difoto, lalu luminansi latar pada persentil-95 (kasus terburuk
// untuk teks terang di latar gelap) dibandingkan dengan warna teks. Lulus: ≥ 4,5:1 teks normal, ≥ 3:1
// teks besar (≥ 24 px, atau ≥ 18,66 px tebal). Juga memeriksa elemen lain yang menimpa blok judul dan
// menyimpan screenshot hero ke docs/screenshots/hero-<lebar>x<tinggi>.png.
//
//   node scripts/hero-contrast.mjs [--base http://localhost:5173]
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const i = process.argv.indexOf('--base');
const BASE = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const SHOTS = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 740]];
const PERCENTILE = 0.95;

const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseColor = (css) => {
  const m = css.match(/rgba?\(([^)]+)\)/);
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { rgb: [r, g, b], alpha: a };
};

// Teks yang diukur: [label, selector, indeks]
const TARGETS = [
  ['judul baris 1', '.hero-title .hero-line', 0],
  ['judul "solusi digital"', '.hero-title .hero-line', 1],
  ['judul baris 3', '.hero-title .hero-line', 2],
  ['label SCROLL', '.hero-scroll p', 0],
  ['wordmark navigasi', 'header button span span', 0],
];

const browser = await chromium.launch();
const rows = [];
const overlaps = [];
try {
  for (const [width, height] of VIEWPORTS) {
    const touch = width < 1024;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.locator('.hero-bg.is-loaded').waitFor({ timeout: 15000 });
    await page.waitForTimeout(2500); // animasi masuk teks (GSAP) & fade gambar
    const label = `${width}x${height}`;
    await page.screenshot({ path: `${SHOTS}hero-${label}.png` });

    const info = await page.evaluate((targets) => targets.map(([name, sel, idx]) => {
      const el = document.querySelectorAll(sel)[idx];
      if (!el) return { name, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        name, color: cs.color, fontSize: parseFloat(cs.fontSize), fontWeight: Number(cs.fontWeight),
        box: { x: r.left, y: r.top, w: r.width, h: r.height },
      };
    }), TARGETS);

    // Elemen lain yang menimpa blok judul.
    const hits = await page.evaluate(() => {
      const title = document.querySelector('.hero-title').getBoundingClientRect();
      const others = [...document.querySelectorAll('header button, .hero-scroll, .chat-launcher')];
      return others.map((el) => {
        const r = el.getBoundingClientRect();
        const w = Math.min(r.right, title.right) - Math.max(r.left, title.left);
        const h = Math.min(r.bottom, title.bottom) - Math.max(r.top, title.top);
        return w > 0 && h > 0 && r.width > 0 ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}` : null;
      }).filter(Boolean);
    });
    overlaps.push({ viewport: label, hits });

    // Sembunyikan teks, foto latarnya.
    await page.evaluate((targets) => targets.forEach(([, sel, idx]) => {
      const el = document.querySelectorAll(sel)[idx];
      if (el) el.style.visibility = 'hidden';
    }), TARGETS);
    const png = await page.screenshot();
    const { data, info: img } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    for (const t of info) {
      if (t.missing) { rows.push({ viewport: label, name: t.name, pass: false, note: 'tidak ditemukan' }); continue; }
      const x0 = Math.max(0, Math.floor(t.box.x)); const y0 = Math.max(0, Math.floor(t.box.y));
      const x1 = Math.min(img.width, Math.ceil(t.box.x + t.box.w)); const y1 = Math.min(img.height, Math.ceil(t.box.y + t.box.h));
      const lums = [];
      let worst = null;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const o = (y * img.width + x) * 3;
          const px = [data[o], data[o + 1], data[o + 2]];
          lums.push([luminance(px), px]);
        }
      }
      lums.sort((a, b) => a[0] - b[0]);
      [, worst] = lums[Math.min(lums.length - 1, Math.floor(lums.length * PERCENTILE))];
      const { rgb, alpha } = parseColor(t.color);
      const text = rgb.map((c, k) => alpha * c + (1 - alpha) * worst[k]); // warna teks semi-transparan di atas latar
      const contrast = ratio(luminance(text), luminance(worst));
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      rows.push({ viewport: label, name: t.name, contrast, need, large, pass: contrast >= need, bg: `rgb(${worst.join(',')})`, size: `${Math.round(t.fontSize)}px` });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log('Viewport   Teks                      Ukuran  Latar p95          Kontras  Syarat  Hasil');
for (const r of rows) {
  console.log(`${r.viewport.padEnd(10)} ${r.name.padEnd(25)} ${String(r.size ?? '').padEnd(7)} ${String(r.bg ?? '').padEnd(18)} ${r.contrast ? `${r.contrast.toFixed(2)}:1`.padEnd(8) : ''.padEnd(8)} ${r.need ? `${r.need}:1`.padEnd(7) : ''.padEnd(7)} ${r.pass ? 'LULUS' : 'GAGAL'}${r.note ? ` (${r.note})` : ''}`);
}
console.log('\nTumpang-tindih dengan blok judul:');
for (const o of overlaps) console.log(`  ${o.viewport.padEnd(10)} ${o.hits.length ? `GAGAL: ${o.hits.join(', ')}` : 'tidak ada'}`);
const failed = rows.filter((r) => !r.pass).length + overlaps.filter((o) => o.hits.length).length;
console.log(failed ? `\nHASIL: ${failed} GAGAL` : `\nHASIL: semua ${rows.length} pengukuran kontras & ${overlaps.length} cek tumpang-tindih LULUS`);
process.exit(failed ? 1 : 0);
