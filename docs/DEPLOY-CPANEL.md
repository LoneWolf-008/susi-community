# Deploy SUSI ke cPanel (Jagoan Hosting, Setup Node.js App)

Panduan langkah demi langkah untuk memasang SUSI di **https://susi-community.lippbyte.my.id**. Satu
aplikasi Node.js menyajikan tampilan web sekaligus API `/api` di alamat yang sama ("satu origin"), jadi
tidak perlu hosting frontend terpisah.

| | |
|---|---|
| Hosting | cPanel + **Setup Node.js App** (CloudLinux, Passenger) |
| Versi Node | **22.23.3** (cadangan 20.20.2) |
| Alamat | `https://susi-community.lippbyte.my.id` |
| Folder aplikasi | `~/susi-app` (di **luar** `public_html`) |
| Startup file | `app.cjs` |

Panduan umum (cookie, trust proxy, daftar variabel) ada di [DEPLOY.md](DEPLOY.md).

---

## 1. Siapkan paket di laptop

```bash
cd backend
npm run pack:cpanel
```

Hasilnya `dist-cpanel/susi-app.zip`. Isinya:

| Folder | Isi |
|---|---|
| `backend/` | Kode server. Tanpa `node_modules`, tanpa `.env`, tanpa data demo |
| `frontend/dist/` | Tampilan web yang sudah di-build (bukan kode sumbernya) |
| `db/install.sql` | Struktur database + isi awal Tanya SUSI. Tanpa akun dan tanpa data demo |
| `DEPLOY-CPANEL.md` | Panduan ini |

Frontend di-build di laptop; server cukup menjalankan backend.

## 2. Buat subdomain

1. cPanel → **Domains** (atau **Subdomains**) → **Create A New Domain**.
2. Isi `susi-community.lippbyte.my.id`. Document root boleh dibiarkan bawaan; aplikasi Node.js yang akan
   menjawab alamat ini.

## 3. Buat database dan user MySQL

1. cPanel → **MySQL® Database Wizard**.
2. Buat database, misalnya `susi`. Nama lengkapnya otomatis diberi awalan akun, misalnya
   `namaakun_susi`. **Catat nama lengkap ini.**
3. Buat user, misalnya `susi` (menjadi `namaakun_susi`), dengan password kuat. Catat passwordnya.
4. Beri user itu **ALL PRIVILEGES** pada database tadi.

## 4. Impor struktur database

1. Ekstrak `susi-app.zip` di laptop, lalu ambil `db/install.sql`.
2. cPanel → **phpMyAdmin** → klik database `namaakun_susi` di kiri → tab **Import**.
3. Pilih `install.sql` → **Import**. Hasilnya: 42 tabel/view, 44 entri basis pengetahuan Tanya SUSI, dan
   katalog keahlian. Belum ada akun.

> Impor hanya ke database **kosong**. Berkas ini tidak membuat database dan tidak berisi `DEFINER`.

## 5. Buat akun admin

Tanpa SSH, admin dibuat lewat SQL:

1. Di laptop, isi `ADMIN_EMAIL` dan `ADMIN_PASSWORD` (password **produksi**, minimal 10 karakter) di
   `backend/.env`, lalu jalankan:
   ```bash
   cd backend
   npm run make-admin-sql
   ```
2. Salin keluarannya. Isinya hanya email dan hash, bukan password.
3. phpMyAdmin → database `namaakun_susi` → tab **SQL** → tempel → **Go**.

Aman dijalankan ulang: email yang sudah ada tidak ditimpa.

## 6. Unggah paket

1. cPanel → **File Manager** → buka folder **home** (`/home/namaakun`), **bukan** `public_html`.
2. **Upload** `susi-app.zip` → klik kanan → **Extract**. Hasilnya `~/susi-app/backend`,
   `~/susi-app/frontend/dist`, dan `~/susi-app/db`.
3. Setelah impor database selesai, hapus `susi-app.zip` dan `susi-app/db/install.sql` dari server.

## 7. Setup Node.js App

cPanel → **Setup Node.js App** → **Create Application**:

| Isian | Nilai |
|---|---|
| Node.js version | **22.23.3** |
| Application mode | **Production** |
| Application root | `susi-app/backend` |
| Application URL | `susi-community.lippbyte.my.id` (path dikosongkan) |
| Application startup file | `app.cjs` |

Lalu tambahkan **Environment variables**:

