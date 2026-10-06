// Panduan aplikasi untuk Tanya SUSI sebagai pemandu & CS: ringkasan SUSI, kebijakan, dan peta menu per
// peran. Disuntikkan ke prompt sebagai <panduan> pada setiap jawaban LLM non-personal, sehingga pertanyaan
// yang tidak tercakup satu entri KB tetap bisa dijawab tanpa menebak. Isinya HARUS sesuai aplikasi:
// perbarui bila menu, alur, atau kebijakan berubah (sumber: kb.json, dasbor di frontend/src/pages/dashboards).

const COMMON = `Tentang SUSI Community:
- Platform yang mempertemukan komunitas warga dan UMKM di Bandung yang punya masalah digital (pencatatan, keuangan, website, katalog, promosi, data) dengan talenta IT yang mencari pengalaman proyek nyata.
- Gratis untuk komunitas. Tidak ada pembayaran, tarif, atau rekening bersama di dalam platform. Talenta mendapat pengalaman, portofolio, testimoni yang diverifikasi komunitas, poin reputasi dan level, serta bisa mengajukan sertifikasi SUSI.
- Peran: Komunitas (requester, pengurus komunitas atau pelaku UMKM yang mengajukan masalah; pelaku UMKM juga mendaftar dengan peran Komunitas), Talenta (mengerjakan proyek), AgenSUSI (liaison, anggota inti SUSI yang turun ke lapangan dan menangani bantuan langsung), admin.
- Komunitas di SUSI punya anggota: talenta bisa mengajukan gabung ke komunitas yang terdaftar di SUSI (tab Komunitas → "Ajukan gabung"), lalu pengurusnya menyetujui. Anggota bisa menulis di mading atas nama komunitas itu.
- Saat ini fokus di Bandung. Belum ada aplikasi Android/iOS; SUSI dipakai lewat website.
- Panduan ini tidak memuat data jumlah, jenis, atau keberhasilan proyek yang pernah ditangani SUSI, jumlah pengguna, maupun riwayat berdirinya SUSI. Angka statistik hanya tampil di halaman depan.

Label status persis seperti di aplikasi (hanya label ini yang ada):
- Moderasi kebutuhan: MENUNGGU MODERASI, TAYANG, DITOLAK.
- Status kebutuhan: TERBUKA, DIKERJAKAN, SELESAI, DITUTUP.
- Kolom papan di Beranda Komunitas: DALAM ANTRIAN, DIPROSES, MENUNGGU VERIFIKASI, SELESAI DIVERIFIKASI.
- Status proyek: DITERIMA (menunggu talenta menyetujui kesepakatan), DIKERJAKAN, REVISI (komunitas meminta perbaikan), MENUNGGU VERIFIKASI (talenta menandai selesai), TERVERIFIKASI (dikonfirmasi kedua pihak), SENGKETA (dimediasi admin), DIBATALKAN (talenta mundur).
- Status lamaran: MENUNGGU, DITERIMA, DITOLAK.
- Status sengketa: MEDIASI, ESKALASI, SELESAI.
- Status permintaan bantuan ke AgenSUSI di chat: MENUNGGU AGEN, DITANGANI, SELESAI.
- Level talenta: Talenta Muda, Talenta Terpercaya, Talenta Ahli.

Alur proyek:
1. Komunitas menceritakan masalah lewat formulir "+ Ajukan Kebutuhan" dengan bahasa sehari-hari (atau dicatatkan AgenSUSI bila belum terbiasa dengan website).
2. Admin memoderasi; setelah disetujui, kebutuhan tampil di katalog proyek terbuka.
3. Talenta melamar; komunitas memilih satu talenta dari para pelamar setelah melihat rekam jejaknya. Komunitas tidak bisa langsung memilih talenta yang belum melamar; yang bisa dilakukan adalah mengundang talenta dari rekomendasi sistem (paling banyak 5 undangan per kebutuhan) agar mereka melamar.
4. Kedua pihak menyepakati scope (batasan pekerjaan) dan definisi selesai.
5. Talenta mengerjakan, lalu menandai selesai dengan mengirim hasil.
6. Komunitas memeriksa dan memverifikasi hasil, lalu memberi testimoni. Bila ada masalah serius, bisa diajukan sengketa yang dimediasi admin.
- Tidak ada jaminan waktu tunggu: lamanya tergantung moderasi dan ada tidaknya talenta yang cocok. Kebutuhan yang terlalu besar atau rumit dibantu dipecah/diperjelas oleh AgenSUSI.
- Komunitas boleh mengajukan lebih dari satu kebutuhan; tiap kebutuhan dimoderasi dan dikerjakan terpisah.
- Talenta yang sudah dipilih tetapi tidak sanggup melanjutkan boleh mengundurkan diri dengan menuliskan alasannya (selama proyek di tahap kesepakatan, dikerjakan, atau revisi), dari tab Proyek Saya. Proyek menjadi DIBATALKAN, kebutuhan kembali terbuka di katalog, dan komunitas diberi tahu agar bisa memilih talenta lain.

Tanya SUSI & AgenSUSI (bantuan):
- Tanya SUSI (kamu) adalah asisten AI di tombol chat; bisa ditanya kapan saja, juga oleh pengunjung yang belum masuk.
- Butuh orang: ketik di chat Tanya SUSI, misalnya "hubungkan saya dengan AgenSUSI". Bila muncul kartu "Lanjutkan dengan AgenSUSI?", tekan "Ya, hubungkan". Tiket dibuat, percakapan berlanjut di "Ruang AgenSUSI" (halaman penuh di dasbor) dan AI dijeda selama ditangani AgenSUSI. Di luar jam layanan, tiket tetap tercatat dan pengguna diarahkan ke WhatsApp resmi. Jam layanan dan lama waktu balasan AgenSUSI tidak dicantumkan di aplikasi.
- Halaman "Tentang Kami" hanya berisi kontak resmi SUSI (WhatsApp, email) dan lokasi tim (SMKN 4 Bandung, dengan peta dan rute Google Maps). Halaman itu tidak memuat sejarah, pendiri, tanggal berdiri, maupun jam operasional.
- Akun: daftar di halaman Masuk → Daftar, pilih peran Komunitas atau Talenta (bawaannya Komunitas, pastikan memilih yang benar). Belum ada fitur reset atau ubah kata sandi di aplikasi: bila lupa kata sandi, hubungi kontak resmi atau AgenSUSI. Setelah 10 kali gagal masuk dalam 15 menit, percobaan ditahan 15 menit. Penghapusan akun diproses tim SUSI (Pengaturan → Akun → Hapus Akun).
- Keaslian sertifikat talenta bisa dicek siapa pun tanpa masuk: buka tautan verifikasi yang tercantum di sertifikat, atau di halaman verifikasi isi kolom "Cek kode sertifikat lain" dengan kode berformat SUSI-XXXX-XXXX. Halaman menampilkan status berlaku atau dicabut.

Menu untuk semua pengguna yang sudah masuk:
- Lonceng notifikasi di atas.
- Pengaturan punya tab Profil (ubah nama, nomor telepon, bio, info tambahan, foto; email tidak bisa diubah sendiri, hubungi kontak resmi), Notifikasi (aktivitas talenta & lamaran, balasan mading), Privasi, dan Akun (keluar, hapus akun). Tab Privasi berisi "Kontrol Data" ("Tampilkan saya di rekomendasi" untuk talenta, "Tampilkan lokasi komunitas di peta publik") dan "Tanya SUSI" ("Izinkan AI menjawab pertanyaan saya", "Personalisasi Tanya SUSI", "Simpan riwayat chat Tanya SUSI", tombol hapus riwayat). Riwayat chat tersimpan terhapus otomatis setelah 90 hari.`;

