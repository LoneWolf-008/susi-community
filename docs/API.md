# Referensi API SUSI Community

Basis URL: `/api` (dev: Vite mem-proxy ke `http://localhost:3009`). Semua respons JSON.

## Konvensi

- **Sukses:** `{ "success": true, "message": "...", "data": ... }`
- **Gagal:** `{ "error": { "message": "...", "details": [{ "field", "message" }] } }`. `details` hanya
  ada untuk error validasi (400). Pesan berbahasa Indonesia dan aman ditampilkan ke pengguna.
- **Daftar:** `?page=1&limit=20` (limit maks 50). `data = { items, total, page, limit }`.
- **Autentikasi:** `Authorization: Bearer <accessToken>` (15 menit). Refresh lewat cookie httpOnly
  `susi_refresh_token` di `POST /auth/refresh` (sertakan `credentials: 'include'`).
- **Status penting:** 400 validasi · 401 belum login/token kedaluwarsa · 403 peran/kepemilikan ·
  404 tidak ada (atau bukan milik Anda) · 409 transisi status tidak sah · 413 berkas terlalu besar · 429 rate limit.
- **Pemilik efektif kebutuhan:** `requester_id`, atau liaison pembuatnya (`created_by`) untuk jalur
  Assisted (`source = AGENSUSI`, `requester_id = NULL`). Liaison bertindak sebagai pemilik proksi.

Peran: `requester` (komunitas), `talent`, `liaison` (AgenSUSI), `admin`. "Login" = peran apa pun.

## Publik (tanpa login, rate limit 60/menit per IP)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/public/stats` | `projects_completed, projects_running, talents_total, communities_total, communities_helped, needs_open, visits_total` |
| GET | `/public/catalog` | Kebutuhan terbuka, field terbatas (tanpa deskripsi lengkap/alamat/koordinat/nama komunitas). Filter `category, sector, search` |
| GET | `/public/communities` | Titik peta: koordinat dibulatkan ±100 m (null bila pembuat mematikan `show_location`), `needs_open`, `projects_completed`, plus `sectors[]` |
| POST | `/public/visit` | Catat kunjungan landing (sekali per sesi; 10/15 menit per IP) |
| GET | `/health` | Cek server |

## Auth

| Method | Path | Peran | Body |
|---|---|---|---|
| POST | `/auth/register` | publik | `email, password (10–72), role: requester\|talent, name, extra_info?` → `{ user, accessToken }` + cookie |
| POST | `/auth/login` | publik | `email, password` → `{ user, accessToken }` + cookie. 10 percobaan gagal / 15 menit per IP |
| POST | `/auth/refresh` | cookie | → `{ user, accessToken }` (token diputar) |
| POST | `/auth/logout` | cookie | tidak butuh access token |
| GET | `/auth/me` | login | → `{ user }` |
| PATCH | `/auth/me` | login | `name?, phone?, bio?, extra_info?, avatar_url? (http/https)` |

