# Deploy SUSI Community

Susunan: **frontend** statis (Vite build, mis. Vercel), **backend** Express (mis. Railway/Render), dan
**MySQL 8 / MariaDB**. Backend tidak menyajikan frontend; keduanya di-deploy terpisah.

## 1. Pilih cara frontend memanggil API

Login menyimpan **refresh token** di cookie `susi_refresh_token` (`httpOnly`, `path=/`, 7 hari).
Access token hanya disimpan di memori peramban. Setiap halaman dimuat ulang, frontend memanggil
`POST /api/auth/refresh` dengan `credentials: 'include'`. Karena itu cookie harus ikut terkirim.

| | **Satu origin (disarankan)** | **Lintas domain** |
|---|---|---|
| Contoh | `https://susi.example.id/api/...` diteruskan hosting frontend ke backend | `https://app.example.id` memanggil `https://api.example.id/api` |
| Frontend | `VITE_API_URL` dikosongkan (bawaan `/api`), plus rewrite `/api` di hosting (lihat bawah) | `VITE_API_URL=https://api.example.id/api` |
| `COOKIE_SAMESITE` | `lax` (bawaan, tanpa perubahan) | `none` |
| Cookie | `SameSite=Lax`; `Secure` bila `NODE_ENV=production` | `SameSite=None; Secure` (Secure **dipaksa**, wajib HTTPS di kedua sisi) |
| CORS | `FRONTEND_URL` = domain frontend | `FRONTEND_URL` = origin frontend **persis** (skema + host + port, tanpa `/` di akhir). CORS sudah `credentials: true` |
| Perlindungan CSRF | Bawaan `SameSite=Lax` | `/api/auth/refresh` & `/api/auth/logout` menolak (**403**) permintaan yang header `Origin`-nya tidak tercantum di `FRONTEND_URL`, termasuk permintaan tanpa `Origin` |
| Risiko | — | Safari dan mode privat bisa memblokir cookie pihak ketiga meski `SameSite=None`, sehingga login hilang setiap kali halaman dimuat ulang |

**Satu origin di Vercel:** tambahkan rewrite `/api` **sebelum** rewrite SPA di `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://<domain-backend>/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

`FRONTEND_URL` boleh berisi beberapa origin yang dipisah koma, mis. domain produksi dan pratinjau
Vercel. Semuanya diterima CORS dan pemeriksaan `Origin`.

Cek mode cookie: `cd backend && node scripts/check-cookie.mjs`. Skrip menjalankan aplikasi dalam dua
mode dan login sebagai admin `.env`. Pada `lax`, perilaku lama dipastikan tidak berubah. Pada `none`,
dipastikan `Secure` terpasang, `Origin` yang benar diterima, dan yang salah atau kosong ditolak 403.

## 2. Trust proxy

`TRUST_PROXY` (bawaan `1`) adalah jumlah proxy di depan backend. Nilai ini menentukan `req.ip`, yang
dipakai rate limit login, chatbot, dan endpoint publik.

- Railway/Render: `1`. Bila ditambah Cloudflare di depannya: `2`.
- Terlalu kecil: semua pengguna terlihat ber-IP proxy, sehingga rate limit per IP terpakai bersama
  dan cepat 429.
- Terlalu besar: `X-Forwarded-For` bisa dipalsukan untuk melewati rate limit.
- `true` hanya bila Anda benar-benar mempercayai seluruh rantai proxy.

## 3. Disk dan memori tidak permanen

- **Unggahan hasil kerja** (`UPLOAD_DIR`, bawaan `backend/uploads`) disimpan di disk lokal. Pada
  Railway/Render tanpa volume, **berkas hilang setiap kali restart atau deploy**. Baris di DB tetap ada,
  tetapi unduhannya 404. Pasang volume persisten dan arahkan `UPLOAD_DIR` ke sana (path absolut, atau
  relatif terhadap folder `backend`).
- Yang **hilang saat restart tetapi tidak merusak**:
  - cache jawaban LLM di memori;
  - penghitung rate limit (ter-reset).
- Hal yang sama juga membuat rate limit **tidak dibagi antar-instans**: jalankan satu instans saja.
- Anggaran LLM harian dihitung dari tabel `ask_logs` (DB), jadi tetap benar setelah restart.
- Job retensi chat berjalan harian di proses server (`CHATBOT_RETENTION_DAYS`). Bila server sering
  tidur (paket gratis), jalankan `npm run chat:retention` terjadwal (cron platform).

## 4. Environment produksi (backend)

| Variabel | Wajib | Catatan |
|---|---|---|
| `NODE_ENV` | ya | `production`: cookie `Secure`, galat 5xx tanpa detail, seed ditolak tanpa `--force`, aturan secret lebih ketat |
| `PORT` | — | Biasanya diisi platform |
| `TRUST_PROXY` | — | Lihat bagian 2 |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | ya | `DB_PASSWORD` wajib di production |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ya | Berbeda satu sama lain, masing-masing ≥ 32 karakter di production |
| `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES` | — | Bawaan `15m` / `7d` |
| `FRONTEND_URL` | ya | Origin frontend persis, dipisah koma bila lebih dari satu |
| `COOKIE_SAMESITE` | — | `lax` (bawaan) atau `none` (lintas domain), lihat bagian 1 |
| `UPLOAD_DIR` | — | Arahkan ke volume persisten |
| `LLM_PROVIDER` | — | `openrouter` (bawaan) atau `mock` |
| `OPENROUTER_API_KEY` | — | Tanpa key, chatbot menjawab dari KB saja. Simpan hanya di secret platform dan pasang batas kredit di dashboard OpenRouter |
| `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS` | — | Bawaan `anthropic/claude-haiku-4.5` |
| `OPENROUTER_TIMEOUT_MS` | — | Bawaan 12000 |
| `OPENROUTER_DATA_COLLECTION` | — | `deny` (bawaan, disarankan) |
| `CHATBOT_DAILY_BUDGET_USD` | — | Bawaan **0.25** (± 60–80 jawaban AI per hari, ± $0,003–0,004 per jawaban). Bila habis, chatbot turun ke mode KB-saja sampai hari berganti; 0 = LLM mati. Naikkan bila pemakaian memang ramai |
| `CHATBOT_RETENTION_DAYS` | — | Bawaan 90 |
| Rate limit (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_*`, `CHATBOT_*_LIMIT_*`) | — | Naikkan plafon IP untuk demo ramai di satu Wi-Fi |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | hanya untuk seed | Dibaca `npm run seed`, bukan oleh server. Password ≥ 10 karakter |

