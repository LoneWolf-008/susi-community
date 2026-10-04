# PRD — SUSI Community v1

**Kategori Lomba:** Web Programming — SATU CREANOVA 2026
**Sub-tema:** Community Development (IT Social Innovation)
**Versi:** 1.1 (Draf) | **Status:** Menunggu validasi riset lapangan
**Peran dokumen:** Fondasi proposal (BAB I–IV) sekaligus input untuk penyusunan SDD

> **Perubahan v1.0 → v1.1.** Rencana teknologi (§11) diubah dari Supabase (BaaS) menjadi **React + Express + MySQL**. Alasan: tim telah menyelesaikan dua proyek sebelumnya dengan stack ini, sehingga penguasaan nyata lebih menentukan daripada kemudahan teoretis. Konsekuensi teknis dari perubahan ini dicatat di §11 dan §12.

> **Catatan kejujuran metodologis.** Angka target dan asumsi pengguna dalam dokumen ini masih berupa **hipotesis**, belum divalidasi. Bagian yang bertanda 🔬 wajib diperbarui setelah wawancara dengan 3–5 komunitas nyata selesai. Jangan menuliskan hipotesis sebagai fakta di dalam proposal.

---

## 1. Ringkasan Eksekutif

SUSI Community adalah platform yang mempertemukan **komunitas non-teknis di Bandung yang memiliki kebutuhan digital** dengan **talenta IT (fresh graduate, career switcher, engineer) yang membutuhkan pengalaman proyek nyata**.

Yang membedakan SUSI dari marketplace jasa seperti Upwork/Fastwork bukan mekanisme pencocokannya, melainkan tiga hal:

1. **Model ekonomi yang cocok untuk komunitas cash-poor** — talenta termotivasi oleh pengalaman & portofolio, bukan tarif pasar.
2. **Menjemput bola (outreach) sebagai identitas inti, bukan aktivitas tambahan** — diwujudkan dalam sistem melalui jalur **Assisted Intake**, di mana kebutuhan komunitas yang belum melek digital dicatatkan oleh liaison SUSI langsung dari lapangan.
3. **Lapisan kepercayaan berbasis sign-off dua arah** — reputasi talenta terbangun dari konfirmasi timbal balik, bukan klaim sepihak.

---

## 2. Problem Statement

Komunitas non-teknis di Bandung (UMKM, karang taruna, PKK, komunitas hobi, panitia sekolah) menjalankan operasional secara manual dan tidak efisien — pencatatan iuran, data anggota, promosi, koordinasi jadwal. Masalah utamanya **bukan ketiadaan akses ke penyedia jasa**, melainkan **ketiadaan kesadaran** bahwa masalah mereka dapat diselesaikan teknologi, ditambah **hambatan biaya dan kepercayaan** ketika akses itu ada.

Platform jasa yang ada bersifat pasif dan swalayan: mereka menunggu klien yang sudah tahu apa yang dibutuhkan dan sanggup membayar harga pasar. Komunitas yang tidak memenuhi dua syarat itu tidak pernah terlayani.

Di sisi lain, jumlah lulusan IT terus bertambah sementara AI semakin menguasai pekerjaan teknis rutin. Yang menjadi langka bagi mereka bukan lagi kemampuan koding, melainkan **pengalaman nyata, koneksi, dan bukti kredibilitas** — hal yang justru bisa diperoleh dari mengerjakan masalah komunitas riil.

**Biaya bila tidak diselesaikan:** komunitas lokal tertinggal secara digital; talenta IT menganggur atau kehilangan kesempatan membangun portofolio; potensi digitalisasi sektor non-startup tidak tergarap.

🔬 *Bagian ini wajib diperkuat dengan minimal 1–2 kutipan langsung dari hasil wawancara.*

---

## 3. Goals

| # | Goal | Jenis | Indikator keberhasilan |
|---|---|---|---|
| G1 | Komunitas non-teknis dapat menyampaikan kebutuhan digital **tanpa perlu menguasai istilah teknis** | User | ≥80% kebutuhan yang masuk berhasil diterjemahkan menjadi proyek berscope jelas tanpa revisi berulang |
| G2 | Kebutuhan komunitas yang **tidak pernah mendaftar sendiri** tetap dapat masuk ke sistem | Product | ≥50% kebutuhan pada periode awal berasal dari jalur Assisted Intake |
| G3 | Talenta IT memperoleh **bukti pengalaman terverifikasi**, bukan klaim sepihak | User | ≥70% proyek selesai memiliki sign-off dua arah + testimoni |
| G4 | Loop inti berjalan utuh dari kebutuhan hingga reputasi terisi | Product | Minimal 1 proyek melewati seluruh state secara end-to-end |
| G5 | Mengurangi keraguan komunitas terhadap talenta yang belum dikenal | User | 🔬 diukur dari perubahan objection pada wawancara lanjutan |

