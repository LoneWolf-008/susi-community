# Kartu "Rekomendasi AI" di Beranda

**Branch:** `implement/dashboard-ai-card` · **Status:** selesai. Hanya UI: tanpa LLM, tanpa endpoint baru.

## 1. Diagnosa

- **DB kerja** (`susi_community_db`, hanya baca): pengguna bernama `talent` = id 11, `talenta@susi.mail`,
  peran **`requester`**. Akun lain yang mirip namanya (`talenta` id 12 & 19) berperan `talent`.
- **Routing peran tidak bermasalah.** `normalizeUser` hanya memetakan alias lama `agensusi → liaison`;
  `DashboardPage` memetakan `talent → DashboardTalent`. Akun id 11 masuk ke dasbor Komunitas karena
  memang terdaftar sebagai `requester`: formulir daftar (`AuthPage`) memilih **Komunitas** secara bawaan,
  jadi akun itu kemungkinan dibuat tanpa mengganti pilihan peran. Kode tidak diubah dan data juga tidak.
- **Playwright sebelum perubahan** (DB sekali pakai): bagian "Rekomendasi untuk Anda" muncul untuk Nabila
  (4 kebutuhan cocok) dan Fajar (2), tetapi di bawah sapaan, pencarian, dan statistik (di 1440×900
  baru terlihat di tepi bawah layar). Talenta baru tanpa keahlian melihat "Lengkapi keahlian Anda dulu"
  + tombol. Komunitas tidak punya bagian rekomendasi di Beranda.

## 2. Yang dibuat

| Bagian | Isi |
|---|---|
| `components/recommendation/AiCard.jsx` | Bingkai kartu (eyebrow "✦ REKOMENDASI AI", label tetap `RecommendationNote`), panel, skeleton, galat ringkas, pesan personalisasi mati |
| `talent/AiCard.jsx` (paling atas tab Lihat Proyek) | 3 teratas dari `/recommendations/needs` (skor, keahlian cocok, alasan, Lamar/Detail; geser ke samping di mobile), "N KEBUTUHAN COCOK · LIHAT SEMUA" → daftar katalog "Paling cocok"; tip keahlian dari agregat `/needs/catalog` + `/talent/profile` ("Tambah skill X untuk membuka N proyek lagi"; tanpa keahlian: "Skill paling dicari"); progres sertifikasi dari `/certifications/eligibility` ("3 dari 3 proyek", status/tersertifikasi); tanpa keahlian → "Lengkapi profil"; tanpa rekomendasi → pesan jelas |
| `requester/AiCard.jsx` (paling atas Beranda Komunitas) | Tanpa kebutuhan: manfaat + 3 langkah + "+ Ajukan Kebutuhan". Ada kebutuhan: "N dari M kebutuhan terbuka punya rekomendasi talenta" (`/recommendations/talents` per kebutuhan terbuka, maks. 10), tautan ke tiap kebutuhan; menunggu moderasi dijelaskan |
| `talent/RecommendationsSection.jsx` | Dihapus; isinya pindah ke kartu (tidak ada daftar ganda) |

Toggle: `allows_ai_personalization = 0` → kartu tidak memuat data pribadi sama sekali dan menautkan ke
Pengaturan (talenta & komunitas). `show_in_recommendations` → status tampil/tidak tampil di kartu
talenta; kartu komunitas menjelaskan bahwa hanya talenta yang mengizinkan yang disarankan (disaring BE).
Setiap kueri berdiri sendiri: rekomendasi gagal → pesan + "Coba lagi"; tip/progres gagal → panelnya saja hilang.

## 3. Verifikasi

DB sekali pakai `susi_community_e2e_dash` (backend 3019, LLM mock, Vite 5181), dihapus setelahnya.

- `node scripts/beranda-ai.mjs --base http://localhost:5181 --toggles` → screenshot desktop (1440×900)
  dan 360 px di `docs/screenshots/beranda-*.png` untuk Nabila, Fajar, talenta baru tanpa keahlian, Siti
  (komunitas dengan kebutuhan), komunitas baru tanpa kebutuhan (seed tidak punya komunitas tanpa
  kebutuhan), serta Nabila dengan tiap toggle dimatikan. Semua: kartu muncul, **0 galat konsol, 0 scroll
  horizontal**.
- `npm run lint` bersih · `npm run build` berhasil · `npm run audit:mobile` 45 halaman: **0 scroll
  horizontal**, 0 elemen melewati tepi (target < 40 px hanya di halaman yang tidak disentuh).
- Tanpa test baru.