Frontend: `VITE_API_URL` (lihat bagian 1) dan `VITE_CONTACT_*`. Semua `VITE_*` ikut ter-bundle ke
peramban, jadi jangan menaruh secret di sana.

Server menolak start dengan pesan jelas bila variabel wajib kosong atau nilainya tidak valid
(`config/env.js`).

## 5. Database, migrasi, dan seed

```bash
cd backend
npm run db:init      # buat database + jalankan migrasi (instalasi baru)
npm run db:migrate   # deploy berikutnya: hanya migrasi yang belum jalan
npm run seed         # data demo + admin; DITOLAK bila NODE_ENV=production
npm run seed -- --force   # paksa di production (hanya bila memang disengaja, mis. server demo)
```

`npm run demo:reset` **mengosongkan database**: jangan dijalankan di server dengan data nyata.

## 6. Health check

`GET /api/health` tanpa login mengembalikan `{ "status": "OK", "timestamp": "..." }`. Endpoint ini
dipakai untuk health check platform dan tidak menyentuh DB maupun LLM.

**Status LLM:** `GET /api/chatbot/health`, khusus admin dan belum ada tampilannya di UI.

```json
{ "key_info": "ok", "model_call": "gagal", "status": "error", "latency_ms": 761,
  "error": "LLMUnavailable", "http_status": 401, "credits": { … }, "cached": false }
```

- **Cek yang benar adalah `model_call`, bukan `key_info`.** `key_info` hanya membaca info key/kredit.
  `model_call` adalah satu panggilan model sungguhan (`max_tokens 5`, sekitar $0,00004 dengan Haiku 4.5), dan `status`
  mengikuti `model_call`.
- Pada sesi 2026-10-06, key yang dipakai lolos `key_info` tetapi panggilan modelnya ditolak 401
  "User not found". Penyebabnya: yang terpasang adalah **Management key** OpenRouter, yang hanya bisa
  mengelola key lain. Pakai key dari halaman **API Keys**. Hanya `model_call` yang menangkap kasus seperti ini.
- Hasil di-cache **60 detik** per klien LLM (`cached: true`), sehingga memuat ulang berkali-kali tidak
  menghabiskan kredit.
- Respons hanya memuat nama kelas galat dan status HTTP. Key, pesan galat OpenRouter, dan isi jawaban
  model tidak pernah diteruskan.
- `status: "not_configured"` berarti key kosong dan chatbot menjawab dari KB saja.

## 7. Cek setelah deploy

1. `GET /api/health` → 200.
2. Login, lalu **muat ulang halaman**. Bila tetap masuk, cookie refresh ikut terkirim.
3. Lintas domain: di DevTools → Application → Cookies, `susi_refresh_token` harus `SameSite=None` dan
   `Secure`.
4. Unggah hasil kerja, restart backend, lalu unduh lagi untuk membuktikan volume persisten.
5. `GET /api/chatbot/health` (token admin) → `model_call: "ok"`. Bila `gagal`, lihat `http_status`:
   401 berarti key/akun ditolak, dan 402 berarti kredit habis.

## 8. Pengingat: panduan Tanya SUSI (`guide.js`)

Tanya SUSI menjawab cara memakai aplikasi berdasarkan **`backend/services/chatbot/guide.js`**. Isinya:
ringkasan SUSI, alur, kebijakan, cara menghubungi AgenSUSI, Pengaturan, dan menu per peran. AI dilarang
menambah detail di luar panduan ini, jadi panduan yang usang membuat AI salah memandu atau terpaksa
menjawab "belum tahu".

**Perbarui `guide.js` setiap kali** ada perubahan pada:
- nama atau urutan menu, tab, tombol, atau label di dasbor;
- alur proyek (moderasi, lamaran, kesepakatan, verifikasi, sengketa, mundur);
- kebijakan (biaya, syarat sertifikasi, batas undangan, retensi chat, jam layanan AgenSUSI);
- cara kontak atau fitur akun (reset kata sandi, ubah email, hapus akun).

Setelah mengubahnya:
1. Naikkan `PROMPT_VERSION` di `services/chatbot/prompts.js`.
2. Jalankan `npm test` di folder `backend`.
3. Uji beberapa pertanyaan terkait secara live, misalnya
   `npm run eval:chatbot -- --mode live --set natural.jsonl --cases <id>`. Biayanya ± $0,004 per
   pertanyaan.

Fakta FAQ yang sering ditanya sebaiknya juga dijadikan entri KB (Admin → Tanya SUSI), karena jawaban KB
langsung lebih cepat dan gratis.
