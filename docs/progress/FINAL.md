# FINAL — sesi penutup (fokus AI) · SEMENTARA

**Branch:** `implement/final-ai` · **Status:** sebagian, **belum di-merge**. Branch dibiarkan terbuka
untuk langkah 1, 1b, 2, 3, dan 6 setelah key OpenRouter diganti.

**Total biaya sesi sejauh ini: $0.** Pemakaian di OpenRouter tercatat $0, dan semua panggilan model
ditolak sebelum ada token yang terpakai.

## Mengapa berhenti: key ditolak

| Cek | Hasil |
|---|---|
| `OPENROUTER_API_KEY` di `backend/.env` | terisi (diisi tim; tidak pernah dicetak atau di-commit, `.env` di-gitignore) |
| `GET /api/v1/key` (info key, tanpa model) | 200: pemakaian $0, tanpa batas kredit |
| `POST /api/v1/chat/completions` (Haiku 4.5, `max_tokens 5`) | **401 "User not found."** |
| Eval live 79 kasus (percobaan pertama) | 19 jawaban yang butuh LLM jatuh ke KB (`LLMUnavailable`). Hasilnya **tidak dipakai**: laporan & riwayat dikembalikan, dan sesuai aturan sesi mode mock tidak dipakai sebagai pengganti |

Kemungkinan penyebab: akun pemilik key bermasalah (dihapus/belum aktif) atau key dibuat di akun lain.
Solusinya: buat key baru di akun OpenRouter yang punya kredit, ganti nilainya di `backend/.env`, lalu
cek dengan satu completion kecil sebelum melanjutkan.

## Selesai

### 0. Runner eval (commit `5877113`)
- Laporan `docs/chatbot-eval.md` kini memuat metrik **per kategori**:
  - KB-hit, penolakan benar, presisi/recall eskalasi;
  - kebocoran data antar-pengguna, klaim terlarang;
  - biaya.
- Laporan juga memuat total biaya putaran (dari `ask_logs`), jumlah jawaban yang jatuh ke KB karena
  galat LLM, dan jawaban model lengkap untuk kasus yang gagal.
- `eval-history.json` ikut menyimpan metrik per kategori, tanpa isi jawaban.
- Opsi baru `--cases id1,id2` untuk uji ulang subset (laporan & riwayat tidak ditulis) dan `--json`
  untuk hasil per kasus. Bagian laporan setelah penanda `<!-- manual: … -->` tidak tertimpa runner,
  sehingga bagian seperti "Personalisasi (live)" aman.
- Mode mock tetap **79/79**, dan test eval CI lulus.

### 4. Privasi dan log
| Cek | Hasil |
|---|---|
| `git grep` key (`sk-or-…`, `OPENROUTER_API_KEY=<nilai>`) | hanya key palsu di test (`sk-or-v1-JANGAN-BOCOR-999`, `sk-or-v1-RAHASIA-UJI-123`) |
| Logger/berkas log | tidak ada logger berkas (morgan/winston/pino/appendFile); `*.log` di-gitignore |
| `console.*` di backend (tanpa test) | tidak ada yang mencetak isi pesan, `req.body`, profil, email, atau telepon. Chatbot hanya mencetak nama kelas galat. Log 5xx produksi tidak memuat `err.message` mentah. Frontend `src/` tanpa `console.*` |
| DB eval (79 sesi, 162 pesan, 81 `ask_logs`) | **0** email mentah, **0** deretan ≥ 10 digit, **0** blok konteks prompt (`<user_profile>`, `<recommendations>`, `<user_data>`, `<kb>`) di `chat_messages` (user/assistant) & `ask_logs.question`. PII tersimpan tersamar (`[nomor disamarkan]`, `[email disamarkan]`). Tabel tidak punya kolom snapshot profil |
| DB kerja `susi_community_db` (6 sesi, 47 pesan, 32 `ask_logs`; hanya dibaca) | **0** temuan pada semua pola yang sama, termasuk pesan `agent` |
| Hapus data uji | DB sekali pakai `susi_community_eval` dihapus (runner membuatnya ulang saat eval berikutnya) |

### 5. Deploy dan cookie (commit `eb50947`, `9ca24d4`)
- Env **`COOKIE_SAMESITE`** (`lax` | `none`, bawaan `lax`):
  - `none`: `Secure` dipaksa, dan `/auth/refresh` & `/auth/logout` menolak **403** bila `Origin` tidak
    tercantum di `FRONTEND_URL`.
  - `clearCookie` memakai atribut yang sama.
  - `.env.example` diperbarui.
- Verifikasi `node scripts/check-cookie.mjs`:
  - `lax`: 5/5. Cookie `SameSite=Lax`; refresh tetap diterima dengan Origin benar, lain, atau kosong
    (perilaku lama tidak berubah).
  - `none`: 7/7. Cookie `SameSite=None; Secure`; Origin lain/kosong → 403; Origin benar → 200; logout
    dengan Origin lain → 403; logout benar menghapus cookie dengan `SameSite=None; Secure`.
  - Test auth & env yang ada tetap lulus (20/20).
- `docs/DEPLOY.md` lengkap: satu origin vs lintas domain (termasuk rewrite `/api` Vercel), trust proxy,
  disk/memori tidak permanen, env produksi, migrasi & seed (`--force`), health check, dan cek setelah
  deploy. `GET /api/health` tanpa auth **sudah ada**, jadi tidak ditambah.

## Menunggu key

| Langkah | Isi |
|---|---|
| 1 | Eval live 79 kasus → `chatbot-eval.md` + `eval-history.json`; daftar kasus gagal beserta jawaban |
| 1b | Pemeriksaan live personalisasi R3 (7 butir) → bagian "Personalisasi (live)" |
| 2 | Satu putaran penyetelan prompt bila ada yang gagal (mock 79/79, live ulang untuk kasus gagal + 10 acak), sebelum/sesudah per kategori |
| 3 | Uji jalur gagal live: key salah, anggaran habis, timeout, rate limit 429, streaming |
| 6 | FINAL.md akhir (termasuk total biaya), merge `--no-ff` ke main lokal |

Batas biaya yang tersisa: **$0,20** (belum terpakai).

## Batasan yang diketahui (sejauh ini)

1. ~~`GET /api/chatbot/health` tidak memanggil model~~ **Diperbaiki** di branch `implement/final-ai-live`.
   - Health kini melaporkan `key_info` dan `model_call` terpisah. `model_call` adalah satu panggilan
     `max_tokens 5`; `status` mengikuti `model_call`, dan hasilnya di-cache 60 detik.
   - Dengan key saat ini, hasilnya `key_info: ok`, `model_call: gagal` (401), `status: error`.
2. **Mode `COOKIE_SAMESITE=none` menolak permintaan refresh/logout tanpa `Origin`.** Peramban selalu
   mengirim `Origin` pada POST lintas situs, tetapi klien non-peramban (mis. `smoke:api`) perlu
   menambahkannya.
3. **Log galat 5xx produksi mencatat `req.originalUrl`**, termasuk query string seperti kata pencarian.
   Di development, objek galat dicetak utuh. Keduanya hanya di konsol server, tidak di berkas.
4. `scripts/check-cookie.mjs` login sebagai admin `.env` di DB yang dikonfigurasi. Token refresh yang
   dibuatnya langsung dicabut lewat logout.
