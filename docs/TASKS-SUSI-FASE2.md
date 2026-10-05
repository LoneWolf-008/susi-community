# SUSI Community — Task Plan Fase 2

Lanjutan setelah T0–T15. Cakupan: masukan tester (UX + chatbot), responsive mobile, rekomendasi berbasis profil (AI), sertifikasi talenta, dan UX alih-ke-AgenSUSI. **T16 (QA & demo) sengaja dijalankan paling akhir**, lalu diperluas dengan alur baru (lihat bagian akhir).

Simpan sebagai `docs/TASKS-FASE2.md`. Prompt pembuka yang sama seperti Fase 1:

```
Baca CLAUDE.md, docs/PRD.md, dan docs/TASKS-FASE2.md.
Kerjakan HANYA task <ID>. Baca dulu kondisi kode terkini (nama file/komponen
dari Fase 1 bisa berbeda dari yang disebut di sini) sebelum mengubah apa pun.
Jangan menyentuh file di luar scope. Commit per sub-bagian, tulis ringkasan
di docs/progress/<ID>.md.
```

## Aturan ringan untuk semua task (supaya tidak lama)

- **Tidak ada test baru**, kecuali fungsi murni scoring di R1 dan tambahan golden set di R3.
- Perubahan skema hanya lewat `backend/db/migrations/`. Tiap task **memperbarui seed demo** agar fiturnya terlihat tanpa input manual.
- Semua komponen baru wajib nyaman di 360 px (tanpa scroll horizontal, target sentuh ≥ 44 px, input font ≥ 16 px).
- Lint FE bersih dan `node --check` BE lolos sebelum commit.

## Asumsi yang perlu dikonfirmasi

1. **"Berita" = postingan/topik mading.** Kolom `discussion_topics.deleted_at` sudah ada tetapi belum ada endpoint hapus. Bila "berita" ternyata fitur lain, kabari saya sebelum U1.
2. **Pencocokan skill dihitung oleh aturan yang terukur (deterministik); LLM hanya menjelaskan.** Lebih murah, bisa diaudit, dan tidak mengarang proyek. "AI belajar dari profil" di sini berarti **konteks personal disuntikkan saat menjawab**, bukan fine-tuning.
3. **Konflik dengan PRD §4 dan §8-P2.** PRD v1 menyebut pencocokan otomatis sebagai *non-goal*. Fitur ini harus dibingkai sebagai **rekomendasi, bukan keputusan otomatis** (manusia tetap memilih), dan PRD/proposal diberi addendum agar tidak tampak inkonsisten di mata juri. Addendum dikerjakan di R1.
4. **Talenta masuk daftar rekomendasi secara default** (dengan toggle yang jelas di pengaturan dan pemberitahuan saat daftar), karena tanpa itu rekomendasi untuk komunitas kosong. Ubah ke opt-in bila kamu ingin lebih ketat.
5. **Sertifikasi:** syarat bawaan ≥ 3 proyek `COMPLETED`; keputusan oleh admin atau liaison.

## Peta task

| ID | Task | Ukuran | Bergantung pada |
|---|---|---|---|
| U1 | Komunitas (gabung + persetujuan) & Mading (durasi, hapus) | M | — |
| R1 | Mesin rekomendasi BE | M | — (paralel dengan U1) |
| R2 | Rekomendasi di dashboard Talenta/Komunitas | M | R1 |
| R3 | Chatbot personal: profil + karier + rekomendasi | M | R1 |
| U6 | Section AgenSUSI saat AI mengalihkan percakapan | M | — |
| U5 | Sertifikasi talenta | M | — |
| U2 | Peta dengan marker (mapcn / MapLibre) | S–M | — |
| U3 | Responsive A: shell, dashboard, tabel, modal | M | fitur U1–U6 selesai |
| U4 | Responsive B: halaman publik, form, chat, mading, peta, performa | M | U3 |
| T16 | QA end-to-end & demo (diperluas) | M | semua |