---

## 4. Non-Goals (v1)

| Non-goal | Alasan |
|---|---|
| **Sistem pembayaran / escrow** | Model v1 berbasis relawan & pengalaman. Payment gateway menambah beban teknis besar dan risiko sengketa, tanpa menyentuh masalah inti (kesadaran & kepercayaan). |
| **Ruang kerja kolaborasi penuh** (chat real-time, file sharing, task board) | Membangun Trello/Slack versi lebih lemah. Pengguna utama (non-teknis) sudah nyaman di WhatsApp. Kolaborasi terjadi di luar sistem. |
| **Pencocokan otomatis berbasis algoritma/AI** | v1 menggunakan pencocokan manual (browse + lamar + pilih). Otomasi tanpa data historis hanya akan menebak. |
| **Fitur kursus/pelatihan & manajemen event** | Bagian dari Tahap 2 (outreach terstruktur), bukan tulang punggung. Menambahnya sekarang memecah fokus. |
| **Aplikasi mobile native** | Web responsif sudah memenuhi ketentuan lomba dan kebutuhan pengguna. |

---

## 5. Personas & Roles

| Role sistem | Persona | Kebutuhan utama | Karakteristik penting |
|---|---|---|---|
| **Requester** | Komunitas / UMKM non-teknis | Masalah operasionalnya selesai tanpa harus paham teknologi | Literasi digital rendah, waktu terbatas, hidup di WhatsApp, skeptis terhadap orang asing |
| **Talent** | Fresh graduate, career switcher, junior/senior engineer | Pengalaman nyata, portofolio, koneksi, bukti kredibilitas | Termotivasi non-finansial, butuh proyek berscope jelas |
| **Liaison / Admin** | Anggota inti SUSI yang melakukan outreach | Mencatatkan kebutuhan hasil kunjungan lapangan, menjaga kualitas & scope | Ini adalah **perwujudan sistemik dari "menjemput bola"** |

> **Catatan desain:** keberadaan role Liaison inilah yang membedakan arsitektur SUSI dari marketplace generik. Pastikan role ini muncul eksplisit di Use Case Diagram.

---

## 6. User Stories

### Requester (Komunitas)
1. Sebagai pengurus komunitas, saya ingin menyampaikan masalah dengan **bahasa sehari-hari** ("jualan saya berantakan") agar saya tidak perlu tahu istilah teknis untuk mulai dibantu.
2. Sebagai pengurus komunitas, saya ingin **melihat jejak & testimoni** talenta yang melamar agar saya berani mempercayakan pekerjaan kepada orang yang belum saya kenal.
3. Sebagai pengurus komunitas, saya ingin **menyepakati batasan pekerjaan di awal** agar tidak ada kesalahpahaman soal apa yang akan dikerjakan.
4. Sebagai pengurus komunitas, saya ingin **mengonfirmasi bahwa pekerjaan benar selesai** agar saya tidak dianggap menyetujui hasil yang belum jadi.

### Talent (Talenta IT)
5. Sebagai fresh graduate, saya ingin **menelusuri kebutuhan nyata komunitas** agar saya menemukan proyek yang sesuai kemampuan saya.
6. Sebagai fresh graduate, saya ingin **mengajukan diri disertai keahlian saya** agar komunitas dapat menilai kecocokan saya.
7. Sebagai talenta, saya ingin **rekam jejak proyek selesai saya tercatat & terverifikasi** agar menjadi bukti pengalaman yang kredibel.

### Liaison / Admin
8. Sebagai liaison, saya ingin **mencatatkan kebutuhan atas nama komunitas** yang saya temui di lapangan agar kebutuhan mereka tetap masuk meski mereka tidak akan pernah membuka website sendiri.
9. Sebagai liaison, saya ingin **menandai kebutuhan yang scope-nya belum jelas** agar tidak ada proyek berangkat tanpa definisi selesai.

### Edge cases
10. Sebagai pengurus komunitas, saya ingin tahu apa yang terjadi bila **tidak ada satu pun talenta melamar** dalam waktu tertentu.
11. Sebagai talenta, saya ingin dapat **mengundurkan diri** dari proyek yang sudah diterima, dengan kebutuhan kembali terbuka.
12. Sebagai pengguna baru, saya ingin **halaman kosong (empty state) tetap menjelaskan apa yang harus saya lakukan**, bukan sekadar kosong.

