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
cp .env.example .env      # lalu isi JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, dan DB_*
npm ci
npm run dev               # atau: npm start
```

Server berhenti saat start dengan pesan yang jelas bila variabel wajib kosong.
Cek kesehatan: `curl http://localhost:3009/api/health`.

Membuat secret JWT acak:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Skema database dan data seed disiapkan lewat skrip di T1 (lihat `docs/TASKS.md`).

## Menjalankan frontend

```bash
cd frontend
npm ci
npm run dev               # http://localhost:5173
```

Port dikunci ke 5173 (`strictPort`) agar selalu cocok dengan `FRONTEND_URL` di
backend. Bila port terpakai, Vite berhenti alih-alih pindah ke port lain.

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

### `frontend/.env.local`

| Variabel | Keterangan |
|---|---|
| `VITE_API_URL` | Basis URL API untuk produksi. Kosongkan saat dev. Jangan isi secret: semua `VITE_*` ikut ter-bundle ke browser. |

## Alur kerja

Pekerjaan dipecah per task di [docs/TASKS.md](docs/TASKS.md). Satu task = satu
branch (`implement/<ID>-<slug>`), commit dengan format conventional commits, dan
ringkasan hasil di `docs/progress/<ID>.md`.