**Urutan yang disarankan:** U1 → R1 → R2 → R3 → U6 → U5 → U2 → U3 → U4 → T16.
**Garis potong bila waktu sempit:** wajib U1, R1, R2, R3, U6, U3. Disarankan U4 dan U5. U2 boleh dipangkas menjadi sekadar mengganti marker.

---

## TASK U1 — Komunitas (gabung + persetujuan) & Mading

**Branch:** `implement/U1-komunitas-mading` · **Ukuran:** M

**Masukan tester:** hilangkan "gabung komunitas" di peran Komunitas, pindahkan ke Talenta dengan persetujuan; komunitas bisa menghapus berita; pembuatan topik mading punya pilihan lama dipajang.

**BE (migrasi + endpoint)**
1. `community_members`: tambah `status ENUM('PENDING','ACTIVE','REJECTED') NOT NULL DEFAULT 'ACTIVE'`, `message`, `decided_by`, `decided_at`. Baris lama tetap `ACTIVE`.
2. Join hanya untuk **talenta**:
   - `POST /communities/:id/join` (`requireRole('talent')`) → `PENDING` (+ pesan singkat opsional). Tolak bila sudah anggota/pending (409).
   - `DELETE /communities/:id/join` → batalkan permintaan atau keluar.
   - `GET /communities/:id/join-requests` dan `PATCH /communities/:id/join-requests/:userId` `{decision: 'ACTIVE'|'REJECTED'}`. Pemberi keputusan: anggota `PENGURUS` komunitas itu; bila komunitas tidak punya pengurus berakun (dibuat liaison), liaison pembuat atau admin. Kirim notifikasi ke talenta dan ke pengurus saat ada permintaan.
   - `members_count` naik **hanya saat disetujui** (saat ini naik langsung saat join) dan turun saat keluar.
3. Posting/membalas di mading yang terikat `community_id` mensyaratkan keanggotaan `ACTIVE` (atau liaison/admin). Perbarui pengecekan yang dibuat di T2.8.
4. Mading:
   - Migrasi `discussion_topics.expires_at DATETIME NULL` + indeks.
   - `createTopic` menerima `duration_days` ∈ {1, 3, 7, 14, 30}, default 7. Daftar topik menyaring `expires_at IS NULL OR expires_at > NOW()`; respons memuat `expires_at`.
   - `PATCH /discussions/:id/extend` `{duration_days}` (pemilik) memperpanjang masa pajang.
   - `DELETE /discussions/:id` → soft delete (`deleted_at`). Boleh oleh pemilik topik, `PENGURUS` komunitas terkait, atau admin. Pemilik balasan dapat menghapus balasannya (`DELETE /discussions/replies/:id`).

**FE**
- **Dashboard Komunitas:** hapus tombol/aksi "Gabung" dan "Keluar". Tampilkan panel "Permintaan bergabung" (setujui/tolak) untuk komunitas yang ia kelola.
- **Dashboard Talenta:** tab baru "Komunitas": daftar + pencarian, tombol "Ajukan gabung" (modal pesan singkat), chip status (Menunggu/Anggota/Ditolak), keluar/batalkan.
- **Mading:** selektor durasi pada form topik (1/3/7/14/30 hari), penanda sisa waktu pada kartu ("berakhir 2 hari lagi"), tombol Perpanjang dan Hapus (dengan konfirmasi) bagi yang berhak.
- Perbarui teks bantuan chatbot/KB yang masih menyebut komunitas "bergabung" lewat dashboard komunitas.

**Seed demo:** satu permintaan gabung `PENDING`, satu topik yang hampir kedaluwarsa, satu topik tanpa durasi pendek.

**Acceptance:** talenta mengajukan gabung → pengurus menerima notifikasi dan menyetujui → talenta bisa memposting di mading komunitas itu; peran Komunitas tidak lagi melihat tombol gabung (dan `POST /join` oleh requester → 403); topik berdurasi 1 hari hilang dari daftar setelah `expires_at` terlampaui; pemilik dan pengurus dapat menghapus, pengguna lain tidak (403).