## Kebutuhan

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/needs/catalog` | login | `APPROVED + OPEN`. Filter `category, sector, source, skill (id/nama), search`. Item memuat `skills[]` dan `my_application_status` (status lamaran pengguna ini, atau `null`) |
| GET | `/needs/mine` | requester, liaison | Milik sendiri (liaison: kebutuhan Assisted yang ia catat). Memuat `applicants, applicants_waiting, project_id, project_status, skills[]` |
| GET | `/needs/:id` | login | Belum `APPROVED` hanya untuk pemilik/admin. Pemilik/admin juga menerima `project_id, project_status` (proyek terbaru, bisa `CANCELLED`). Semua menerima `my_application_status` |
| POST | `/needs` | requester, liaison | `title, description, category?, summary?, address?, lat?, lng?, community_id?, skill_ids?[]`. Requester harus anggota komunitas. Masuk antrean moderasi (`PENDING`) |
| PATCH | `/needs/:id` | pemilik | Hanya saat `PENDING`/`REJECTED`; dari `REJECTED` kembali `PENDING` |
| POST | `/needs/:id/withdraw` | pemilik | `reason?`. Tutup lunak (`CLOSED`); 409 bila sudah ada proyek aktif |
| DELETE | `/needs/:id` | pemilik | Sama dengan withdraw (tidak pernah menghapus baris) |
| GET | `/skills` | login | `[{ id, name }]` untuk pilihan keahlian |

## Lamaran

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/applications/mine` | talent | Lamaran saya + `need_status`, `project_id` (bila diterima). Filter `?status=MENUNGGU\|DITERIMA\|DITOLAK` (lain → 400) |
| POST | `/applications/needs/:needId` | talent | `message?`. 409 bila sudah melamar |
| GET | `/applications/for-need/:needId` | pemilik | Pelamar + `reputation_points, level, projects_completed, skills[], recent_testimonials[]` (maks 3). Tanpa email |
| PATCH | `/applications/:id/decide` | pemilik | `decision: DITERIMA\|DITOLAK`; saat `DITERIMA` wajib `scope, done_definition` (≥5 karakter), `deadline?` (YYYY-MM-DD, tidak di masa lalu). Membuat proyek `AGREEMENT` |

## Proyek

Status: `AGREEMENT → IN_PROGRESS → AWAITING_VERIFICATION → COMPLETED`, dengan cabang
`REVISION`, `DISPUTED`, `CANCELLED`.

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/projects/mine` | login | Talenta: proyek yang ia kerjakan; pemilik: proyek dari kebutuhannya |
| GET | `/projects/:id` | pihak proyek, admin | Detail + `deliveries, events, revisions, testimonials` (dua arah, tanpa yang diturunkan admin) + kontak kedua pihak |
| PATCH | `/projects/:id/agree` | talent (pemilik proyek) | `AGREEMENT → IN_PROGRESS` |
| POST | `/projects/:id/cancel` | talent | `reason` (≥5). Dari `AGREEMENT/IN_PROGRESS/REVISION` → `CANCELLED`; kebutuhan kembali `OPEN` |
| POST | `/upload/delivery` | talent | multipart field `file` (zip, rar, pdf, png, jpg, doc, docx, txt, mp4, mov; ≤25 MB) → `{ file_name, file_path, file_size }` |
| POST | `/projects/:id/deliveries` | talent | `file_path` (dari unggah) dan/atau `link_url` (http/https), `file_name?` → `AWAITING_VERIFICATION` |
| GET | `/upload/delivery/:filename` | talenta/pemilik/admin proyek | Unduh berkas hasil |
| POST | `/projects/:id/verify` | pemilik, admin | `testimonial?` (≤1000). Wajib talenta sudah menandai selesai. → `COMPLETED`, reputasi +1 |
| POST | `/projects/:id/revisions` | pemilik | `note`. `AWAITING_VERIFICATION → REVISION` |
| POST | `/projects/:id/dispute` | pihak proyek | `summary, statement?`. Dari `IN_PROGRESS/AWAITING_VERIFICATION/REVISION` |
| GET | `/projects/:id/dispute` | pihak proyek, admin | Sengketa terakhir + `events[]` + `messages[]` (pesan admin) |
| POST | `/projects/:id/dispute/statement` | pihak proyek | `statement`. Selama sengketa belum `SELESAI` |

## Komunitas & mading

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/communities` | login | Filter `sector, type, search, mine=true`. Item memuat `is_member` |
| GET | `/communities/:id` | login | Detail + anggota |
| POST | `/communities` | login | `name, type?, description?, leader_name?, leader_role?, established_at?, whatsapp?, address?, lat?, lng?`. Requester otomatis PENGURUS; liaison mencatat sebagai `AGENSUSI` |
| POST | `/communities/:id/join` · DELETE `/communities/:id/leave` | login | |
| GET | `/discussions` | login | Filter `community_id, category` (limit default 50) |
| GET | `/discussions/:id` | login | Topik + balasan |
| POST | `/discussions` | login | `text, category?, community_id?, pos_x?, pos_y?, rotation?, color? (#RRGGBB)` |
| POST | `/discussions/:id/replies` | login | `text, community_id?` (penulis topik diberi notifikasi) |
| PATCH | `/discussions/:id/position` | penulis topik | `pos_x, pos_y (0–32767), rotation? (−45..45)` |

