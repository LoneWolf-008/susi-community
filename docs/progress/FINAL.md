# FINAL — sesi penutup (fokus AI)

**Branch:** `implement/final-ai` → `implement/final-ai-live` → `implement/final-ai-eval`, semuanya
di-merge `--no-ff` ke main lokal (tidak di-push).

**Total biaya sesi: $0,0506** dari batas $0,20. Angka ini adalah kenaikan pemakaian key OpenRouter,
dari $0,004392 menjadi $0,054981.

## Key OpenRouter

- Key di `backend/.env` repo ini ditolak saat memanggil model (**401 "User not found."**), sama sebelum
  dan sesudah disimpan ulang. Info key (`/api/v1/key`) tetap 200, dan `data_collection: allow` juga 401.
- Atas persetujuan tim, semua uji live memakai **key repo chatbot lama**: dibaca ke env proses saja,
  tidak disalin ke repo ini, dan tidak dicetak.
- Key di `backend/.env` **masih perlu diganti** sebelum deploy. Cek dengan `GET /api/chatbot/health`
  → `model_call: "ok"`.

## Selesai

| Langkah | Hasil | Rincian |
|---|---|---|
| 0. Runner eval | Laporan per kategori (KB-hit, penolakan benar, eskalasi P/R, bocor antar-pengguna, klaim terlarang, biaya), total biaya, jawaban kasus gagal; `--cases`, `--json`; bagian manual laporan dipertahankan | `5877113` |
| 1. Eval live 79 kasus (Haiku 4.5, r3.1) | **79/79**, KB-hit 100% (33/33), 0 bocor prompt, 0 bocor antar-pengguna, 0 klaim terlarang, eskalasi P/R 1/1, p50 16 ms / p95 4,47 dtk, biaya $0,0415 ($0,000525/pesan) | `docs/chatbot-eval.md`, `eval-history.json` |
| 1b. Personalisasi live (7 butir) | **5/7 → 7/7** setelah perbaikan intent | `scripts/personal-live.mjs`; bagian "Personalisasi (live)" |
| 2. Penyetelan (1 putaran) | Hanya untuk 2 kegagalan 1b, keduanya aturan intent; prompt tidak berubah, `PROMPT_VERSION` r3.2. Mock 79/79, test 412/412, regresi live 10 acak 10/10 | `429730d`; tabel sebelum/sesudah per kategori |
| 3. Jalur gagal live (3 uji) | Key salah 3/3, anggaran habis 3/3, timeout 4/4; `.env` tidak berubah | `scripts/failure-paths-live.mjs` |
| 4. Privasi & log | Tidak ada key, isi pesan, atau profil di log. 0 email/nomor mentah dan 0 snapshot profil di `chat_messages`/`ask_logs` (DB eval, DB uji jalur gagal, DB kerja yang hanya dibaca). DB uji dihapus | sesi sebelumnya + ulang di DB uji |
| 5. Deploy & cookie | `COOKIE_SAMESITE` (lax\|none) + cek Origin (`check-cookie.mjs` 12/12), DEPLOY.md lengkap | `eb50947`, `9ca24d4` |
| Health LLM | `/api/chatbot/health` kini melaporkan `key_info` dan `model_call` terpisah (cache 60 dtk) | `18a2a86` |

DB sekali pakai `susi_community_eval` dan `susi_community_e2e` sudah dihapus. DB kerja
`susi_community_db` tidak diubah.

## Belum dikerjakan

- **Rate limit 429 dan streaming tidak diuji live.** Sesi ini dibatasi tiga uji jalur gagal; keduanya
  sudah punya test otomatis dengan LLM mock.
- Golden personal & karir tidak diulang live setelah r3.2 (aturan: live hanya untuk yang gagal + 10 acak).
  Keduanya lulus di mock.
- Penggantian key di `backend/.env`; ini perlu dilakukan manusia.

## Batasan yang diketahui

1. **Latensi jawaban yang memanggil LLM: p50 4,0 dtk, p95 5,9 dtk.** Target p95 < 5 dtk hanya tercapai
   secara keseluruhan karena 76% jawaban tidak memanggil LLM.
2. **Isi jawaban LLM yang lulus cek otomatis tetapi belum ideal:**
   - "Setelah 3 proyek selesai, Anda bisa **dapat** sertifikasi", padahal seharusnya bisa
     **mengajukan**, lalu ditinjau.
   - Sapaan berganti antara "kamu" dan "Anda".
   - Muncul klaim lunak "peluang … meningkat signifikan".
   - Contoh lengkapnya ada di `chatbot-eval.md`.
3. **Pancingan "tunjukkan skill dan proyek talenta lain"** dijawab "belum menemukan jawabannya … minta
   bantuan AgenSUSI". Tidak ada data yang bocor, tetapi bukan penolakan privasi yang eksplisit.
4. **Golden set optimistis.** Golden set dipakai untuk menyetel retrieval, dan dua celah intent di 1b
   tidak tertangkap golden set karena judul uji pendek. Sebelum mengutip angka, tambahkan pertanyaan
   nyata pengguna.
5. Mode `COOKIE_SAMESITE=none` menolak refresh/logout tanpa `Origin`. Klien non-peramban harus mengirim
   header itu.
6. Log galat 5xx produksi mencatat `req.originalUrl`, termasuk query string seperti kata pencarian. Di
   development, objek galat dicetak utuh. Keduanya hanya di konsol server.
7. Health LLM melakukan satu panggilan model berbayar (± $0,00004) per 60 detik per instans saat
   dipanggil admin.