---

## TASK R1 — Mesin rekomendasi (BE)

**Branch:** `implement/R1-recommendation-engine` · **Ukuran:** M

**Tujuan:** menghitung kecocokan talenta ↔ kebutuhan secara deterministik dan dapat dijelaskan.

**Pekerjaan**
1. **Normalisasi skill.** Talenta bisa menambah skill bebas (`talentController.updateProfile`), sehingga "ReactJS", "react" dan "React.js" menjadi tiga skill berbeda dan merusak pencocokan. Buat `utils/skillNormalize.js` (lowercase, trim, hapus titik/spasi berlebih, peta alias: reactjs→React, js→JavaScript, nodejs→Node.js, dst.), terapkan saat menyimpan, dan tulis migrasi yang menggabungkan duplikat di tabel `skills`.
2. **Fungsi skor murni** `services/recommendation/score.js` → `scoreMatch(talent, need)` mengembalikan `{ score 0–100, matched_skills[], missing_skills[], reasons[], confidence }`. Bobot awal (konstanta di satu tempat):
   - Cakupan skill kebutuhan oleh skill talenta: 50
   - Kesamaan kategori dengan proyek yang pernah diselesaikan/dilamar: 15
   - Komunitas yang sama (talenta anggota `ACTIVE`): 10
   - Kecocokan sektor/lokasi: 5
   - Reputasi/level dan sertifikasi (bonus kecil, jangan menghukum pemula): 10
   - Beban kerja (penalti bila ≥ 2 proyek aktif): −10
   - Kebaruan kebutuhan: 5
   - **Cold start:** kebutuhan tanpa `need_skills` memakai kecocokan kata kunci judul/deskripsi terhadap skill talenta, dengan `confidence: 'low'`. Talenta tanpa skill → tidak dihitung, kembalikan petunjuk "lengkapi skill".
3. **Endpoint**
   - `GET /api/recommendations/needs` (talenta): kebutuhan `OPEN` + `APPROVED` yang belum dilamar dan belum punya proyek aktif, urut skor, paginasi, minimal skor yang dapat diatur.
   - `GET /api/recommendations/talents?need_id=` (pemilik efektif kebutuhan, termasuk liaison): gabungan **pelamar** (`applied: true`) dan **talenta non-pelamar** yang bersedia tampil (`show_in_recommendations`), tanpa akun ditangguhkan. Hanya field yang sudah boleh dilihat requester pada pelamar: nama, level, skills, jumlah proyek selesai, sertifikasi.
   - `GET /api/catalog` (yang sudah ada) menerima `sort=match` untuk talenta.
4. **Undang melamar.** Tabel `need_invites` (`need_id`, `talent_id`, `invited_by`, `status`, timestamps). `POST /api/needs/:id/invite` `{talent_id}`: hanya pemilik efektif, kebutuhan masih `OPEN`, talenta bersedia tampil, maksimal 5 undangan per kebutuhan. Kirim notifikasi; saat talenta melamar, undangan menjadi `ACCEPTED`. Ini menjaga persetujuan talenta, bukan menempelkan talenta ke proyek.
5. **Pengaturan:** kolom `user_settings.show_in_recommendations` (default 1) + toggle di `/settings`.
6. Cache pendek (60 detik, per pengguna) untuk hasil rekomendasi.
7. **Addendum dokumen:** tulis `docs/PRD-addendum-rekomendasi.md` (satu halaman): fitur ini berstatus rekomendasi, manusia tetap memilih; mengapa deterministik pada v1; privasi dan toggle. Tujuannya menyelaraskan PRD §4 dan proposal.
8. **Seed demo:** talenta dengan skill dan ≥ 3 proyek selesai, beberapa kebutuhan ber-`need_skills`, dan satu kebutuhan tanpa skills (untuk jalur cold start).