## Talenta, testimoni, notifikasi, pengaturan

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET/PATCH | `/talent/profile` | talent | GET: `user, profile (reputation_points, level, next_level_target), skills[], projects[]` (+ `community_name, community_verified_at`). PATCH: `bio?, phone?, extra_info?, skill_ids?[], skills?[] (nama)` |
| GET | `/talent/top` | login | Peringkat reputasi |
| GET | `/talent/:id/testimonials` | login | Testimoni publik (disetujui & `is_public`) |
| GET | `/testimonials/mine` | login | Testimoni yang saya terima |
| POST | `/testimonials` | pihak proyek selesai | `project_id, to_user_id (pihak lawan), text, is_public?` → `PENDING` (antrean moderasi) |
| GET | `/notifications` | login | `unread_only=true` opsional |
| GET | `/notifications/unread-count` | login | `{ count }`. Dasbor mem-polling tiap 30 detik (berhenti saat tab peramban tidak aktif) |
| PATCH | `/notifications/:id/read` · `/notifications/read-all` · DELETE `/notifications/:id` | login | |
| GET/PATCH | `/settings` | login | `notif_email, notif_whatsapp, notif_talenta, notif_diskusi, show_location, allows_ai_chat, allows_chat_history_storage` (boolean). `notif_talenta`/`notif_diskusi` = 0 → notifikasi bertipe `talenta`/`diskusi` tidak dibuat; `show_location` = 0 → titik & sektor komunitas yang didaftarkan pengguna itu disembunyikan di peta publik (komunitasnya tetap terdaftar); `allows_ai_chat` & `allows_chat_history_storage` → privasi Tanya SUSI (lihat bagian Chatbot). Email & WhatsApp belum punya kanal pengiriman |

## Liaison (AgenSUSI)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/liaison/summary` | `targets {visits_month, intake_month}`, `month {visits, intake}` (bulan berjalan), `needs {total, pending, open, in_progress, completed}`, `weekly_visits[4]` (kunjungan terdata per minggu, terlama → minggu ini), `escalations {pending, mine, stale}` (antrean chatbot; `mine` = diklaim saya, `stale` = pending > 24 jam) |
| GET | `/liaison/visits` | Filter `status` (`DIRENCANAKAN`, `BERLANGSUNG`, `TERDATA`) dan `date` (`YYYY-MM-DD`, agenda satu hari) |
| GET | `/liaison/visits/:id` | |
| POST | `/liaison/visits` | `community_name, scheduled_date (YYYY-MM-DD), scheduled_time? (HH:MM), community_id?, address?, lat?, lng?, note?, contact_person?` |
| PATCH | `/liaison/visits/:id` | Kolom yang sama (opsional); `status` ditolak |
| POST | `/liaison/visits/:id/start` | `DIRENCANAKAN → BERLANGSUNG` |
| POST | `/liaison/visits/:id/finish` | `note?, need_id?` (kebutuhan yang ia catat sendiri) → `TERDATA` |

Aksi pemilik proksi (lihat pelamar, pilih, verifikasi, revisi, tarik) memakai endpoint kebutuhan,
lamaran, dan proyek di atas.