const ROLE_MENUS = {
  public: `Pengunjung yang belum masuk:
- Halaman depan (penjelasan SUSI, statistik, Tanya SUSI), "Tentang Kami" (kontak resmi & lokasi tim), dan halaman Masuk/Daftar.
- Untuk mengajukan kebutuhan atau melamar proyek perlu daftar dan masuk dulu.`,
  requester: `Menu Komunitas (requester):
- Beranda: kartu "Rekomendasi AI" paling atas; papan kebutuhan Anda per tahap (Dalam Antrian, Diproses, Menunggu Verifikasi, Selesai Diverifikasi) beserta tindakan yang perlu dilakukan (mis. "Tinjau hasil & verifikasi", perbaiki kebutuhan yang ditolak moderasi); tombol "+ Ajukan Kebutuhan". Dari detail kebutuhan: lihat pelamar, pilih talenta, undang talenta yang direkomendasikan, sepakati scope, verifikasi hasil, beri testimoni, ajukan sengketa.
- Mading: topik diskusi komunitas.
- Komunitas & Peta: komunitas Anda (daftarkan komunitas, setujui permintaan gabung), peta lokasi komunitas; lokasi bisa disembunyikan dari publik.
- Profil, Pengaturan, dan Ruang AgenSUSI.`,
  talent: `Menu Talenta:
- Lihat Proyek: kartu "Rekomendasi AI" paling atas (kebutuhan yang cocok, tip keahlian, progres sertifikasi) dan katalog proyek terbuka (urut "Paling cocok" atau "Terbaru"); tombol lamar dari detail kebutuhan.
- Histori: histori lamaran beserta statusnya.
- Proyek Saya: proyek yang sedang dikerjakan (setujui kesepakatan, kirim hasil).
- Komunitas: daftar komunitas yang ada di SUSI; tekan "Ajukan gabung" pada komunitas yang ingin dibantu, lalu tunggu persetujuan pengurus (status Menunggu → Anggota). Setelah jadi anggota, bisa menulis di mading atas nama komunitas itu.
- Mading, Profil (keahlian, portofolio, sertifikasi: bisa diajukan setelah minimal 3 proyek selesai diverifikasi, lalu ditinjau AgenSUSI/admin), Pengaturan (termasuk Privasi → "Tampilkan saya di rekomendasi"), dan Ruang AgenSUSI.`,
  liaison: `Menu AgenSUSI (liaison):
- Beranda, Eskalasi (kotak masuk tiket dari Tanya SUSI: klaim, balas, selesaikan, atau kembalikan ke AI), Sertifikasi (tinjau pengajuan), Kunjungan (catat kunjungan lapangan), Catat Kebutuhan (atas nama komunitas yang belum punya akun), Kebutuhan Tercatat, Komunitas & Peta, Laporan, Pengaturan.`,
  admin: `Menu admin:
- Ringkasan, Moderasi (kebutuhan & konten), Sertifikasi, Sengketa, Pengguna (status akun), AgenSUSI (akun liaison), Tanya SUSI (basis pengetahuan, pertanyaan belum terjawab, eskalasi), Log Audit, Pengaturan.`,
};

/** Panduan aplikasi untuk peran penanya (anonim = public). */
export function appGuide(role = 'public') {
  return `${COMMON}\n\n${ROLE_MENUS[role] ?? ROLE_MENUS.public}`;
}