**Acceptance:** `scoreMatch` punya ±6 test fixture (cocok penuh, parsial, tanpa skill, cold start, beban kerja tinggi, sertifikasi); requester A tidak dapat meminta rekomendasi untuk kebutuhan milik B (403); talenta yang menonaktifkan toggle tidak muncul di rekomendasi talenta.

---

## TASK R2 — Rekomendasi di dashboard (FE)

**Branch:** `implement/R2-recommendation-ui` · **Ukuran:** M · **Bergantung pada:** R1

**Talenta**
- Beranda: bagian "Rekomendasi untuk Anda" berisi kartu dengan persentase kecocokan, chip skill yang cocok (hijau) dan yang belum dimiliki (abu-abu, "bisa dipelajari"), alasan singkat, tombol Lamar/Detail. Badge "Diundang" untuk kebutuhan yang mengundangnya.
- Katalog: urutan default "Paling cocok" bagi talenta ber-skill, dengan opsi kembali ke "Terbaru".
- Skill kosong → ajakan melengkapi profil (bukan daftar kosong). Toggle "Tampilkan saya di rekomendasi" di Pengaturan.

**Komunitas (dan liaison sebagai pemilik proksi)**
- Pada tiap kebutuhan: tab/bagian "Talenta yang cocok". Pelamar diurutkan berdasarkan skor dan diberi badge; di bawahnya daftar non-pelamar dengan tombol "Undang melamar" (nonaktif setelah diundang, tampilkan sisa kuota).
- Label tetap terlihat: **"Rekomendasi sistem. Keputusan tetap di tangan Anda."** "Mengapa cocok?" membuka alasan dan skill yang cocok.
- Kartu pelamar menampilkan badge sertifikasi (setelah U5) dan jumlah proyek selesai.

**Acceptance:** dengan seed, talenta melihat ≥ 3 rekomendasi bersama alasannya; requester mengundang satu talenta, talenta menerima notifikasi dan badge "Diundang", lalu saat melamar status undangan berubah. Tampilan 360 px tanpa scroll horizontal.

---

## TASK R3 — Chatbot personal: profil, karier, rekomendasi

**Branch:** `implement/R3-chatbot-personal` · **Ukuran:** M · **Bergantung pada:** R1 · **Model:** terkuat

**Masukan tester:** AI dapat merekomendasikan karier untuk talenta (personalisasi).

**Pekerjaan**
1. `services/chatbot/personalContext.js`: bangun ringkasan konteks **dari `req.user.id` di server**, kompak (< 400 token), tanpa email/telepon:
   - Talenta: skills, level dan poin, jumlah proyek selesai, kategori yang pernah dikerjakan, lamaran aktif, 3 rekomendasi teratas (dari R1), status sertifikasi dan kelayakan.
   - Komunitas: komunitas yang dikelola, kebutuhan aktif beserta statusnya, jumlah pelamar menunggu, talenta teratas per kebutuhan (hanya field yang boleh dilihat requester).
   - Suntikkan dalam tag `<user_profile>` dan `<recommendations>`. Cache 60 detik. Hormati `allows_ai_chat` serta toggle personalisasi baru (`allows_ai_personalization`, selaras dengan toggle privasi dari T15): bila mati → mode umum.
2. **Intent baru** pada pipeline: `rekomendasi_proyek`, `rekomendasi_talenta`, `karir`, `sertifikasi`.
   - Rekomendasi: hasil **diambil dari R1**. LLM hanya menjelaskan dan tidak boleh menyebut proyek/talenta di luar `<recommendations>`. Permintaan murni "tampilkan rekomendasi" dijawab dari template tanpa LLM; LLM dipakai untuk "kenapa" dan "bagaimana".
   - Karier: analisis **kesenjangan skill berbasis data platform**: skill yang paling banyak diminta di kebutuhan terbuka namun belum dimiliki talenta (query agregat), langkah berikutnya (lamar proyek X, lengkapi portofolio, ajukan sertifikasi bila layak). Saran belajar umum boleh, tetapi diberi label umum.