| Nama | Nilai |
|---|---|
| `NODE_ENV` | `production` |
| `SERVE_FRONTEND` | `true` |
| `TRUST_PROXY` | `1` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `namaakun_susi` |
| `DB_USER` | `namaakun_susi` |
| `DB_PASSWORD` | password user database |
| `JWT_ACCESS_SECRET` | teks acak ≥ 32 karakter (lihat di bawah) |
| `JWT_REFRESH_SECRET` | teks acak lain ≥ 32 karakter, **berbeda** dari yang atas |
| `FRONTEND_URL` | `https://susi-community.lippbyte.my.id` |
| `COOKIE_SAMESITE` | `lax` |
| `LLM_PROVIDER` | `openrouter` |
| `OPENROUTER_API_KEY` | API key dari openrouter.ai/settings/keys (**bukan** Management key) |
| `OPENROUTER_MODEL` | `anthropic/claude-haiku-4.5` |
| `CHATBOT_DAILY_BUDGET_USD` | `0.25` |
| `LLM_TRANSPORT` | kosongkan dulu (= `fetch`); isi `https` hanya bila muncul error WebAssembly (bagian 11) |

Membuat secret JWT di laptop (jalankan dua kali, satu hasil untuk tiap secret):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Tekan **Create**.

## 8. Run NPM Install, lalu restart

1. Di halaman aplikasi, tekan **Run NPM Install**. Dependensinya murni JavaScript (tanpa modul native),
   jadi tidak butuh compiler di server.
2. Tekan **Restart**.

## 9. Pastikan SSL aktif

cPanel → **SSL/TLS Status** → `susi-community.lippbyte.my.id` harus bergembok hijau. Bila belum, tekan
**Run AutoSSL** dan tunggu beberapa menit. Aktifkan juga **Force HTTPS Redirect** di cPanel → Domains.

HTTPS **wajib**: di production, cookie login bertanda `Secure`, jadi hanya terkirim lewat HTTPS.

## 10. Cek setelah deploy

1. Buka `https://susi-community.lippbyte.my.id/`: halaman depan tampil.
2. Buka `https://susi-community.lippbyte.my.id/api/health`: harus `{"status":"OK", …}`.
3. Masuk dengan akun admin, lalu **muat ulang halaman**. Bila tetap masuk, cookie berjalan.
4. Cek AI (`model_call` harus `"ok"`), dari PowerShell di laptop:
   ```powershell
   $login = Invoke-RestMethod -Method Post -Uri https://susi-community.lippbyte.my.id/api/auth/login `
     -ContentType 'application/json' -Body '{"email":"EMAIL_ADMIN","password":"PASSWORD_ADMIN"}'
   Invoke-RestMethod -Uri https://susi-community.lippbyte.my.id/api/chatbot/health `
     -Headers @{ Authorization = "Bearer $($login.data.accessToken)" } | ConvertTo-Json
   ```
   - `model_call: "gagal"` dengan `http_status` 401: key ditolak, misalnya Management key.
   - `http_status` 402: kredit habis.
   - Cek ini memanggil model sekali (± $0,00004) dan hasilnya di-cache 60 detik.

### Membaca log

- Pada Setup Node.js App (CloudLinux/Passenger), pesan error saat start dan `console.error` aplikasi
  biasanya masuk ke berkas **`stderr.log`** di Application root (`~/susi-app/backend/stderr.log`). Buka
  lewat File Manager. Bila berkas itu tidak ada, tanyakan lokasi log aplikasi Node.js ke support hosting.
- Pesan penting yang biasa muncul di sana:
  - `[config] Konfigurasi environment tidak valid` beserta daftar variabel yang salah;
  - `Gagal konek MySQL`;
  - `SERVE_FRONTEND=true tetapi … index.html tidak ada`.
- Setelah mengubah variabel atau berkas, selalu tekan **Restart**.

## 11. Bila muncul error

### `RangeError: WebAssembly.instantiate(): Out of memory`

Batas memori hosting (CloudLinux LVE) membuat `fetch` bawaan Node gagal menyiapkan parser WebAssembly-nya.
`fetch` hanya dipakai untuk memanggil OpenRouter. Langkah perbaikan:
1. Tambahkan env `LLM_TRANSPORT=https`, lalu **Restart**. Panggilan ke OpenRouter kini memakai `node:https`
   tanpa WebAssembly.
2. Bila masih muncul, ganti **Node.js version** ke **20.20.2**, tekan **Run NPM Install**, lalu
   **Restart**.
3. Bila tetap gagal, minta hosting menaikkan batas memori aplikasi.

### 503, "Incomplete response", atau Passenger gagal start

Buka `stderr.log` (bagian 10), lalu cocokkan dengan penyebab umum berikut:

| Gejala di log | Perbaikan |
|---|---|
| `ERR_REQUIRE_ESM` / `require() of ES Module` | Startup file harus `app.cjs`, bukan `server.js` |
| `Cannot find module 'express'` (atau modul lain) | Tekan **Run NPM Install**, lalu Restart |
| `[config] Konfigurasi environment tidak valid` | Lengkapi variabel yang disebut (bagian 7) |
| `SERVE_FRONTEND=true tetapi … index.html tidak ada` | Pastikan `~/susi-app/frontend/dist/index.html` ada (ekstrak ulang paket) |
| Versi Node < 20 | Pilih 22.23.3 atau 20.20.2 |

### Koneksi MySQL

| Gejala | Perbaikan |
|---|---|
| `ER_ACCESS_DENIED_ERROR` | Nama user/database harus lengkap dengan awalan akun (`namaakun_…`), password benar, dan user sudah ditambahkan ke database dengan ALL PRIVILEGES |
| `ECONNREFUSED` / `ETIMEDOUT` | Pakai `DB_HOST=localhost` dan `DB_PORT=3306` |
| `ER_NO_SUCH_TABLE` | `install.sql` belum diimpor ke database yang sama dengan `DB_NAME` |

### Login hilang setelah halaman dimuat ulang (cookie `Secure`)

Cookie login hanya terkirim lewat **HTTPS**. Pastikan:
- situs dibuka dengan `https://` (aktifkan Force HTTPS Redirect);
- sertifikat SSL subdomain aktif (bagian 9);
- `FRONTEND_URL` persis `https://susi-community.lippbyte.my.id`, tanpa `/` di akhir;
- `COOKIE_SAMESITE=lax`.

