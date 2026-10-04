# Dokumen proyek

| Berkas | Isi | Status |
|---|---|---|
| [TASKS.md](TASKS.md) | Rencana kerja T0–T16 hasil audit repo (4 Okt 2026) | **Acuan kerja aktif** |
| [PRD.md](PRD.md) | Product Requirements Document v1.1 | Acuan produk (apa & kenapa) |
| [SDD.md](SDD.md) | System Design Document v1.1 | Acuan konsep; lihat catatan di bawah |
| [SDD-addendum-F7-peta-komunitas.md](SDD-addendum-F7-peta-komunitas.md) | Addendum F7 Peta Komunitas | Sudah dilebur ke SDD v1.1 |
| [API.md](API.md) | Referensi endpoint backend (peran, body, status) | Mengikuti kode di `backend/routes` |
| [progress/](progress/) | Ringkasan hasil per task (`<ID>.md`) | Diperbarui tiap task selesai |

## Catatan tentang SDD

SDD disusun sebelum implementasi dan memakai skema berbahasa Indonesia
(`kebutuhan`, `lamaran`, `kesepakatan`, `konfirmasi`) serta struktur folder
`server/` dan `client/`. Implementasi yang berjalan memakai skema berbahasa
Inggris (`needs`, `applications`, `projects`, ...) di folder `backend/` dan
`frontend/`.

Bila SDD dan kode berbeda, yang berlaku:

1. **Skema database:** `backend/db/schema.sql` + `backend/db/migrations/`.
2. **Keputusan desain:** bagian 2 di `TASKS.md`.
3. **Konsep yang tetap berlaku dari SDD:** state machine dan guard transisi (§4.4),
   matriks otorisasi peran (§4.1), sign-off dua arah (§6.3), dan skenario uji negatif (§10.2).
