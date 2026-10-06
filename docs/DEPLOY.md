# Deploy SUSI Community (ringkas)

> Catatan: dokumen ini baru memuat bagian cookie refresh. Instruksi T16 untuk DEPLOY.md terpotong
> setelah "cookie refresh lintas domain (sameSite none + …"; bagian lain menyusul.

## Cookie refresh lintas domain

Login menyimpan **refresh token** di cookie `susi_refresh_token` (`httpOnly`, `path=/`, 7 hari).
Access token hanya di memori peramban; saat halaman dimuat ulang, frontend memanggil
`POST /api/auth/refresh` dengan `credentials: 'include'` untuk mendapatkan access token baru.

Pengaturan saat ini (`backend/controllers/authController.js`):

| Atribut | Nilai |
|---|---|
| `SameSite` | `Lax` (tetap) |
| `Secure` | `true` hanya bila `NODE_ENV=production` |

Akibatnya bergantung pada cara frontend memanggil API:

| Cara | Cookie refresh | Yang perlu diatur |
|---|---|---|
| **Satu origin** (disarankan): frontend memanggil `/api/...` di domain yang sama, diteruskan ke backend oleh hosting frontend (mis. rewrite `/api/:path*` → `https://<backend>/api/:path*` di `vercel.json`) | Terkirim dengan `SameSite=Lax`, tanpa perubahan kode | `VITE_API_URL` dikosongkan (bawaan `/api`); `FRONTEND_URL` = domain frontend; `TRUST_PROXY` sesuai jumlah proxy; HTTPS |
| **Lintas domain**: frontend di `app.example.id` memanggil `VITE_API_URL=https://api.example.id/api` | **Tidak terkirim** pada `fetch` lintas situs selama `SameSite=Lax`, sehingga login hilang setiap kali halaman dimuat ulang | Cookie harus `SameSite=None; Secure` (wajib HTTPS di kedua sisi) dan CORS `credentials: true` dengan origin persis di `FRONTEND_URL` (sudah). **Opsi `SameSite=None` belum ada di kode**; perlu perubahan kecil di `setRefreshCookie` (dan `clearCookie` saat logout) sebelum memakai cara ini |

Catatan untuk mode lintas domain:
- `SameSite=None` tanpa `Secure` ditolak peramban modern. Pastikan backend berjalan di balik HTTPS dan
  `NODE_ENV=production`.
- Beberapa peramban (Safari, mode privat) memblokir cookie pihak ketiga meski `SameSite=None`. Mode
  satu origin menghindari masalah ini, jadi lebih aman untuk demo.
- `FRONTEND_URL` boleh berisi beberapa origin dipisah koma (mis. domain produksi + pratinjau Vercel).