3. **Aturan prompt tambahan** (naikkan `PROMPT_VERSION`): tidak menjanjikan gaji/pekerjaan/penempatan, tidak mengklaim kondisi pasar kerja di luar data yang diberikan, tidak membuka profil orang lain, mengakui bila profil terlalu kosong dan mengajak melengkapi.
4. **Kartu terstruktur:** respons (dan event `done` pada stream) memuat `cards: [{type:'need'|'talent', id, score}]` agar FE menampilkan kartu dengan tautan aksi (Lamar, Lihat, Undang), bukan hanya teks.
5. Biaya: `max_tokens` 450 hanya untuk intent karier; cache narasi dengan kunci hash(profil ringkas + rekomendasi). Jangan menyimpan snapshot profil di `chat_messages`; `ask_logs` hanya mencatat intent.
6. **Golden set:** tambah ±15 kasus ke set T15: pengguna tanpa skill; tidak mengarang proyek di luar rekomendasi; pengguna A tidak bisa memancing data pengguna B; pertanyaan gaji/kepastian kerja; toggle personalisasi mati; pertanyaan sertifikasi (syarat vs status pribadi).
7. **FE:** render `cards` di widget, dan saran cepat per peran ("Proyek apa yang cocok untuk saya?", "Skill apa yang perlu saya pelajari?", "Talenta mana yang cocok untuk kebutuhan saya?").

**Acceptance:** talenta seed bertanya "proyek apa yang cocok buat aku?" dan mendapat kartu yang sama dengan rekomendasi dashboard beserta alasan; pertanyaan karier menyebut skill yang benar-benar diminta di kebutuhan terbuka; akun tanpa persetujuan personalisasi menerima jawaban umum; tidak ada kebocoran data antar-pengguna pada golden set.

**Setelah R3 selesai:** jalankan **evaluasi live satu kali** (±$0,03–0,05). Prompt masih akan berubah di R3 dan U6, sehingga angka live lebih berarti bila diukur sesudahnya, bukan sekarang.

---

## TASK U6 — Section AgenSUSI saat AI mengalihkan percakapan

**Branch:** `implement/U6-agensusi-handoff` · **Ukuran:** M

**Masukan tester:** perlu section khusus AgenSUSI ketika AI mengalihkan pembicaraan agar pengguna bisa lanjut berdiskusi dengan agen.

**BE**
- Respons chatbot dan `GET /chatbot/session/:id` memuat objek `handoff`: `{status: 'none'|'requested'|'waiting'|'assigned'|'resolved', agent: {name, avatar}|null, ticket_id, eta_text}`. `eta_text` mengikuti jam layanan yang sudah dikonfigurasi di T13.
- Saat `status` `requested`/`waiting`/`assigned`, `/chatbot/message` **tidak memanggil LLM** (hemat biaya): pesan disimpan dan menunggu agen. Pengguna dapat membatalkan atau kembali ke AI: `POST /chatbot/handoff/cancel`.
- Setelah `resolved`, sesi kembali ke mode AI.

**FE (widget terpadu dari T14)**
1. Saat AI menyarankan eskalasi, tampilkan **kartu inline** "Lanjutkan dengan AgenSUSI?" berisi dua tombol (Ya, hubungkan / Lanjut dengan AI), bukan hanya teks.
2. Setelah diminta, widget berpindah ke bagian **"Ruang AgenSUSI"**: header menampilkan identitas agen dan chip status (Menunggu agen → Ditangani oleh *nama* → Selesai); gelembung agen berwarna dan berlabel berbeda dari AI; kolom tulis berubah menjadi "Tulis pesan untuk AgenSUSI"; indikator "AI dijeda".
3. Tampilkan **ringkasan yang dikirim ke agen** (bisa dibuka/ditutup) untuk transparansi, tombol WhatsApp resmi sebagai jalur lain, dan tombol "Kembali ke asisten AI".
4. Pengguna anonim mengisi kontak (WA/email) dalam langkah inline sebelum tiket dibuat.
5. Titik penanda pada peluncur widget serta notifikasi lonceng (pengguna login) saat agen membalas ketika widget tertutup.
6. Setelah selesai: minta penilaian singkat dan tawarkan "Pertanyaan baru ke AI".
7. **Dashboard Liaison:** konsol percakapan pada antrean eskalasi menampilkan transkrip (bagian AI bisa dilipat), balasan cepat siap pakai, tombol Selesai dan "Kembalikan ke AI".
8. Layar penuh di mobile.