## 12. Rilis berikutnya

1. Di laptop: `npm run pack:cpanel`.
2. Di server, ganti `~/susi-app/frontend/dist` dan isi `~/susi-app/backend`.
   - **Jangan hapus `~/susi-app/backend/uploads`**: di sana tersimpan berkas hasil kerja yang diunggah
     pengguna.
   - Jangan tambahkan `.env`; variabel tetap diatur di Setup Node.js App.
3. Bila ada migrasi baru: Setup Node.js App → **Run JS script** → `db:migrate` (atau
   `npm run db:migrate` lewat Terminal cPanel bila tersedia).
4. **Run NPM Install** bila dependensi berubah, lalu **Restart**.
5. Cadangkan database (phpMyAdmin → Export) dan folder `uploads` secara berkala.

## Asumsi

- **Passenger memuat startup file dengan `require()`.**
  - Karena backend memakai ES module, memuatnya langsung gagal dengan `ERR_REQUIRE_ESM`.
  - `app.cjs` hanya menjalankan `import('./server.js')`, pola yang dianjurkan untuk Passenger.
- **Passenger mengambil alih `listen()` pertama** dan memasangnya ke socket miliknya sendiri; port yang
  diminta diabaikan.
  - Server membaca `PORT` bila ada: angka sebagai port, atau teks sebagai path socket.
  - Server tidak pernah mengikat port tetap.
  - Bila hosting memakai LiteSpeed (`lsnode`), mekanismenya serupa: startup file dimuat lewat `require`.
- **Satu proses aplikasi**: rate limit dan cache jawaban disimpan di memori proses.
- **Disk cPanel permanen**, jadi folder `uploads` tidak hilang saat restart, berbeda dengan
  Railway/Render.
- **Versi Node:**
  - Kode diuji di Node 24. Node 22 dan 20 belum diuji langsung karena tidak ada nvm/fnm di laptop.
  - Analisis statis tidak menemukan API khusus Node 24, dan semua dependensi runtime mendukung Node ≥ 20.
  - `engines` diset `>=20 <25`. Alat test (vitest 5) sendiri butuh Node ≥ 22.12, tetapi test tidak
    dijalankan di server.
- **Verifikasi lokal paket**: `cd backend && node scripts/verify-cpanel-pack.mjs [--browser]`.
  - Skrip mengimpor `install.sql`, membuat admin, dan menjalankan paket seperti Passenger dalam mode
    production.
  - Lalu memeriksa halaman, aset, `/api`, 404, alur cookie login → refresh → logout, dan CSP di browser
    headless.