### Antrean eskalasi chatbot (liaison & admin)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/liaison/escalations` | `?status=open` (default: pending + assigned) `\|pending\|assigned\|resolved\|closed\|all`, `mine=true`, `page/limit`. Item: `id, session_id, status, priority (normal\|high), score, reasons[], summary, summary_source (llm\|rule), contact, user {id, name, role} \| null, assigned_to {id, name} \| null, stale, resolution, kb_entry_id, created_at, assigned_at, resolved_at, last_active_at`. Juga `counts {pending, assigned, mine, stale}`. Tiket terbuka: prioritas tinggi lalu terlama dulu |
| GET | `/liaison/escalations/:id` | Detail + `messages[]` transkrip sesi (≤ 100 terakhir; pesan pengguna sudah disamarkan PII-nya) |
| PATCH | `/liaison/escalations/:id/claim` | `pending → assigned` ke pemanggil. Sudah diklaim orang lain → 409; klaim ulang oleh pemiliknya → 200 |
| POST | `/liaison/escalations/:id/reply` | `message` (≤ 2000) → pesan `role: 'agent'` di sesi pengguna (dibaca lewat polling sesi); pengguna terdaftar diberi notifikasi. Harus sudah diklaim (pending → 409), oleh pemanggil (lainnya → 403; admin boleh) |
| PATCH | `/liaison/escalations/:id/resolve` | `resolution` (10–2000), `outcome?: resolved\|closed`, `save_as_kb?`, `kb_title?`, `kb_keywords?[]`. `save_as_kb` → entri `kb_entries` berstatus **draft** (`source = Eskalasi #id`) untuk ditinjau admin; tidak dipakai chatbot sebelum disetujui. Admin boleh menutup tiket pending tanpa klaim |

Saat tiket dibuat, semua liaison aktif menerima notifikasi `type = 'eskalasi'`
(`ref_type = 'escalation'`). Ringkasan tiket ≤ 80 kata dibuat LLM dari transkrip bersamaran (PII
disamarkan lagi); bila LLM gagal, tanpa key, atau anggaran habis, ringkasan disusun dari aturan.
Biayanya ikut dihitung ke anggaran harian chatbot. `contact` hanya terlihat oleh liaison/admin dan
tidak pernah dikirim ke LLM.

## Chatbot "Tanya SUSI"