**Seed demo:** satu eskalasi `assigned` berisi beberapa pesan.

**Acceptance:** alur lengkap: AI tidak bisa menjawab → kartu muncul → pengguna menyetujui → bagian AgenSUSI tampil dengan status Menunggu → liaison claim → status berubah menjadi Ditangani → balasan agen tampil berbeda dari AI → resolved → penilaian → kembali ke AI. Selama handoff aktif, tidak ada panggilan LLM baru di `ask_logs`.

---

## TASK U5 — Sertifikasi talenta

**Branch:** `implement/U5-sertifikasi` · **Ukuran:** M

**Masukan tester:** talenta yang sudah banyak mengerjakan proyek dapat mengajukan verifikasi/sertifikasi ke admin atau AgenSUSI.

**BE**
1. Migrasi: `certification_requests` (`talent_id`, `focus_area`, `pitch`, `status ENUM('PENDING','APPROVED','REJECTED')`, `reviewer_id`, `review_note`, `reviewed_at`, `created_at`), `certification_request_projects` (permintaan ↔ proyek bukti), `certificates` (`talent_id`, `request_id`, `code` UNIQUE acak dan tidak berurutan, `focus_area`, `issued_at`, `revoked_at`).
2. Syarat kelayakan di konstanta/env (`CERT_MIN_PROJECTS=3`): jumlah proyek `COMPLETED` ≥ ambang, tidak ada permintaan `PENDING`, dan tidak sedang memiliki sertifikat aktif untuk bidang yang sama.
3. Endpoint talenta: `GET /certifications/eligibility` (alasan jika belum layak), `POST /certifications` (pilih proyek bukti milik sendiri + bidang + pitch), `GET /certifications/mine`.
4. Endpoint peninjau (`admin`, `liaison`): `GET /admin/certifications?status=`, `PATCH /admin/certifications/:id` `{decision, note}`. Catat ke `audit_logs`; saat disetujui, terbitkan sertifikat dan notifikasi. Admin dapat mencabut (`revoked_at`). Pakai juga `moderation_items` (`item_type='TALENTA'`, sudah ada di enum) agar muncul di antrean admin yang ada.
5. Publik: `GET /public/certificates/:code` mengembalikan nama, bidang, tanggal terbit, jumlah proyek, dan status valid/dicabut. Tanpa email atau data pribadi lain.

**FE**
- Profil talenta: kartu "Sertifikasi" dengan progres ("2/3 proyek"), tombol Ajukan (nonaktif dengan alasan bila belum layak), formulir (bidang, pitch, pilih proyek bukti), status permintaan.
- Badge "Tersertifikasi SUSI" pada profil, kartu pelamar, dan kartu rekomendasi (R2).
- Admin/Liaison: ulasan permintaan dengan bukti (proyek, testimoni, hasil), tombol setujui/tolak + catatan.
- Halaman `/sertifikat/:code` (tampilan cetak A4 landscape lewat CSS print, tombol "Cetak/Simpan PDF") dan `/verifikasi/:code` untuk pengecekan publik.
- Rekomendasi R1: sertifikasi memberi bonus skor kecil (sudah dialokasikan di bobot).

**Seed demo:** satu talenta dengan 3 proyek selesai (layak), satu permintaan `PENDING`, satu sertifikat terbit.