---

## 7. Alur Inti & State Machine

```
[Kebutuhan Masuk]
   ├── Jalur A: Self-serve   (Requester mengisi sendiri)
   └── Jalur B: Assisted     (Liaison mencatatkan hasil outreach)
                 │
                 ▼
         TERBUKA ──► talenta melamar
                 │
                 ▼
         COCOK   ──► Requester memilih talenta + menyepakati scope & definisi "selesai"
                 │
                 ▼
       DIKERJAKAN ──► (kolaborasi terjadi DI LUAR sistem: WhatsApp/GitHub)
                 │
                 ▼
   MENUNGGU_KONFIRMASI ──► talenta menandai selesai
                 │
                 ▼
         SELESAI  ──► Requester konfirmasi + testimoni ──► Reputasi talenta terisi
```

**Transisi tambahan:** `COCOK/DIKERJAKAN → TERBUKA` (talenta mundur), `TERBUKA → DIBATALKAN` (kebutuhan ditarik).

**Aturan kunci:** state `SELESAI` **hanya tercapai bila kedua pihak mengonfirmasi**. Inilah yang membuat reputasi tidak bisa diklaim sepihak.

---

## 8. Requirements

### P0 — Must Have (tanpa ini sistem tidak menjawab masalah inti)

**P0-1 · Autentikasi & Peran**
Pengguna dapat mendaftar/masuk dan sistem membedakan peran Requester, Talent, dan Liaison.
- [ ] Registrasi & login berfungsi
- [ ] Setiap peran melihat menu/aksi sesuai perannya
- [ ] Pengguna tidak dapat mengakses aksi milik peran lain

**P0-2 · Intake Kebutuhan Dua Jalur** ⭐ *pembeda utama*
Kebutuhan dapat masuk melalui pengisian mandiri **atau** dicatatkan oleh Liaison atas nama komunitas.
- Given saya seorang Requester, When saya mengisi form kebutuhan dengan bahasa sehari-hari, Then kebutuhan tersimpan berstatus `TERBUKA`
- Given saya seorang Liaison, When saya mencatatkan kebutuhan atas nama komunitas X, Then kebutuhan tersimpan dengan penanda sumber `assisted` dan atribusi komunitas X
- [ ] Form tidak mewajibkan istilah teknis; tersedia contoh pengisian
- [ ] Sumber intake (`self-serve` / `assisted`) tersimpan dan dapat dibedakan

**P0-3 · Katalog Kebutuhan & Pengajuan Talenta**
Talenta dapat menelusuri kebutuhan terbuka dan mengajukan diri.
- Given ada kebutuhan berstatus `TERBUKA`, When talenta membuka daftar, Then kebutuhan tampil beserta ringkasan & kebutuhan keahlian
- Given talenta mengajukan diri, Then Requester dapat melihat daftar pelamar beserta profil & jejaknya
- [ ] Talenta tidak dapat melamar dua kali pada kebutuhan yang sama
- [ ] Kebutuhan yang sudah `COCOK` tidak lagi menerima lamaran

**P0-4 · Pemilihan & Kesepakatan Scope**
Requester memilih satu talenta dan kedua pihak menyepakati batasan pekerjaan serta definisi "selesai".
- [ ] Saat memilih, Requester mengisi ringkasan scope & definisi selesai
- [ ] Status berubah `TERBUKA → COCOK → DIKERJAKAN`
- [ ] Kesepakatan tersimpan dan terlihat oleh kedua pihak

**P0-5 · Sign-off Dua Arah & Testimoni** ⭐ *mesin reputasi*
- Given proyek `DIKERJAKAN`, When talenta menandai selesai, Then status menjadi `MENUNGGU_KONFIRMASI`
- Given status `MENUNGGU_KONFIRMASI`, When Requester mengonfirmasi + mengisi testimoni, Then status menjadi `SELESAI` dan reputasi talenta bertambah
- [ ] Reputasi **tidak** bertambah bila hanya satu pihak yang menandai
- [ ] Testimoni tampil publik pada profil talenta

**P0-6 · Profil & Rekam Jejak Talenta**
- [ ] Profil memuat keahlian dan daftar proyek `SELESAI` beserta testimoni
- [ ] Terlihat oleh Requester saat menilai pelamar

### P1 — Nice to Have
- Notifikasi email saat ada pelamar / perubahan status
- Filter & pencarian kebutuhan berdasarkan kategori/keahlian
- Dashboard ringkas Liaison (jumlah kebutuhan per komunitas, status agregat)
- Halaman publik "dampak" — jumlah komunitas terbantu & proyek selesai

