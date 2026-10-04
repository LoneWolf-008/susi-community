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
| GET | `/needs/catalog` | login | `APPROVED + OPEN`. Filter `category, sector, source, skill (id/nama), search`. Item memuat `skills[]` |
| GET | `/needs/mine` | requester, liaison | Milik sendiri (liaison: kebutuhan Assisted yang ia catat). Memuat `applicants, applicants_waiting, project_id, project_status, skills[]` |
| GET | `/needs/:id` | login | Belum `APPROVED` hanya untuk pemilik/admin |
| POST | `/needs` | requester, liaison | `title, description, category?, summary?, address?, lat?, lng?, community_id?, skill_ids?[]`. Requester harus anggota komunitas. Masuk antrean moderasi (`PENDING`) |
| PATCH | `/needs/:id` | pemilik | Hanya saat `PENDING`/`REJECTED`; dari `REJECTED` kembali `PENDING` |
| POST | `/needs/:id/withdraw` | pemilik | `reason?`. Tutup lunak (`CLOSED`); 409 bila sudah ada proyek aktif |
| DELETE | `/needs/:id` | pemilik | Sama dengan withdraw (tidak pernah menghapus baris) |
| GET | `/skills` | login | `[{ id, name }]` untuk pilihan keahlian |

## Lamaran

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/applications/mine` | talent | Lamaran saya + status kebutuhan |
| POST | `/applications/needs/:needId` | talent | `message?`. 409 bila sudah melamar |
| GET | `/applications/for-need/:needId` | pemilik | Pelamar + `reputation_points, level, projects_completed, skills[], recent_testimonials[]` (maks 3). Tanpa email |
| PATCH | `/applications/:id/decide` | pemilik | `decision: DITERIMA\|DITOLAK`; saat `DITERIMA` wajib `scope, done_definition` (≥5 karakter), `deadline?` (YYYY-MM-DD, tidak di masa lalu). Membuat proyek `AGREEMENT` |

## Proyek

Status: `AGREEMENT → IN_PROGRESS → AWAITING_VERIFICATION → COMPLETED`, dengan cabang
`REVISION`, `DISPUTED`, `CANCELLED`.

| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/projects/mine` | login | Talenta: proyek yang ia kerjakan; pemilik: proyek dari kebutuhannya |
| GET | `/projects/:id` | pihak proyek, admin | Detail + `deliveries, events, revisions` + kontak kedua pihak |
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
| GET/PATCH | `/talent/profile` | talent | PATCH: `bio?, phone?, extra_info?, skill_ids?[], skills?[] (nama)` |
| GET | `/talent/top` | login | Peringkat reputasi |
| GET | `/talent/:id/testimonials` | login | Testimoni publik (disetujui & `is_public`) |
| GET | `/testimonials/mine` | login | Testimoni yang saya terima |
| POST | `/testimonials` | pihak proyek selesai | `project_id, to_user_id (pihak lawan), text, is_public?` → `PENDING` (antrean moderasi) |
| GET | `/notifications` | login | `unread_only=true` opsional |
| GET | `/notifications/unread-count` | login | `{ count }` |
| PATCH | `/notifications/:id/read` · `/notifications/read-all` · DELETE `/notifications/:id` | login | |
| GET/PATCH | `/settings` | login | `notif_email, notif_whatsapp, notif_talenta, notif_diskusi, show_location` (boolean) |

## Liaison (AgenSUSI)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/liaison/visits` | Filter `status` (`DIRENCANAKAN`, `BERLANGSUNG`, `TERDATA`) |
| GET | `/liaison/visits/:id` | |
| POST | `/liaison/visits` | `community_name, scheduled_date (YYYY-MM-DD), scheduled_time? (HH:MM), community_id?, address?, lat?, lng?, note?, contact_person?` |
| PATCH | `/liaison/visits/:id` | Kolom yang sama (opsional); `status` ditolak |
| POST | `/liaison/visits/:id/start` | `DIRENCANAKAN → BERLANGSUNG` |
| POST | `/liaison/visits/:id/finish` | `note?, need_id?` (kebutuhan yang ia catat sendiri) → `TERDATA` |

Aksi pemilik proksi (lihat pelamar, pilih, verifikasi, revisi, tarik) memakai endpoint kebutuhan,
lamaran, dan proyek di atas.

## Admin

| Method | Path | Keterangan |
|---|---|---|
| GET | `/admin/stats` | `v_platform_stats` lengkap |
| GET | `/admin/moderation` | Filter `item_type, decision` |
| PATCH | `/admin/moderation/:id` | `decision: APPROVED\|REJECTED, reject_reason (wajib saat REJECTED: SPAM\|DUPLIKAT\|SALAH KATEGORI\|TIDAK LAYAK), checklist_layak?, checklist_kategori?`. Hanya saat `PENDING` |
| PATCH | `/admin/testimonials/:id/takedown` | `reason?` |
| GET | `/admin/disputes` · `/admin/disputes/:id` | Filter `status` |
| PATCH | `/admin/disputes/:id/resolve` | `decision: MARK_COMPLETE\|EXTEND_7_DAYS, statement_admin?` |
| POST | `/admin/disputes/:id/messages` | `body` (kedua pihak diberi notifikasi) |
| GET | `/admin/users` · PATCH `/admin/users/:id/status` | Filter `role, status, search`; `status: AKTIF\|DITANGGUHKAN` |
| GET | `/admin/liaisons` · POST `/admin/liaisons` · PATCH `/admin/liaisons/:id/status` | POST: `name, email, password, phone?, target_visits_month?, target_intake_month?` |
| GET | `/admin/audit-logs` | Filter `entity, action, actor_id`; `meta` sudah berupa objek |