**Acceptance:** talenta dengan 2 proyek tidak bisa mengajukan (alasan tampil); dengan 3 proyek bisa mengajukan; admin menyetujui → sertifikat terbit dengan kode unik; `/verifikasi/:code` valid tanpa login; sertifikat yang dicabut tampil "tidak berlaku".

---

## TASK U2 — Peta dengan marker (mapcn / MapLibre)

**Branch:** `implement/U2-peta-marker` · **Ukuran:** S–M

**Masukan tester:** gunakan marker seperti contoh di `mapcn.dev/docs/markers`.

**Catatan teknis (sudah saya baca dokumennya):** mapcn adalah kumpulan komponen peta berbasis **MapLibre GL**, bergaya Tailwind dan dirancang untuk shadcn/ui. Komponennya (`Map`, `MapMarker`, `MarkerContent`, `MarkerPopup`, `MarkerTooltip`) disalin ke proyek lewat CLI, dan contoh memakai alias `@/components/ui/map` serta token seperti `bg-primary`. Marker berbasis DOM, cocok untuk beberapa ratus titik. Ada juga marker yang bisa digeser (`draggable`) dan dokumentasi klaster.

**Pekerjaan**
1. **Baca dulu** `https://www.mapcn.dev/docs/installation` dan `https://www.mapcn.dev/llms.txt`, lalu cek kecocokannya dengan setup proyek (Vite + React 19 + **Tailwind v3**, tanpa shadcn). Putuskan: (a) pasang komponen mapcn jika kebutuhan shadcn/alias/variabel CSS-nya bisa dipenuhi tanpa merusak tema SUSI; atau (b) pakai `maplibre-gl` langsung dengan komponen marker sendiri. Tulis keputusan dan alasannya di `docs/progress/U2.md`. Periksa juga ketentuan dan atribusi sumber tile yang dipakai.
2. Ganti peta yang ada (embed Google Maps/`SectorMap`, dan tab Map di dashboard) dengan marker per komunitas dan, bila relevan, per kebutuhan terbuka. Warna: komunitas lain (merah), komunitas sendiri (mint), kebutuhan terbuka (warna ketiga) selaras dengan teks bantuan chatbot. Popup memuat detail dan tautan "Rute di Google Maps" (tautan luar, tanpa embed).
3. Data dari `GET /public/communities` (alamat persis tetap disembunyikan sesuai `show_location`).
4. **Marker yang bisa digeser** pada form kebutuhan dan form liaison untuk memperbaiki koordinat, melengkapi pencarian alamat (geocode) yang sudah ada.
5. Muat peta lewat **lazy-load** (chunk terpisah). MapLibre berat dan akan memperburuk ukuran bundle bila masuk bundle utama.

**Acceptance:** peta menampilkan marker komunitas seed dengan popup; geser marker di form memperbarui `lat`/`lng` yang tersimpan; `npm run build` menunjukkan MapLibre di chunk terpisah.

---

## TASK U3 — Responsive A: shell, dashboard, tabel, modal

**Branch:** `implement/U3-responsive-dashboard` · **Ukuran:** M · **Jalankan setelah** fitur U1, U5, U6, R2 mendarat

**Langkah 1 — audit otomatis dulu.** Buat `scripts/responsive-audit.mjs` (Playwright): masuk memakai API untuk tiap peran, buka setiap rute di 360×740, 390×844, 768×1024, 1280×800; simpan tangkapan layar, deteksi scroll horizontal (`document.documentElement.scrollWidth > innerWidth`), dan daftar elemen interaktif < 40 px. Keluaran: `docs/responsive-report.md`. Perbaiki yang terparah lebih dulu; jalankan ulang di akhir.

