// Varian gambar latar hero (sekali jalan): AVIF & WebP lebar 768/1280/1920 dari PNG kolase asli di
// assets-src/ (tidak di-commit). Tanpa upscale; kualitas diturunkan bertahap sampai ukuran ≤ target.
//
//   node scripts/build-hero-images.mjs
// sharp hanya devDependency (alat build), bukan dependensi runtime.
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../assets-src/Kolase_foto_komunitas_hitam_putih.png', import.meta.url));
const OUT = fileURLToPath(new URL('../public/images/hero/', import.meta.url));
// Target ukuran (kB). 768w tidak ditentukan; pakai batas yang sebanding.
const TARGET_KB = { 768: 60, 1280: 120, 1920: 250 };
const FORMATS = {
  avif: { start: 55, min: 30, options: (q) => ({ quality: q, effort: 6 }) },
  webp: { start: 72, min: 40, options: (q) => ({ quality: q, effort: 6 }) },
};

mkdirSync(OUT, { recursive: true });
const meta = await sharp(SRC).metadata();
console.log(`Sumber ${meta.width}×${meta.height}`);

for (const width of [768, 1280, 1920]) {
  if (width > meta.width) {
    console.log(`lewati ${width}w (lebih besar dari sumber)`);
    continue;
  }
  for (const [format, cfg] of Object.entries(FORMATS)) {
    const file = `${OUT}collage-${width}.${format}`;
    let quality = cfg.start;
    for (;;) {
      // Kolase memang hitam-putih: simpan sebagai grayscale agar lebih kecil.
      await sharp(SRC).resize({ width, withoutEnlargement: true }).grayscale()[format](cfg.options(quality)).toFile(file);
      const kb = statSync(file).size / 1024;
      if (kb <= TARGET_KB[width] || quality <= cfg.min) {
        console.log(`${format.padEnd(4)} ${String(width).padStart(4)}w  q${quality}  ${kb.toFixed(0)} kB${kb > TARGET_KB[width] ? '  (MELEBIHI TARGET)' : ''}`);
        break;
      }
      quality -= 5;
    }
  }
}
