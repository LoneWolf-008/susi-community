# Addendum PRD — Rekomendasi Talenta ↔ Kebutuhan (Fase 2, R1)

**Status:** berlaku mulai Fase 2 · **Menyelaraskan:** PRD §4 (Non-Goals) dan §8 P2

## Apa yang berubah

PRD v1 menempatkan *"Pencocokan otomatis berbasis algoritma/AI"* sebagai non-goal (§4) dan
*"Rekomendasi pencocokan otomatis berbasis riwayat"* sebagai P2 (§8). Masukan tester Fase 2 meminta
talenta dibantu menemukan kebutuhan yang cocok, dan komunitas dibantu menemukan talenta. Fitur ini
dibangun sebagai **rekomendasi**, bukan pencocokan otomatis:

- Sistem **mengurutkan dan menjelaskan**: "Menguasai 2 dari 3 keahlian yang dibutuhkan (React,
  JavaScript)", "Pernah menyelesaikan proyek kategori Website", dan seterusnya.
- **Manusia tetap memilih.** Talenta tetap memutuskan sendiri untuk melamar. Komunitas, atau
  AgenSUSI sebagai pemilik proksi, tetap memilih dari pelamar.
- "Undang melamar" hanya mengirim undangan, maksimal 5 per kebutuhan. Talenta tidak pernah
  ditempelkan ke proyek tanpa persetujuannya.
- Label di antarmuka: **"Rekomendasi sistem. Keputusan tetap di tangan Anda."**

Dengan begitu alur inti PRD §7 (browse → lamar → pilih → kesepakatan) tidak berubah. Rekomendasi
hanya mempercepat langkah "browse".

## Mengapa deterministik pada v1

Skor dihitung aturan terukur di `backend/services/recommendation/score.js`, bukan oleh model AI.

| Komponen | Bobot |
|---|---|
| Cakupan keahlian yang dibutuhkan | 50 |
| Kategori yang pernah diselesaikan (7,5 bila baru pernah melamar) | 15 |
| Anggota komunitas pemilik kebutuhan | 10 |
| Sektor wilayah yang sama | 5 |
| Level reputasi & sertifikasi (bonus kecil, pemula tetap dapat poin dasar) | maks. 10 |
| Sedang mengerjakan ≥ 2 proyek | −10 |
| Kebutuhan baru dibuka | 5 |

Alasan memilih aturan:

1. **Bisa diaudit dan dijelaskan.** Setiap poin punya alasan yang tampil ke pengguna dan bisa diuji
   dengan fixture.
2. **Tidak mengarang.** Hanya data yang ada di platform yang dipakai. Kebutuhan tanpa daftar
   keahlian dicocokkan lewat kata kunci, dengan keyakinan rendah dan bobot yang dibatasi.
3. **Data historis masih sedikit.** Alasan non-goal di PRD §4 tetap benar untuk model yang
   "belajar"; aturan sederhana tidak butuh data latih.
4. **Murah.** Tanpa panggilan LLM, dan hasil disimpan 60 detik per pengguna.

Chatbot (task R3) boleh **menjelaskan** rekomendasi ini kepada pengguna, tetapi tidak menghitung atau
menambah rekomendasi sendiri. "AI belajar dari profil" berarti konteks profil disuntikkan saat
menjawab, bukan fine-tuning.

## Privasi dan kendali pengguna

- **Toggle "Tampilkan saya di rekomendasi"** (`show_in_recommendations`, bawaan aktif) ada di
  Pengaturan talenta. Bila dimatikan, talenta tidak muncul di daftar rekomendasi komunitas dan tidak
  bisa diundang. Ia tetap bisa melamar seperti biasa.
- Pemilik kebutuhan hanya melihat kolom yang sudah boleh ia lihat pada pelamar: nama, level,
  keahlian, jumlah proyek selesai, dan status sertifikasi. Email dan telepon tidak pernah tampil.
- Rekomendasi talenta hanya untuk pemilik efektif kebutuhan itu (komunitas, atau AgenSUSI untuk
  jalur Assisted); pengguna lain mendapat 403.
- Talenta tanpa keahlian tidak dihitung dan diajak melengkapi profil. Rekomendasi juga mensyaratkan
  minimal satu keahlian cocok, sehingga bonus komunitas atau wilayah saja tidak cukup.

## Dampak ke dokumen lain

- **PRD §4:** baris "Pencocokan otomatis berbasis algoritma/AI" tetap non-goal dalam arti keputusan
  otomatis. Rekomendasi yang dijelaskan dan dipilih manusia sekarang dibangun (Fase 2).
- **PRD §8 P2:** "Rekomendasi pencocokan otomatis berbasis riwayat" naik menjadi fitur Fase 2
  dengan batasan di atas.
- **Proposal BAB IV:** sebut fitur ini sebagai *rekomendasi transparan*, bukan *AI matching*.
