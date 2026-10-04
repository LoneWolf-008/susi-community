# SUSI Community

Platform yang mempertemukan komunitas non-teknis di Bandung yang punya kebutuhan
digital dengan talenta IT yang butuh pengalaman proyek nyata. Kebutuhan bisa masuk
mandiri atau dicatatkan oleh Liaison (AgenSUSI) dari lapangan; reputasi talenta
hanya bertambah lewat sign-off dua arah.

Dokumen produk dan rencana kerja ada di [docs/](docs/README.md).

## Struktur repo

| Folder | Isi |
|---|---|
| `backend/` | REST API Node.js + Express + MySQL (`mysql2`), port default 3009 |
| `frontend/` | React 19 + Vite, port dev 5173 |
| `docs/` | PRD, SDD, rencana task, dan catatan progres per task |

## Prasyarat

- Node.js 20 atau lebih baru (diuji dengan Node 24) dan npm
- MySQL 8 atau MariaDB 10.4+ (mis. Laragon/XAMPP untuk lokal)
- Git

## Menjalankan backend

```bash
cd backend
cp .env.example .env      # lalu isi JWT_*_SECRET, DB_*, ADMIN_PASSWORD, SEED_USER_PASSWORD
npm ci
npm run db:init           # buat database + skema + migrasi
npm run seed              # data demo (aman dijalankan berulang)
npm run dev               # atau: npm start
```

Server berhenti saat start dengan pesan yang jelas bila variabel wajib kosong.
Cek kesehatan: `curl http://localhost:3009/api/health`.

Membuat secret JWT acak:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Test backend

```bash
cd backend
npm test                  # vitest + supertest
```

Test memakai database terpisah `susi_community_test` (bisa diganti lewat
`TEST_DB_NAME`, nama wajib berakhiran `_test`). Kredensial MySQL diambil dari
`backend/.env`. Sebelum suite berjalan, DB test dikosongkan lalu dipasang ulang
dari `schema.sql` + semua migrasi, jadi migrasi ikut teruji. DB dev tidak disentuh.

### Konvensi API

Daftar lengkap endpoint, peran, dan body ada di [docs/API.md](docs/API.md).

- Body POST/PATCH divalidasi zod; kolom tak dikenal dibuang. Gagal → 400 dengan
  `details: [{ field, message }]` berbahasa Indonesia.
- Error selalu `{ "error": { "message": "..." } }`; pesan error server (5xx)
  disamarkan di production.
- Endpoint daftar menerima `?page=&limit=` (limit maksimal 50) dan mengembalikan
  `{ "items": [...], "total": n, "page": p, "limit": l }` di dalam `data`.
- Login (percobaan gagal) dan registrasi dibatasi 10 per 15 menit per IP.

## Database

Skema baseline ada di `backend/db/schema.sql` (MySQL 8 dan MariaDB 10.4+). Setiap
perubahan skema **wajib** lewat berkas baru `backend/db/migrations/NNN_nama.sql`,
bukan lewat phpMyAdmin.

| Perintah (di `backend/`) | Fungsi |
|---|---|
| `npm run db:init` | Buat database bila belum ada, pasang `schema.sql` (hanya pada DB kosong), lalu jalankan migrasi tertunda |
| `npm run db:migrate` | Jalankan migrasi tertunda; tercatat di tabel `schema_migrations` |
| `npm run db:status` | Daftar migrasi yang sudah dan belum dijalankan |
| `npm run db:reset` | **Menghapus semua tabel**, lalu `db:init`. Ditolak bila `NODE_ENV=production` |
| `npm run seed` | Isi data demo. Idempoten; ditolak di production kecuali `-- --force` |

Database hasil impor dump phpMyAdmin (tanpa `schema_migrations`) ditolak oleh
`db:init`. Kosongkan dulu dengan `db:reset` atau pakai database baru.

### Akun demo (setelah `npm run seed`)

| Peran | Email | Password | Catatan |
|---|---|---|---|
| Admin | nilai `ADMIN_EMAIL` (default `admin@susi.test`) | `ADMIN_PASSWORD` | Moderasi, sengketa, pengguna |
| Liaison (AgenSUSI) | `budi@susi.test` | `SEED_USER_PASSWORD` | Pemilik proksi kebutuhan jalur Assisted |
| Requester | `siti@umkm.test` | `SEED_USER_PASSWORD` | Paguyuban UMKM Sepatu Cibaduyut; proyek menunggu verifikasi |
| Requester | `deden@karta.test` | `SEED_USER_PASSWORD` | Karang Taruna RW 08 Antapani |
| Requester | `ujang@kebun.test` | `SEED_USER_PASSWORD` | Urban Farming Buahbatu; proyek bersengketa |
| Talenta | `rizky@talenta.test` | `SEED_USER_PASSWORD` | Fresh graduate |
| Talenta | `nabila@talenta.test` | `SEED_USER_PASSWORD` | 1 proyek selesai (jalur Assisted) |
| Talenta | `fajar@talenta.test` | `SEED_USER_PASSWORD` | 1 proyek selesai |
| Talenta | `alya@talenta.test` | `SEED_USER_PASSWORD` | Mahasiswa DKV |

