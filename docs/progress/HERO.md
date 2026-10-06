# HERO — kolase komunitas sebagai latar hero landing

**Branch:** `implement/hero-kolase` · **Status:** selesai. Hanya section hero di `HomePage.jsx` yang
berubah; section angka, halaman lain, dan backend tidak disentuh. Teks/copy tidak diubah. Tidak ada
dependensi runtime baru (`sharp` hanya devDependency untuk skrip).

## Isi hero sebelum diubah (langkah 0)

Hero hanya berisi `h1` tiga baris rata tengah ("Kami adalah / **solusi digital** / komunitas anda.",
aksen `#e62b2b`) dan penanda SCROLL. Tidak ada paragraf, badge, atau CTA. Navigasi berupa header
transparan `fixed` (wordmark `#f2efe6`, tombol menu merah). Section berikutnya mulai dari `#0e2233`.
Timeline GSAP lama juga menyasar `.hero-badge`/`.hero-fade`/`.hero-accent-line`/`.hero-dot`, yang tidak
ada di markup. Ini sudah ada sebelumnya dan dibiarkan.

## Aset

PNG sumber 3780×1890 disimpan di `frontend/assets-src/` (di-gitignore). Varian dibuat dengan
`node scripts/build-hero-images.mjs` (grayscale, tanpa upscale) ke `public/images/hero/`:

| Lebar | AVIF | WebP | Target |
|---|---|---|---|
| 768 | 36 kB | 52 kB | — |
| 1280 | 70 kB | 96 kB | ≤ 120 kB |
| 1920 | 110 kB | 145 kB | ≤ 250 kB |

Foto lama `src/assets/photos/hero-{top,left,right,bottom}.jpg` dihapus karena yatim. `feature.jpg`
masih dipakai, jadi tetap ada.

## Nilai akhir variabel (`src/pages/HomeHero.css`, blok `.hero`)

| Variabel | Nilai | Catatan |
|---|---|---|
| `--hero-fallback` | `#0b0f14` | latar sebelum/bila gambar gagal dimuat |
| `--hero-img-brightness` / `--hero-img-contrast` | `0.55` / `1.08` | ditambah `grayscale(1)` |
| `--hero-img-position` | `50% 50%` | |
| `--hero-shade-flat` | `0.6` (mobile < 768 px: `0.75`) | `rgba(8,8,8,·)` rata |
| `--hero-shade-core` | `0.55` (mobile: `0.7`) | radial `75% 62%` di `50% 48%`, di belakang judul |
| `--hero-vignette` | `0.55` | tepi |
| `--hero-fade-to` / `--hero-fade-height` | `#0e2233` / `24%` | gradasi bawah ke section angka |
| `--hero-text` | `#f5f2e8` | bayangan `0 2px 24px rgba(0,0,0,.45)` |
| `--hero-accent` | `#e62b2b` | **tidak perlu dicerahkan** (lulus 3:1) |
| `--hero-muted` | `rgba(242,239,230,.78)` | label SCROLL, sebelumnya 40% (gagal 4,5:1) |
| `--hero-zoom-from` / `-to` / `-duration` | `1.04` / `1.1` / `28s` | hanya `hover:hover` + `pointer:fine` + tanpa reduced motion |

Penggelap tidak perlu dinaikkan: semua cek lulus pada putaran pertama.

## Kontras per viewport — `node scripts/hero-contrast.mjs`

Cara ukur: teks disembunyikan, latar di kotaknya difoto, lalu luminansi latar pada **persentil-95**
(kasus terburuk untuk teks terang) dibandingkan dengan warna teks. Syaratnya 4,5:1 untuk teks normal
dan 3:1 untuk teks besar.

| Viewport | Judul baris 1 / 3 | "solusi digital" (besar) | SCROLL (9 px) | Wordmark nav |
|---|---|---|---|---|
| 1440×900 | 13,57 / 13,55 | 3,70 | 8,87 | 13,67 |
| 1024×768 | 14,79 / 13,71 | 3,74 | 8,38 | 13,68 |
| 768×1024 | 16,17 / 14,25 | 3,74 | 8,97 | 13,72 |
| 390×844 | 17,01 / 15,77 | 4,12 | 9,02 | 15,44 |
| 360×740 | 16,90 / 15,74 | 4,23 | 8,99 | 15,15 |

**25/25 lulus.** Tidak ada tumpang-tindih antara blok judul dengan tombol header, penanda SCROLL, atau
peluncur chat di kelima viewport. Screenshot: `docs/screenshots/hero-<lebar>x<tinggi>.png`.

## Cek lain

| Cek | Hasil |
|---|---|
| `npm run audit:mobile` (360×740, 45 halaman) | **0 scroll horizontal**, 0 elemen melewati tepi; `/` tanpa temuan. Target < 40 px tetap 23, sama dengan T16 |
| `npx eslint src scripts` | bersih |
| `npm run build` | berhasil |
| Ukuran JS (dibanding build `436df14`) | `HomePage-*.js` **18,70 → 16,67 kB** (−2,03). `index-*.js` 294,63 → 294,66 kB (+30 B, hanya karena nama berkas `HomePage-*.css` baru masuk daftar preload). Total JS turun ± 2 kB |
| CSS baru | `HomePage-*.css` 1,84 kB (0,69 kB gzip), hanya dimuat di landing |

## Perlu dicek mata manusia

1. **Tingkat gelap.** Apakah wajah di kolase masih terasa "hidup" atau terlalu tenggelam, terutama di
   ponsel yang penggelapnya +0,15. Bila terlalu gelap, cukup naikkan `--hero-img-brightness`
   (misalnya 0,6) lalu jalankan ulang `hero-contrast.mjs`.
2. **Crop ponsel tegak.** Di layar tegak yang tampil hanya ± ¼ lebar kolase bagian tengah. Pastikan
   potongannya tidak janggal, misalnya wajah terpotong tepat di belakang judul. Atur dengan
   `--hero-img-position`.
3. **Zoom pelan & fade-in di desktop:** halus, tanpa patah. Di sentuh/reduced motion zoom memang mati.
4. **Jaringan lambat:** sebelum gambar tiba, teks tampil di atas `#0b0f14` lalu gambar fade-in.
5. **Sambungan ke section angka:** gradasi bawah tidak membentuk garis.
6. **Asal foto.** Bila kolase dibuat dengan AI, tulis "ilustrasi" di proposal/slide. Bila foto asli,
   pastikan ada izin dari orang yang wajahnya terlihat.
