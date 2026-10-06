# AI-CS — Tanya SUSI sebagai pemandu aplikasi & CS

**Branch:** `implement/ai-cs-guide` · **Status:** selesai, di-merge ke main lokal (tidak di-push).
Rincian angka dan contoh jawaban ada di `docs/chatbot-eval.md`, bagian "Pemandu aplikasi & CS".

## Masalah

Dengan key yang sudah valid, pertanyaan natural tetap sering dijawab "Maaf, saya belum menemukan
jawabannya…" tanpa memanggil AI. Pipeline hanya memanggil LLM bila pencarian KB menemukan entri yang
cukup cocok. Pertanyaan masalah komunitas ("warga telat bayar iuran") bahkan ditolak sebagai di luar
topik. Pada 31 pertanyaan natural baru, kode lama hanya lulus **14/31**: 13 jawaban "belum menemukan",
dan 0/6 untuk masalah komunitas.

## Yang dibuat

| Bagian | Isi |
|---|---|
| `services/chatbot/guide.js` (baru) | Panduan aplikasi untuk AI: ringkasan SUSI, alur, kebijakan, cara menghubungi AgenSUSI, akun, sertifikat, Pengaturan, dan menu per peran (Komunitas, Talenta, AgenSUSI, admin, pengunjung). Isinya dicek terhadap kode dasbor dan KB |
| `prompts.js` (cs1) | Peran pemandu & CS: ringkas, langkah dengan nama menu persis, empati + tawaran AgenSUSI, saran umum berlabel untuk masalah komunitas/UMKM (tanpa nasihat hukum/pajak/pinjaman/investasi), tolak sopan bila di luar topik. Blok `<panduan>` dan `<kb_terkait>` ikut disanitasi dan masuk penanda kebocoran |
| `pipeline.js` | Tanpa entri KB yang cocok → LLM dengan panduan + entri yang sebagian cocok (bukan lagi jawaban cadangan). Penolakan tanpa LLM hanya untuk pesan pertama anonim tanpa istilah SUSI/komunitas. "Saya belum punya informasi…" → belum terjawab + tawaran AgenSUSI |
| `kb.js` | `searchKbRanked` + `selectNear` (entri sebagian cocok sebagai konteks, bukan sumber) |
| `intent.js` | Kosakata domain + istilah komunitas/UMKM/pengerjaan proyek; cek keaslian sertifikat tidak lagi masuk template kelayakan |
| `replies.js`, `ChatPanel.jsx` | Balasan di luar topik dan sapaan chat menyebut bahwa masalah komunitas/UMKM juga bisa ditanyakan |
| Evaluasi | `natural.jsonl` (31) dan `natural-holdout.jsonl` (13); cek baru `answered`, `include_some`, `refuse_any`; runner `--set` |

## Hasil (live, Haiku 4.5)

| Uji | Hasil |
|---|---|
| Pertanyaan natural (31) | 14/31 (kode lama) → **31/31**. Set ini dipakai menyetel |
| Holdout (13, sekali jalan) | 11/13 otomatis, **12/13 manual**. Satu kegagalan nyata (kosakata) lalu diperbaiki dan dicek ulang |
| Golden (79) | 77/79. Dua kasus `unknown` kini dijawab benar dari panduan; harapannya diperbarui dan dicek ulang 2/2 |
| Mock golden / test backend / build FE | 79/79 / 414/414 / berhasil |

## Batasan & biaya

- Lebih banyak jawaban memakai AI. Latensinya ± 4 dtk (p95 ± 5 dtk) dan biayanya ± $0,003–0,004 per
  jawaban LLM.
- AI kadang menambah detail masuk akal yang tidak ada di panduan, dan gaya bahasanya kadang santai.
  Detailnya ada di `chatbot-eval.md`.
- Panduan (`guide.js`) **harus diperbarui** setiap kali menu, alur, atau kebijakan berubah.
- Biaya uji putaran ini: **$0,450** dari key baru (batas $1, sisa ± $0,55).