Isi seed: 8 komunitas di empat sektor Bandung, 14 kebutuhan (MANDIRI dan AGENSUSI,
2 menunggu moderasi, 1 ditolak), dan satu proyek untuk tiap status: `AGREEMENT`,
`IN_PROGRESS`, `AWAITING_VERIFICATION`, `COMPLETED` (lengkap dengan testimoni dan
reputasi), serta `DISPUTED` (dengan satu sengketa). Juga mencakup kunjungan liaison,
topik mading, notifikasi, dan entri KB awal.

## Menjalankan frontend

```bash
cd frontend
npm ci
npm run dev               # http://localhost:5173 (backend harus jalan di :3009)
npm run lint              # ESLint
npm run build             # hasil di dist/ (Tailwind di-build lokal, tanpa CDN)
```

Port dikunci ke 5173 (`strictPort`) agar selalu cocok dengan `FRONTEND_URL` di
backend. Bila port terpakai, Vite berhenti alih-alih pindah ke port lain.

Saat dev, Vite mem-proxy `/api` ke backend (`VITE_DEV_API_TARGET`, default
`http://localhost:3009`), jadi frontend dan API satu origin dan cookie refresh
berfungsi tanpa CORS. Untuk produksi lintas domain isi `VITE_API_URL`.

Rute: `/` beranda · `/tentang` · `/masuk` (masuk/daftar) · `/admin` (masuk admin,
pintasan Ctrl+Shift+A di halaman masuk) · `/ajukan` (form kebutuhan, khusus komunitas) ·
`/dashboard` (sesuai peran). Sesi bertahan setelah reload lewat `POST /api/auth/refresh`;
access token hanya disimpan di memori. `vercel.json` dan `public/_redirects` menyiapkan
fallback SPA untuk Vercel/Netlify.

## Variabel environment

### `backend/.env`

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `PORT` | | `3009` | Port API |
| `NODE_ENV` | | `development` | `production` mengaktifkan cek secret lebih ketat |
| `TRUST_PROXY` | | `1` | Jumlah proxy di depan server (Railway/Render = 1) |
| `DB_HOST` | ya | | Host MySQL/MariaDB |
| `DB_PORT` | ya | | Biasanya `3306` |
| `DB_USER` | ya | | |
| `DB_PASSWORD` | di production | kosong | Boleh kosong untuk root MySQL lokal |
| `DB_NAME` | ya | | Nama database |
| `JWT_ACCESS_SECRET` | ya | | Harus berbeda dari refresh secret; ≥ 32 karakter di production |
| `JWT_REFRESH_SECRET` | ya | | Idem |
| `JWT_ACCESS_EXPIRES` | | `15m` | Masa berlaku access token |
| `JWT_REFRESH_EXPIRES` | | `7d` | Masa berlaku refresh token |
| `FRONTEND_URL` | ya | | Origin yang diizinkan CORS; pisahkan dengan koma bila lebih dari satu |
| `UPLOAD_DIR` | | `uploads` | Folder unggahan, relatif terhadap `backend/` |
| `ADMIN_EMAIL` | untuk seed | `admin@susi.test` (di contoh) | Akun admin yang dibuat `npm run seed` |
| `ADMIN_PASSWORD` | untuk seed | | Minimal 10 karakter |
| `SEED_USER_PASSWORD` | untuk seed | | Password semua akun demo lain; minimal 10 karakter |
| `RATE_LIMIT_MAX` | | `500` | Batas request `/api` per IP per 15 menit |
| `AUTH_RATE_LIMIT_MAX` | | `10` | Batas login gagal & registrasi per IP per jendela |
| `AUTH_RATE_LIMIT_WINDOW_MS` | | `900000` | Jendela rate limit auth (15 menit) |
| `PUBLIC_RATE_LIMIT_MAX` | | `60` | Batas `/api/public/*` per IP per menit |
| `VISIT_RATE_LIMIT_MAX` | | `10` | Batas `POST /api/public/visit` per IP per 15 menit |
| `MIGRATIONS_DIR` | | `db/migrations` | Hanya untuk pengujian runner migrasi |
| `TEST_DB_NAME` | | `susi_community_test` | Database untuk `npm test` (harus berakhiran `_test`) |

### `frontend/.env.local`

| Variabel | Keterangan |
|---|---|
| `VITE_API_URL` | Basis URL API untuk produksi. Kosongkan saat dev. Jangan isi secret: semua `VITE_*` ikut ter-bundle ke browser. |
| `VITE_DEV_API_TARGET` | Target proxy `/api` saat `npm run dev`/`preview` (default `http://localhost:3009`). |
| `VITE_CONTACT_WHATSAPP`, `VITE_CONTACT_EMAIL` | Kontak resmi tim SUSI (dasbor, footer, halaman Tentang). WhatsApp boleh `0812…` atau `62812…`. Kosong = tidak ditampilkan (tidak ada nomor contoh). |
| `VITE_CONTACT_INSTAGRAM`, `VITE_CONTACT_DISCORD`, `VITE_CONTACT_GITHUB` | Tautan media sosial di footer; yang kosong disembunyikan. |

## Alur kerja

Pekerjaan dipecah per task di [docs/TASKS.md](docs/TASKS.md). Satu task = satu
branch (`implement/<ID>-<slug>`), commit dengan format conventional commits, dan
ringkasan hasil di `docs/progress/<ID>.md`.