Login opsional: tanpa header `Authorization` = anonim. Header yang dikirim tetapi tidak sah →
401 (klien memperbarui token lalu mengulang), akun ditangguhkan → 403.

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| POST | `/chatbot/message` | semua (anonim boleh) | `{ session_id?, message }` (1–500 karakter). Tanpa `session_id` = percakapan baru. → `{ session_id, user_message_id, message: { id, role, content }, intent, source, sources: [{ id, title }], escalation_suggested, stored }`. `stored = false` → isi percakapan tidak disimpan (pilihan pengguna); klien tidak perlu mengingat `session_id` untuk dipulihkan. Sesi berisi ≥ 200 pesan → 409 |
| POST | `/chatbot/stream` | semua (anonim boleh) | Body sama dengan `/message`; jawaban lewat SSE (lihat di bawah). Galat sebelum stream dimulai (validasi, sesi, 409, 429) tetap JSON biasa |
| POST | `/chatbot/feedback` | pemilik sesi (anonim: pemegang `session_id`) | `{ session_id, message_id, value: 1\|-1 }` (👍/👎 untuk jawaban asisten) → `ask_logs.feedback`; boleh diubah. Pesan bukan jawaban/beda sesi/sesi orang lain → 404 |
| POST | `/chatbot/escalate` | pemilik sesi (anonim: pemegang `session_id`) | Tombol "Hubungi AgenSUSI". `{ session_id, contact? }`; `contact` (email/WhatsApp) **wajib untuk anonim**. → 201 `{ escalation: { id, status, priority, created_at }, already_open: false, available, message }` (`message` = konfirmasi yang juga tersimpan di sesi). Sesi yang sudah punya tiket terbuka → 200 `{ escalation, already_open: true, message: null }`. `available = false` bila tidak ada liaison aktif atau di luar jam layanan: tiket tetap dibuat, tampilkan WhatsApp resmi. Pengguna masuk yang mengeskalasi sesi anonim mengklaimnya. Sesi tanpa tanya-jawab → 400. Dihitung kuota chatbot |
| GET | `/chatbot/suggestions` | semua (anonim boleh) | `{ suggestions: string[] }`: 4 saran pertanyaan sesuai peran (anonim → saran publik). Setiap saran diuji terjawab langsung oleh KB |
| GET | `/chatbot/session/:id` | pemilik sesi | `?after=<messageId>` untuk polling. → `{ session, messages: [{ id, role: 'user'\|'assistant'\|'agent', content, created_at }], escalation: { id, status, created_at } \| null }` (tiket terakhir sesi; balasan AgenSUSI = `role: 'agent'`) |
| DELETE | `/chatbot/session/:id` | pemilik sesi (anonim: pemegang `session_id`) | Hapus satu percakapan: pesan, tiket eskalasinya (tiket terbuka ikut dibatalkan), dan notifikasi tiket itu. Baris `ask_logs` dianonimkan (pertanyaan dikosongkan, `user_id` dilepas). → `{ deleted: 1 }`; sesi orang lain/tidak ada → 404 |
| DELETE | `/chatbot/history` | login | Hapus seluruh percakapan milik akun dengan aturan yang sama, termasuk melepas `ask_logs` lama dari akun. → `{ deleted: <jumlah sesi> }` |
| GET | `/chatbot/health` | admin | `{ provider, model, fallback_models, configured, status: 'ok'\|'error'\|'not_configured', credits? }` — memeriksa key lewat `GET /api/v1/key` OpenRouter tanpa memanggil model; key/label tidak pernah dikembalikan |

Akses sesi: sesi milik pengguna hanya untuk pemiliknya (selain itu 404). Sesi anonim dibuka dengan
`session_id` (UUID acak). Bila pengguna yang sudah masuk melanjutkan sesi anonim, sesi itu
diklaim menjadi miliknya dan tidak bisa lagi dibuka secara anonim.

**Nilai respons.** `intent`: `faq`, `howto`, `status_data`, `complaint`, `escalation_request`,
`smalltalk`, `out_of_scope`, serta `injection`/`abusive` untuk pesan yang ditolak pra-pemeriksaan.
`source`: `kb` (entri KB langsung, tanpa LLM), `llm`, `cache` (jawaban LLM yang sama sebelumnya),
`data` (ringkasan data akun tanpa LLM), `rule` (jawaban tetap: sapaan, penolakan, di luar topik,
ajakan masuk), `fallback` ("belum tahu"). `escalation_suggested = true` → tampilkan tombol
"Hubungi AgenSUSI". Disarankan bila pipeline tidak bisa membantu (jawaban tidak ditemukan, LLM gagal,
pesan kasar) atau skor sinyal percakapan ≥ `CHATBOT_ESCALATION_THRESHOLD` (50). Bobot sinyal:
permintaan eksplisit 100 · topik sensitif (sengketa, penipuan, data pribadi) 50 · keluhan 40 ·
pertanyaan sama > 2× 35 · dua "belum tahu" berturut-turut 30 · > 5 giliran tanpa 👍 30. Tidak
disarankan lagi selama sesi punya tiket terbuka. Tiket tidak pernah dibuat otomatis.

**Streaming.** Event SSE (`fetch` + `ReadableStream`; `EventSource` hanya mendukung GET):

| Event | Data |
|---|---|
| `start` | `{ session_id, user_message_id, stored }` — dikirim pertama, sebelum jawaban |
| `delta` | `{ content }` — potongan teks, ditempel berurutan |
| `done` | Isi sama dengan respons `/message` + `replace`. Bila `replace = true`, ganti seluruh teks yang sudah tampil dengan `message.content` (LLM gagal di tengah jalan atau keluaran diblokir) |
| `error` | `{ message, session_id }` — galat tak terduga setelah stream dimulai |