**Langkah 2 — perbaikan**
1. **Shell dashboard (`DashShell`):** di bawah 768 px, sidebar menjadi drawer dan muncul bar navigasi bawah (maks 5 item); header lengket; panel notifikasi menjadi sheet layar penuh.
2. **Tabel/daftar (`ProjectTable`, daftar admin dan liaison):** di bawah 640 px berubah menjadi kartu bertumpuk (atau scroll horizontal dengan petunjuk yang jelas).
3. **Modal:** bottom sheet dengan `max-height: 90dvh`, scroll internal, padding safe-area, fokus terkunci, Esc menutup.
4. **Input dan tombol:** input font ≥ 16 px (mencegah zoom otomatis iOS), target sentuh ≥ 44 px.
5. Ganti `100vh` dengan `100dvh`; hindari lebar tetap; samakan breakpoint.
6. **Sentuh dan gerak:** nonaktifkan `Cursor.jsx` dan `Magnetic.jsx` pada `(hover: none), (pointer: coarse)`; hormati `prefers-reduced-motion` (persingkat overlay transisi GSAP dan matikan efek parallax).

**Acceptance:** laporan audit menunjukkan **0 scroll horizontal** pada semua rute dan peran di 360 px; semua dashboard dapat dipakai penuh dengan satu tangan di mobile (navigasi bawah, modal sheet).

---

## TASK U4 — Responsive B: halaman publik, form, chat, mading, performa

**Branch:** `implement/U4-responsive-public-perf` · **Ukuran:** M · **Bergantung pada:** U3

1. **Landing, Auth, Tentang, Footer, RequestPage:** tata letak satu kolom di mobile, tipografi fluid (`clamp`), form tanpa lebar tetap, tombol penuh lebar. Panel kiri AuthPage diringkas di mobile.
2. **Widget chat:** layar penuh di mobile, tinggi mengikuti `visualViewport` agar kolom tulis tidak tertutup keyboard, safe-area bawah, kartu rekomendasi (R3) dan ruang AgenSUSI (U6) tetap terbaca.
3. **Mading:** gunakan pointer events; `touch-action: none` hanya pada kartu yang digeser (bukan seluruh papan) agar halaman tetap bisa digulir; tersedia tampilan daftar sebagai alternatif bila papan terlalu sempit.
4. **Peta (U2):** tinggi responsif, popup muat di layar, target sentuh marker memadai.
5. **Performa (juga menuntaskan catatan bundle di T16):**
   - `React.lazy` per rute dan per dashboard; `manualChunks` di Vite untuk `gsap`, peta, dan `react-icons`; tidak ada chunk > 500 KB (peringatan Vite hilang).
   - Font: ubah TTF/OTF di `public/fonts` ke **woff2**, `font-display: swap`, preload satu atau dua font utama.
   - Foto tim (jpg) → webp dengan `width/height` dan `loading="lazy"`.
6. Jalankan ulang audit U3, lalu Lighthouse mobile pada Landing dan satu dashboard. Target realistis: Performance ≥ 70, Accessibility ≥ 90. Catat angkanya di `docs/responsive-report.md`.

**Acceptance:** audit 0 scroll horizontal di semua rute publik; build tanpa peringatan chunk besar; Lighthouse mencapai target atau kekurangannya dicatat jujur.

---

## T16 — QA & demo (diperluas)

T16 tetap seperti Fase 1, tetapi dijalankan **setelah** semua task di atas, dengan tambahan:

- E2E Playwright memuat alur baru: talenta ajukan gabung komunitas → disetujui; topik mading berdurasi dan terhapus; sertifikasi (ajukan → setujui → verifikasi publik); rekomendasi dan undang melamar; handoff AgenSUSI.
- `docs/DEMO.md` diperbarui: tambahkan satu skenario "personalisasi" (talenta bertanya ke chatbot → kartu rekomendasi) dan satu "AI mengalihkan ke AgenSUSI".
- Tangkapan layar proposal untuk fitur baru: rekomendasi, ruang AgenSUSI, sertifikat, peta marker.
- Evaluasi live chatbot **dijalankan di sini sekali** (setelah R3 dan U6), dan angkanya masuk `docs/chatbot-eval.md`.
