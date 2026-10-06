# Demo SUSI Community

## Persiapan (± 1 menit)

```bash
cd backend
npm run demo:reset      # DB dari nol: migrasi + data demo + basis pengetahuan Tanya SUSI
npm run dev             # API di http://localhost:3009
npm run demo:login      # (terminal lain) semua akun demo harus LULUS
cd ../frontend && npm run dev   # aplikasi di http://localhost:5173
```

Siapkan beberapa jendela peramban (atau profil/incognito terpisah), satu per peran, sebelum demo
dimulai.

## Akun demo

Password tidak ditulis di dokumen ini; nilainya ada di `backend/.env`.

| Email | Peran | Password (env) | Dipakai untuk |
|---|---|---|---|
| `admin@susi.test` (`ADMIN_EMAIL`) | Admin | `ADMIN_PASSWORD` | Moderasi kebutuhan, sertifikasi, statistik Tanya SUSI |
| `budi@susi.test` | AgenSUSI (liaison) | `SEED_USER_PASSWORD` | Jalur B (pemilik proksi), inbox Eskalasi, tinjau sertifikasi |
| `siti@umkm.test` | Komunitas | `SEED_USER_PASSWORD` | Jalur A, rekomendasi talenta + undang, Ruang AgenSUSI (tiket berjalan), peta |
| `deden@karta.test` | Komunitas | `SEED_USER_PASSWORD` | Komunitas cadangan |
| `ujang@kebun.test` | Komunitas | `SEED_USER_PASSWORD` | Privasi lokasi (tampilkan lokasi), gabung komunitas |
| `nabila@talenta.test` | Talenta | `SEED_USER_PASSWORD` | Rekomendasi proyek, chatbot personal, ajukan sertifikasi (3 proyek) |
| `fajar@talenta.test` | Talenta | `SEED_USER_PASSWORD` | Contoh belum layak sertifikasi (2 proyek) |
| `rizky@talenta.test` | Talenta | `SEED_USER_PASSWORD` | Melamar & mengerjakan (jalur A) |
| `alya@talenta.test` | Talenta | `SEED_USER_PASSWORD` | Mengerjakan jalur B, tanya AI → AgenSUSI |
| `dewi@talenta.test` | Talenta | `SEED_USER_PASSWORD` | Sudah tersertifikasi (Desain): sertifikat & verifikasi publik |

## Skenario 5 menit

| Menit | Bagian | Langkah |
|---|---|---|
| 0:00–1:30 | **Loop G4 jalur A (mandiri)** | Siti → **+ Ajukan Kebutuhan** (geser penanda di peta untuk lokasi) → Admin → **Moderasi** setujui → Rizky melamar → Siti memilih (scope & definisi selesai) → Rizky setuju & kirim tautan hasil → Siti **verifikasi + testimoni** → reputasi Rizky +1, testimoni tampil di profilnya. Bila waktu sempit, tunjukkan kebutuhan Siti yang sudah **menunggu verifikasi** di Beranda |
| 1:30–2:00 | **Jalur B (via AgenSUSI)** | Budi → **Catat Kebutuhan** atas nama komunitas tanpa akun (pemilik proksi). Tunjukkan bahwa langkah berikutnya sama dengan jalur A, tetapi Budi yang memilih & memverifikasi |
| 2:00–2:45 | **Rekomendasi** | Nabila → **Lihat Proyek**: "Rekomendasi untuk Anda" (persen cocok, keahlian cocok/bisa dipelajari, "Mengapa cocok?"). Siti → detail kebutuhan → **Talenta lain yang cocok** → **Undang** |
| 2:45–3:30 | **Chatbot personal** | Nabila → tombol merah **Tanya SUSI** → "proyek apa yang cocok buat aku?" → kartu sama dengan dasbor → **Lihat & lamar**. Lalu "skill apa yang perlu saya pelajari?" (kesenjangan keahlian dari kebutuhan terbuka) |
| 3:30–4:15 | **AI → AgenSUSI** | Alya → Tanya SUSI → "apakah ada aplikasi android susi di play store?" → kartu **Lanjutkan dengan AgenSUSI?** → Ya, hubungkan → **Ruang AgenSUSI** (AI dijeda). Budi → **Eskalasi** → klaim → balasan cepat. Alya melihat balasan (lencana). Siti: menu **Ruang AgenSUSI** menunjukkan tiket yang sedang ditangani |
| 4:15–4:45 | **Sertifikat + verifikasi publik** | Dewi → **Profil** → kartu Sertifikasi → **Lihat & cetak** (A4 lanskap). Salin tautan verifikasi → buka di **jendela incognito** → "Sertifikat berlaku" tanpa login |
| 4:45–5:00 | **Peta** | Siti → **Komunitas & Peta**: marker merah (komunitas lain), mint (komunitas Anda), kuning (kebutuhan terbuka) → klik marker → popup + **Rute di Google Maps** |

## Rencana cadangan

| Masalah | Tindakan |
|---|---|
| **LLM/OpenRouter gagal, key kosong, atau anggaran habis** | Tanya SUSI otomatis menjawab dari **basis pengetahuan** (KB) tanpa LLM. Pertanyaan demo di atas (rekomendasi, kesenjangan keahlian, sertifikasi, "aplikasi android") memang dijawab dari template/KB, jadi alurnya tetap jalan. Bila tidak ada jawaban, kartu **Lanjutkan dengan AgenSUSI?** tetap muncul (itu bagian dari cerita) |
| **Internet putus** (tile peta tidak termuat) | Bagian lain tetap jalan karena API dan DB lokal. Lewati segmen peta atau tunjukkan `docs/screenshots/06-peta.png`; popup dan daftar komunitas tetap ada di daftar sebelah kiri |
| **Data demo berantakan** setelah latihan | `npm run demo:reset` (± 7 detik), lalu muat ulang semua jendela (login ulang) |
| Login gagal / rate limit | `npm run demo:login` untuk memastikan akun. Untuk satu Wi-Fi bersama, naikkan `CHATBOT_DAILY_LIMIT_ANON_IP` di `backend/.env` |
| Waktu habis | Prioritas: loop G4 (bisa dari kebutuhan yang sudah menunggu verifikasi) → AI → AgenSUSI → sertifikat |

Screenshot cadangan (1440 × 900) ada di `docs/screenshots/`.