### P2 — Future Considerations (dirancang agar tidak terhalang, tapi tidak dibangun)
- Modul outreach terstruktur: penjadwalan workshop, sosialisasi, pelatihan (**Tahap 2**)
- Keterhubungan antar komunitas & rujukan silang (**Tahap 3**)
- Rekomendasi pencocokan otomatis berbasis riwayat
- Model monetisasi (donasi/sponsor institusi/CSR)

> **Implikasi arsitektur untuk P2:** entitas `Komunitas` dibuat sebagai entitas tersendiri (bukan sekadar atribut pada user), agar Tahap 2 & 3 tidak memerlukan migrasi data besar.

---

## 9. Model Data (ringkas — untuk diperdalam di SDD)

| Entitas | Atribut kunci |
|---|---|
| `User` | id, nama, email, role (`requester` / `talent` / `liaison`) |
| `Komunitas` | id, nama, jenis, lokasi, kontak, dibuat_oleh |
| `Kebutuhan` | id, komunitas_id, judul, deskripsi_awam, kategori, status, sumber_intake, dibuat_oleh |
| `Lamaran` | id, kebutuhan_id, talent_id, pesan, status |
| `Kesepakatan` | id, kebutuhan_id, talent_id, ringkasan_scope, definisi_selesai, tanggal |
| `Konfirmasi` | id, kebutuhan_id, dikonfirmasi_talent (bool), dikonfirmasi_requester (bool), testimoni, rating |

---

## 10. Success Metrics

### Leading (pekan pertama–pertama bulan pilot)
| Metrik | Target awal 🔬 | Cara ukur |
|---|---|---|
| Kebutuhan masuk via Assisted Intake | ≥50% dari total | Hitung `sumber_intake` |
| Kebutuhan `TERBUKA` yang mendapat ≥1 lamaran dalam 7 hari | ≥60% | Query status |
| Proyek yang mencapai `SELESAI` dengan sign-off dua arah | ≥70% dari yang `DIKERJAKAN` | Tabel Konfirmasi |
| Waktu pengisian form kebutuhan oleh pengguna non-teknis | <5 menit tanpa bantuan | Uji coba langsung |

### Lagging (pasca-lomba, bila dilanjutkan)
- Komunitas yang mengajukan kebutuhan **kedua** (indikator kepercayaan nyata)
- Talenta yang menyelesaikan >1 proyek
- Jumlah komunitas non-teknis yang tersentuh outreach

### Metrik konteks lomba
Loop inti dapat didemokan **end-to-end secara live** tanpa kegagalan — ini yang menyentuh Fungsionalitas Sistem (30%) di babak final.

---

## 11. Rencana Teknologi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | **React** + Tailwind CSS | Sudah dikuasai tim; responsif, ekosistem luas |
| Backend / API | **Node.js + Express** (REST API) | Sudah dikuasai tim dari dua proyek sebelumnya; kontrol penuh atas logika transisi status |
| Database | **MySQL** | Basis data yang paling dikuasai tim; relasi antar entitas SUSI bersifat relasional murni |
| Autentikasi | **JWT** + bcrypt (password hashing) | Pola standar pada stack Express; dibangun sendiri karena tidak tersedia layanan bawaan |
| Otorisasi peran | **Middleware Express** (role guard per endpoint) | Pengganti Row Level Security — aturan akses ditegakkan di lapisan API, bukan di database |
| Hosting | Frontend: Vercel/Netlify · Backend + DB: Railway/Render (atau lokal saat demo onsite) | Backend memerlukan proses server yang berjalan terus, berbeda dari frontend statis |

**Justifikasi untuk proposal:** pemilihan stack ini adalah keputusan rekayasa berbasis **kompetensi nyata tim**, bukan tren teknologi. Tim telah menyelesaikan dua proyek dengan React + Express + MySQL, sehingga waktu pengerjaan onsite yang terbatas dapat difokuskan pada *fungsionalitas inti dan pengalaman pengguna* — komponen penilaian terbesar — alih-alih dihabiskan untuk mempelajari teknologi baru di bawah tekanan kompetisi. Arsitektur REST API terpisah juga memberi tim kendali penuh atas penegakan aturan transisi status (§7), yang merupakan inti mekanisme kepercayaan SUSI.

**Catatan arsitektur:** karena MySQL tidak memiliki Row Level Security seperti PostgreSQL, seluruh aturan "siapa boleh melakukan apa" **wajib ditegakkan di lapisan Express**, bukan diasumsikan aman di sisi frontend. Transisi status `MENUNGGU_KONFIRMASI → SELESAI` khususnya harus hanya dapat terjadi melalui endpoint konfirmasi yang memvalidasi kedua pihak — bukan melalui endpoint update umum.

