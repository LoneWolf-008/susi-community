# Addendum SDD — F7 Peta Komunitas (P1)

> **Cara pakai:** lampirkan file ini **beserta** `SDD-SUSI-Community-v1.md` yang sudah ada ke Claude Code. Ini bukan SDD pengganti — ini perpanjangan yang menyambung ke dokumen yang sudah final. Jangan menyusun ulang bagian yang sudah ada; tambahkan hanya apa yang diminta di sini, mengikuti persis konvensi penamaan dan format yang sudah ditetapkan di §0.2 dan §0.3 SDD utama.

## Konteks

PRD §8 (P1) mendefinisikan F7: setiap komunitas dapat menandai titik kumpulnya di peta. Fitur ini **P1, bukan P0** — dibangun setelah enam halaman P0 selesai dan hanya jika waktu memungkinkan. Prioritas eksekusi tidak berubah meski dokumen ini ada; addendum ini disiapkan lebih dulu supaya siap dieksekusi begitu waktunya tiba, bukan sebagai sinyal untuk mengerjakannya sekarang.

## Keputusan yang sudah diambil (setara KD di SDD utama)

**KD-4 · Hak edit lokasi komunitas mengikuti pola kepemilikan yang sama seperti data komunitas lainnya.**
Tidak ada aktor baru. Yang boleh mengubah `latitude`/`longitude` sebuah komunitas adalah: (a) `users` yang tercatat sebagai `komunitas.dibuat_oleh`, atau (b) peran `liaison` — persis pola yang sudah berlaku untuk kepemilikan `kebutuhan` ber-`sumber_intake = 'assisted'` (KD-2 di SDD utama). Tidak perlu tabel atau kolom kepemilikan baru; `komunitas.dibuat_oleh` yang sudah ada dipakai ulang sebagai penentu otorisasi.

## Perubahan Skema

Tambahkan ke `CREATE TABLE komunitas` yang sudah ada di SDD §2.2 (jangan buat tabel baru):

```sql
ALTER TABLE komunitas
  ADD COLUMN latitude  DECIMAL(10,7) NULL AFTER lokasi,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude;
```

Tuliskan sebagai migrasi terpisah (`002_tambah_lokasi_komunitas.sql`) jika tim sudah memakai pola migrasi bernomor di §2.2 SDD; jika belum, cukup tambahkan langsung ke DDL awal karena scaffolding proyek belum dimulai (lihat §11.5 SDD: "belum ada baris kode pertama").

## Endpoint Baru

Tambahkan satu baris ke tabel endpoint domain Komunitas (SDD §3.3):

| Method | Path | Peran diizinkan | Deskripsi | Error |
|---|---|---|---|---|
| `PATCH` | `/api/komunitas/:id/lokasi` | Pemilik komunitas (`dibuat_oleh`) atau `liaison` | Mengisi/mengubah `latitude` & `longitude`. Menolak field lain di luar keduanya | `400 VALIDASI_GAGAL`, `401`, `403 BUKAN_PEMILIK`, `404` |
| `GET` | `/api/komunitas/peta` | Terautentikasi | Daftar seluruh komunitas yang sudah punya `latitude`+`longitude` terisi, beserta jumlah `kebutuhan` berstatus `TERBUKA` per komunitas | `401` |

Middleware yang dipakai: gunakan ulang `requireKomunitasOwner` bila sudah ada polanya di §4.2; jika belum ada middleware kepemilikan untuk `komunitas` (kemungkinan besar belum, karena sebelumnya komunitas hanya diubah tidak langsung lewat endpoint `kebutuhan`), buat middleware baru `requireKomunitasOwnerOrLiaison` mengikuti pola persis `requireOwner` yang sudah ada — memeriksa `req.user.id === komunitas.dibuat_oleh || req.user.role === 'liaison'`.

## Halaman Frontend

Satu halaman baru: **Peta Komunitas** (`/peta`), dapat diakses semua peran terautentikasi. Menampilkan pin untuk setiap komunitas dari `GET /api/komunitas/peta`; klik pin menampilkan nama, jenis, dan tautan ke katalog kebutuhan milik komunitas tersebut (filter `kebutuhan?komunitas_id=`, endpoint sudah ada). Formulir isi lokasi ditempatkan di halaman profil/pengaturan komunitas milik Requester, dan di formulir Assisted Intake milik Liaison sebagai field opsional tambahan.

**Library peta:** Leaflet + react-leaflet, tuile dari OpenStreetMap. Tidak perlu API key. Tambahkan ke `package.json` frontend: `leaflet`, `react-leaflet`.

## Yang Tidak Berubah

Tidak ada perubahan pada tabel `kebutuhan`, `lamaran`, `kesepakatan`, `konfirmasi`, state machine, atau endpoint yang sudah ada di SDD utama. F7 murni aditif — bila F7 akhirnya tidak sempat dibangun karena waktu onsite habis, tidak ada bagian sistem P0 yang terpengaruh.

## Uji Minimal Tambahan (perluasan SDD §10)

| Skenario | Hasil yang diharapkan |
|---|---|
| Requester mengisi lokasi komunitas miliknya sendiri | `200 OK`, `latitude`/`longitude` tersimpan |
| Requester mencoba mengisi lokasi komunitas milik orang lain | `403 BUKAN_PEMILIK` |
| Liaison mengisi lokasi komunitas hasil assisted intake yang ia catat | `200 OK` |
| `GET /api/komunitas/peta` dipanggil tanpa token | `401` |