Klien yang menutup koneksi membatalkan permintaan ke LLM; jawaban sebagian tetap disimpan.

**Pipeline (T12).** Pesan disaring dulu: PII (email, nomor HP, deretan ≥ 10 digit) disamarkan
sebelum disimpan dan dikirim ke LLM; upaya injeksi prompt dan pesan yang hanya berisi kata kasar
dijawab tetap tanpa LLM. Intent data pribadi ("status proyek saya", "lamaran saya", "notifikasi
saya", "poin saya") hanya untuk pengguna yang masuk dan hanya membaca data milik `req.user.id`;
anonim diminta masuk. Retrieval memakai FULLTEXT (`title, keywords, reply`) dengan kueri yang
dibakukan (slang & sinonim), filter `status = 'active'` dan audiens (anonim → `all`, `public`;
pengguna → `all` + perannya; admin → semua), lalu diurutkan ulang dengan ambang relevansi (seri
dipecah urutan kurasi `sort_order`). Kata kasar dan penanda samaran beserta labelnya ("email saya
[email disamarkan]") tidak ikut dicari. Entri yang mencakup penuh pertanyaan dijawab langsung tanpa
LLM (`CHATBOT_KB_DIRECT=false` mematikannya untuk evaluasi prompt); jawaban LLM disimpan di cache
memori (kunci = pertanyaan baku + audiens). LLM menerima prompt sistem (`PROMPT_VERSION`), `<kb>`,
`<user_data>`, dan 6 giliran terakhir. Keluarannya disaring: tautan di luar host `FRONTEND_URL`,
`wa.me`, dan `CHATBOT_ALLOWED_DOMAINS` dihapus; kebocoran prompt diganti jawaban penolakan.
Tanpa key, LLM gagal, atau anggaran harian habis → jawaban KB (mode hemat diberi catatan).

**Kuota.** Per menit: 12 per akun; anonim 6 per IP + sesi dan 30 per IP. Per hari: 100 per
akun; anonim 20 per sesi dan 300 per IP. Melewati batas → 429 dengan pesan ramah. Semua angka
bisa diatur lewat env `CHATBOT_*`.

Setiap jawaban dicatat di `ask_logs`: `intent`, `kb_entry_id`, `model`, `prompt_version`, token,
latensi, `cost_usd`, `cache_hit`, `llm_error` (nama galat LLM, `OutputBlocked`,
`BudgetExceeded`, `ClientAborted`), dan `feedback`.

**Privasi (T15).** Pengaturan per akun (`PATCH /settings`, bawaan aktif):

- `allows_ai_chat = 0`: pesan tidak pernah dikirim ke penyedia LLM. Jawaban dari KB, aturan, atau
  ringkasan data; ringkasan tiket eskalasi dibuat tanpa LLM.
- `allows_chat_history_storage = 0`: isi pesan disimpan sebagai `[tidak disimpan]` dan pertanyaan
  di `ask_logs` dikosongkan (metadata biaya/kualitas tetap). Riwayat tidak dikirim ke LLM, jadi tiap
  pesan dijawab berdiri sendiri. Sinyal eskalasi giliran itu dinilai dari teks di memori; ringkasan
  tiket hanya memuat alasan dan catatan bahwa riwayat tidak disimpan.

Pengunjung anonim memakai bawaan dan bisa menghapus percakapannya dengan `DELETE /chatbot/session/:id`.
Retensi: isi chat lebih tua dari `CHATBOT_RETENTION_DAYS` (bawaan 90; 0 = mati) dihapus harian oleh
server (atau `npm run chat:retention`): pertanyaan `ask_logs` dianonimkan, `chat_messages` dihapus,
sesi kosong yang lama dihapus beserta tiket selesainya. Sesi dengan tiket terbuka dilewati. Rate
limit anonim memakai HMAC IP dengan garam acak per proses (di memori); IP mentah tidak pernah disimpan
oleh chatbot.

## Admin

| Method | Path | Keterangan |
|---|---|---|
| GET | `/admin/stats` | `v_platform_stats` lengkap + `moderation {pending, approved, rejected}`, `users_by_role` (akun aktif), `weekly_visits[6]` (kunjungan situs per minggu, terlama → minggu ini) |
| GET | `/admin/moderation` | Filter `item_type, decision`. Tiap item membawa `detail`: isi kebutuhan (`description, category, community_name, created_by_name, …`) atau testimoni (`text, from_name, to_name, project_title`) |
| PATCH | `/admin/moderation/:id` | `decision: APPROVED\|REJECTED, reject_reason (wajib saat REJECTED: SPAM\|DUPLIKAT\|SALAH KATEGORI\|TIDAK LAYAK), checklist_layak?, checklist_kategori?`. Hanya saat `PENDING` |
| PATCH | `/admin/testimonials/:id/takedown` | `reason?` |
| GET | `/admin/disputes` · `/admin/disputes/:id` | Filter `status`. Memuat `requester_name, talent_name`; detail juga `scope, done_definition, deadline, events[], messages[]` |
| PATCH | `/admin/disputes/:id/resolve` | `decision: MARK_COMPLETE\|EXTEND_7_DAYS, statement_admin?` |
| POST | `/admin/disputes/:id/messages` | `body` (kedua pihak diberi notifikasi) |
| GET | `/admin/users` · PATCH `/admin/users/:id/status` | Filter `role, status, search`; `status: AKTIF\|DITANGGUHKAN` |
| GET | `/admin/liaisons` · POST `/admin/liaisons` · PATCH `/admin/liaisons/:id/status` | POST: `name, email, password, phone?, target_visits_month?, target_intake_month?` |
| GET | `/admin/audit-logs` | Filter `entity, action, actor_id`; `meta` sudah berupa objek |
| GET | `/admin/kb` | Basis pengetahuan Tanya SUSI. Filter `status=all\|active\|draft\|archived`, `search` (judul/kata kunci/jawaban), `page/limit`. Draft dulu. Item: `id, slug, title, category, keywords, reply, audience, status, source, sort_order, updated_at, escalation_id` (draft hasil eskalasi). Juga `counts {active, draft, archived}` |
| POST | `/admin/kb` | `title (3–200), keywords (teks dipisah koma atau daftar), reply (10–2000), category?, audience?, status? (default draft), source?`. **Entri aktif wajib punya `source`** → 400 bila kosong |
| PATCH | `/admin/kb/:id` | Kolom yang sama (opsional). Menyetujui draft = `{ status: 'active' }` (sumber wajib ada); arsip = `{ status: 'archived' }`. Setiap perubahan KB menyinkronkan indeks FULLTEXT dan mengosongkan cache jawaban, sehingga langsung berlaku di chatbot. Tercatat di audit log (`CREATE_KB`, `UPDATE_KB`, `APPROVE_KB`, `ARCHIVE_KB`, `UNPUBLISH_KB`) |
| GET | `/admin/chatbot/unanswered` | `?days=30` (1–365). Pertanyaan yang belum terjawab KB atau dinilai 👎, dikelompokkan per pertanyaan baku: `items [{ question, count, unanswered, thumbs_down, last_at }]` (maks. 50, terbanyak dulu) |
| GET | `/admin/chatbot/stats` | Hari ini: `today { answers, llm, cache, unanswered, thumbs_up, thumbs_down, avg_latency_ms }`, `cost_today_usd`, `budget_usd`, `budget_exceeded`, `llm { provider, model, configured }`, `escalations { pending, assigned }`, `kb { active, draft, archived }` |