---

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi dalam desain |
|---|---|---|
| **Cold start** — tidak ada kebutuhan di awal | Platform tampak kosong | Assisted Intake + seed sisi talenta dari anggota SUSI sendiri |
| **Disintermediasi** — kedua pihak lanjut di WA lalu meninggalkan platform | SUSI jadi papan pengumuman sekali pakai | Talenta membutuhkan kredit terverifikasi; Requester mendapat testimoni publik |
| **Reputasi palsu** | Lapisan kepercayaan runtuh | Sign-off dua arah wajib |
| **Kualitas pengerjaan tidak terjamin** (talenta pemula) | Komunitas kecewa | Scope disepakati di awal; Liaison menyaring kebutuhan yang terlalu kompleks |
| **Scope creep saat onsite** | Fitur setengah jadi ketika demo | Non-goals dikunci di dokumen ini; hanya P0 yang dibangun |
| **Otorisasi bocor** — aturan peran hanya dicek di frontend | Talenta/pihak lain bisa mengubah status atau data milik orang lain | Seluruh pengecekan peran & kepemilikan ditegakkan di middleware Express; frontend hanya menyembunyikan tombol, bukan menjaga keamanan |
| **Sign-off dua arah dapat diakali** lewat endpoint update umum | Reputasi bisa diklaim sepihak — mesin kepercayaan runtuh | Transisi ke `SELESAI` hanya lewat endpoint konfirmasi khusus yang memvalidasi kedua flag; status tidak boleh bisa di-`PATCH` bebas |
| **Deployment backend gagal/lambat saat onsite** | Demo live tidak jalan meski kode benar | Siapkan skenario cadangan: backend + MySQL berjalan lokal di laptop tim, dengan data seed siap pakai |

---

## 13. Open Questions

**Blocking (harus terjawab sebelum finalisasi proposal):**
- 🔬 [Riset] Apakah komunitas benar-benar dapat mengartikulasikan kebutuhan digitalnya? — jawab lewat wawancara
- 🔬 [Riset] Apa objection utama terhadap talenta relawan yang belum dikenal? — menentukan desain lapisan kepercayaan
- [Tim] Siapa yang berperan sebagai Liaison saat pilot?

**Non-blocking:**
- Bagaimana menangani kebutuhan yang ternyata di luar kemampuan talenta yang tersedia?
- Apakah rating numerik diperlukan, atau testimoni naratif saja sudah cukup?
- Batas waktu otomatis untuk kebutuhan yang tidak mendapat pelamar?

---

## 14. Timeline

| Tahap | Waktu | Fokus |
|---|---|---|
| Riset lapangan (wawancara 3–5 komunitas) | Sebelum akhir Juli | Menguatkan Problem Statement dengan bukti |
| Penyusunan & pengumpulan proposal | **Batas 31 Juli 2026** | BAB I–IV + diagram + mockup |
| Penilaian penyisihan | 1–14 Agustus 2026 | — |
| Pengumuman finalis | 8 September 2026 | — |
| **Final onsite** | **24 September 2026** | Implementasi P0 + demo live loop penuh |

**Prinsip fase:** Tahap 1 (platform matchmaking) = yang dibangun. Tahap 2 (outreach terstruktur) & Tahap 3 (jaringan antar komunitas) = ditulis pada bagian Evaluasi & Pengembangan, **tidak dibangun**.

---

## 15. Pemetaan ke Format Proposal Lomba

| Bagian PRD | Ditempatkan di proposal |
|---|---|
| §1 Ringkasan Eksekutif | Ringkasan Proyek |
| §2 Problem Statement | BAB I — Latar Belakang & Rumusan Masalah |
| §3 Goals | BAB I — Tujuan & Manfaat Sistem |
| §5 Personas | BAB II — Analisis Pengguna |
| §8 Requirements (P0) | BAB II — Rancangan Fitur Utama |
| §7 State Machine + §9 Model Data | BAB II — Arsitektur Sistem (Use Case / Flowchart) |
| §11 Teknologi | BAB II — Teknologi yang Digunakan |
| §9 Model Data | BAB III — Struktur Database |
| §7 Alur | BAB III — Alur Sistem |
| §10 Metrics | BAB III — Rencana Pengujian |
| §4 Non-goals + §8 P2 + §12 Risiko | BAB IV — Potensi Pengembangan & Tantangan Teknis |
