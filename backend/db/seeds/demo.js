// Data demo SUSI Community, dipakai utils/seed.js.
//
// Persona dan teks kebutuhan diambil dari seed SDD §2.5 (Ibu Siti, Pak Deden, Rizky,
// Nabila, Fajar, Alya, Budi) lalu dipetakan ke skema needs/applications/projects.
// Data tambahan menutup kebutuhan T1: status DISPUTED, dua PENDING, satu REJECTED,
// dan 8 komunitas di keempat sektor Bandung. Semua email memakai domain .test.
//
// Waktu ditulis relatif terhadap saat seed dijalankan (`daysAgo`, `inDays`) agar
// tampilan demo selalu terasa baru.

export const SKILLS = [
  'React', 'JavaScript', 'HTML & CSS', 'MySQL', 'Laravel', 'PHP', 'Excel', 'Google Sheets',
  'Google Forms', 'Data Entry', 'Looker Studio', 'Figma', 'Canva', 'Desain Poster', 'Branding',
];

// Admin dibuat dari ADMIN_EMAIL / ADMIN_PASSWORD; akun di bawah memakai SEED_USER_PASSWORD.
export const USERS = [
  {
    key: 'budi', role: 'liaison', name: 'Budi Santoso', email: 'budi@susi.test', phone: '081400000007',
    bio: 'Anggota inti SUSI, penanggung jawab outreach wilayah Bandung Timur.', extra_info: 'AgenSUSI',
  },
  {
    key: 'siti', role: 'requester', name: 'Ibu Siti Rohmah', email: 'siti@umkm.test', phone: '081200000001',
    bio: 'Pengurus paguyuban UMKM Cibaduyut, mengelola 24 pelaku usaha sepatu.',
    extra_info: 'Paguyuban UMKM Sepatu Cibaduyut',
  },
  {
    key: 'deden', role: 'requester', name: 'Pak Deden Hidayat', email: 'deden@karta.test', phone: '081200000002',
    bio: 'Ketua Karang Taruna RW 08 Antapani.', extra_info: 'Karang Taruna RW 08 Antapani',
  },
  {
    key: 'ujang', role: 'requester', name: 'Kang Ujang Supriatna', email: 'ujang@kebun.test', phone: '081200000003',
    bio: 'Koordinator kebun warga di lahan fasos Buahbatu.', extra_info: 'Komunitas Urban Farming Buahbatu',
  },
  {
    key: 'rizky', role: 'talent', name: 'Rizky Ananda', email: 'rizky@talenta.test', phone: '081300000003',
    bio: 'Fresh graduate Teknik Informatika, mencari proyek nyata pertama.', extra_info: 'Fresh graduate',
    skills: ['React', 'JavaScript', 'MySQL'],
  },
  {
    key: 'nabila', role: 'talent', name: 'Nabila Putri', email: 'nabila@talenta.test', phone: '081300000004',
    bio: 'Career switcher dari akuntansi ke data. Terbiasa merapikan data berantakan.', extra_info: 'Career switcher',
    skills: ['Excel', 'Google Sheets', 'Data Entry', 'Looker Studio'],
  },
  {
    key: 'fajar', role: 'talent', name: 'Fajar Nugroho', email: 'fajar@talenta.test', phone: '081300000005',
    bio: 'Junior engineer, 1 tahun pengalaman web. Sudah menyelesaikan proyek komunitas.', extra_info: 'Junior engineer',
    skills: ['Laravel', 'PHP', 'MySQL', 'Desain Poster'],
  },
  {
    key: 'alya', role: 'talent', name: 'Alya Rahmawati', email: 'alya@talenta.test', phone: '081300000006',
    bio: 'Mahasiswa tingkat akhir DKV, fokus desain identitas visual UMKM.', extra_info: 'Mahasiswa DKV',
    skills: ['Figma', 'Canva', 'Desain Poster', 'Branding'],
  },
];

// Pusat sektor: lng 107.6191, lat -6.9175 (lihat kolom generated `sector`).
export const COMMUNITIES = [
  {
    key: 'cibaduyut', name: 'Paguyuban UMKM Sepatu Cibaduyut', type: 'UMKM', createdBy: 'siti',
    description: 'Paguyuban 24 pelaku usaha sepatu rumahan di sentra Cibaduyut.',
    leader_name: 'Ibu Siti Rohmah', leader_role: 'Ketua Paguyuban', members_count: 24, established_at: '2015',
    whatsapp: '081200000001', address: 'Jl. Cibaduyut Raya, Bojongloa Kidul, Bandung',
    lat: -6.947200, lng: 107.594600, members: [{ user: 'siti', role_in: 'PENGURUS' }], // BARAT–SELATAN
  },
  {
    key: 'karta', name: 'Karang Taruna RW 08 Antapani', type: 'KARANG TARUNA', createdBy: 'deden',
    description: 'Organisasi pemuda RW 08: lomba 17-an, ronda, dan kegiatan sosial warga.',
    leader_name: 'Pak Deden Hidayat', leader_role: 'Ketua', members_count: 35, established_at: '2012',
    whatsapp: '081200000002', address: 'Jl. Purwakarta, Antapani, Bandung',
    lat: -6.913800, lng: 107.661700, members: [{ user: 'deden', role_in: 'PENGURUS' }], // TIMUR–UTARA
  },
  {
    key: 'pkk', name: 'PKK RW 04 Ujungberung', type: 'PKK', createdBy: 'budi',
    description: 'Didaftarkan AgenSUSI saat kunjungan lapangan; pengurus belum punya akun.',
    leader_name: 'Ibu Euis Kurniasih', leader_role: 'Ketua PKK', members_count: 80, established_at: '2008',
    whatsapp: null, address: 'Ujungberung, Bandung', lat: -6.912600, lng: 107.701900, members: [], // TIMUR–UTARA
  },
  {
    key: 'kebun', name: 'Komunitas Urban Farming Buahbatu', type: 'LAINNYA', createdBy: 'ujang',
    description: 'Kebun warga di lahan fasos; hasil panen dibagi ke anggota yang ikut piket.',
    leader_name: 'Kang Ujang Supriatna', leader_role: 'Koordinator', members_count: 18, established_at: '2019',
    whatsapp: '081200000003', address: 'Buahbatu, Bandung',
    lat: -6.952300, lng: 107.639800, members: [{ user: 'ujang', role_in: 'PENGURUS' }], // TIMUR–SELATAN
  },
  {
    key: 'irma', name: 'Remaja Masjid Al-Ikhlas Sukajadi', type: 'PEMUDA', createdBy: 'budi',
    description: 'Ikatan remaja masjid: kajian pekanan dan penggalangan donasi.',
    leader_name: 'Fikri Ramadhan', leader_role: 'Ketua IRMA', members_count: 27, established_at: '2016',
    whatsapp: null, address: 'Sukajadi, Bandung', lat: -6.887600, lng: 107.596300, members: [], // BARAT–UTARA
  },
  {
    key: 'gowes', name: 'Komunitas Gowes Pasupati', type: 'HOBI', createdBy: 'budi',
    description: 'Komunitas sepeda dengan gowes bareng tiap Minggu pagi.',
    leader_name: 'Hendra Gunawan', leader_role: 'Koordinator', members_count: 60, established_at: '2018',
    whatsapp: null, address: 'Coblong, Bandung', lat: -6.899300, lng: 107.610800, members: [], // BARAT–UTARA
  },
  {
    key: 'cijerah', name: 'Pengurus RW 03 Cijerah', type: 'RT/RW', createdBy: 'budi',
    description: 'Pengurus RW yang mengelola pendataan dan informasi warga.',
    leader_name: 'Pak Ade Suryana', leader_role: 'Ketua RW', members_count: 12, established_at: '2001',
    whatsapp: null, address: 'Cijerah, Bandung Kulon, Bandung', lat: -6.926400, lng: 107.562800, members: [], // BARAT–SELATAN
  },
  {
    key: 'arisan', name: 'Arisan Keluarga Besar Kiaracondong', type: 'KELUARGA', createdBy: 'budi',
    description: 'Arisan bulanan keluarga besar dengan 32 peserta.',
    leader_name: 'Ibu Tati Rostiati', leader_role: 'Bendahara', members_count: 32, established_at: '2010',
    whatsapp: null, address: 'Kiaracondong, Bandung', lat: -6.925100, lng: 107.644900, members: [], // TIMUR–SELATAN
  },
];

const NOTIF_LAMARAN_BARU = { type: 'talenta', title: 'Lamaran baru', body: 'Ada talenta yang melamar kebutuhan Anda' };

// owner = pembuat kebutuhan. Requester → jalur MANDIRI; liaison → jalur AGENSUSI dan menjadi
// pemilik proksi (projects.requester_id = liaison, keputusan desain #1 di docs/TASKS.md).
export const NEEDS = [
  {
    key: 'n1', owner: 'siti', community: 'cibaduyut', category: 'PENCATATAN', createdDaysAgo: 12,
    title: 'Catatan penjualan saya berantakan',
    summary: 'Pencatatan penjualan harian masih di buku tulis dan sering hilang.',
    description: 'Tiap hari saya catat penjualan di buku tulis, sering hilang dan susah dihitung akhir bulan. Pengen ada cara yang lebih rapi tapi jangan yang ribet.',
    skills: ['Excel', 'Google Sheets'], moderation: 'APPROVED', status: 'OPEN',
    applications: [
      { talent: 'nabila', status: 'MENUNGGU', daysAgo: 9, message: 'Saya biasa merapikan data penjualan pakai Google Sheets. Bisa saya buatkan yang tinggal isi, lalu totalnya jalan otomatis. Saya juga siap ajari cara pakainya.' },
      { talent: 'rizky', status: 'MENUNGGU', daysAgo: 6, message: 'Saya bisa bantu buatkan pencatatan sederhana. Kalau nanti perlu, bisa dikembangkan jadi web kecil.' },
    ],
    notifications: [
      { user: 'siti', ...NOTIF_LAMARAN_BARU, ref: 'need', daysAgo: 9, read: true },
      { user: 'siti', ...NOTIF_LAMARAN_BARU, ref: 'need', daysAgo: 6, read: false },
    ],
  },
  {
    key: 'n2', owner: 'budi', community: 'pkk', category: 'PENCATATAN', createdDaysAgo: 5,
    title: 'Data anggota PKK masih ditulis tangan',
    summary: 'Data sekitar 80 anggota PKK masih di buku dan sulit dicari.',
    description: 'Ibu-ibu PKK punya sekitar 80 anggota, datanya masih di buku. Kalau mau cari data satu orang harus dibuka satu-satu. Ingin bisa dicari lebih cepat.',
    skills: ['Excel', 'Google Sheets', 'Data Entry'], moderation: 'APPROVED', status: 'OPEN',
    applications: [],
  },
  {
    key: 'n3', owner: 'deden', community: 'karta', category: 'APLIKASI', createdDaysAgo: 20,
    title: 'Pendaftaran lomba 17 Agustus masih lewat WhatsApp satu-satu',
    summary: 'Panitia kewalahan mendata peserta lomba lewat chat pribadi.',
    description: 'Tiap tahun panitia kewalahan mendata peserta lomba karena semua daftar lewat chat pribadi. Sering ada yang kelewat.',
    skills: ['Google Forms', 'Google Sheets'], moderation: 'APPROVED', status: 'IN_PROGRESS',
    applications: [
      { talent: 'nabila', status: 'DITERIMA', daysAgo: 18, decidedDaysAgo: 2, message: 'Saya bisa buatkan formulir pendaftaran online yang datanya langsung masuk spreadsheet.' },
      { talent: 'rizky', status: 'DITOLAK', daysAgo: 17, decidedDaysAgo: 2, message: 'Tertarik membantu, saya sudah pernah membuat form pendaftaran serupa.' },
    ],
    project: {
      talent: 'nabila', status: 'AGREEMENT', progress: 5, deadlineInDays: 14,
      scope: 'Membuat formulir pendaftaran lomba online beserta rekap peserta otomatis dalam spreadsheet.',
      done_definition: 'Selesai bila formulir dapat diisi dari HP, data peserta masuk otomatis, dan panitia sudah dapat membuka rekapnya sendiri.',
      timeline: { created: 2, agreedByCommunity: 2 },
    },
    notifications: [
      { user: 'nabila', type: 'talenta', title: 'Lamaran diterima', body: 'Lamaran Anda diterima, silakan tinjau kesepakatan', ref: 'project', daysAgo: 2, read: false },
      { user: 'rizky', type: 'talenta', title: 'Lamaran ditolak', body: 'Lamaran Anda belum diterima kali ini', ref: 'application:rizky', daysAgo: 2, read: true },
    ],
  },
  {
    key: 'n4', owner: 'budi', community: 'pkk', category: 'LAINNYA', createdDaysAgo: 25,
    title: 'Kegiatan PKK tidak ada dokumentasi yang bisa dilihat warga',
    summary: 'Foto kegiatan PKK hanya tersimpan di galeri HP pengurus.',
    description: 'Setiap kegiatan cuma difoto lalu hilang di galeri HP. Warga tidak tahu PKK sedang mengerjakan apa.',
    skills: ['Desain Poster', 'Canva'], moderation: 'APPROVED', status: 'IN_PROGRESS',
    applications: [
      { talent: 'alya', status: 'DITERIMA', daysAgo: 23, decidedDaysAgo: 22, message: 'Saya mahasiswa DKV, bisa bantu buatkan template poster kegiatan yang tinggal ganti foto dan teks.' },
    ],
    project: {
      talent: 'alya', status: 'IN_PROGRESS', progress: 40, deadlineInDays: 7,
      scope: 'Membuat 3 template poster kegiatan PKK yang dapat diganti foto dan teksnya secara mandiri.',
      done_definition: 'Selesai bila 3 template tersedia di Canva, sudah dibagikan aksesnya, dan pengurus sudah mencoba mengganti isinya sekali.',
      timeline: { created: 22, agreedByCommunity: 22, agreedByTalent: 21, started: 21 },
    },
  },
  {
    key: 'n5', owner: 'siti', community: 'cibaduyut', category: 'LAINNYA', createdDaysAgo: 35,
    title: 'Belum punya katalog produk yang bisa dikirim ke pembeli',
    summary: 'Foto produk dikirim satu per satu lewat WhatsApp.',
    description: 'Kalau ada yang tanya produk, saya kirim foto satu-satu lewat WA. Pengen ada satu file katalog yang tinggal dikirim.',
    skills: ['Figma', 'Canva', 'Desain Poster'], moderation: 'APPROVED', status: 'IN_PROGRESS',
    applications: [
      { talent: 'alya', status: 'DITERIMA', daysAgo: 33, decidedDaysAgo: 32, message: 'Saya bisa susun katalog produk dalam satu file PDF yang rapi dan siap dikirim lewat WA.' },
    ],
    // Titik mulai demo sign-off dua arah: requester tinggal memverifikasi.
    project: {
      talent: 'alya', status: 'AWAITING_VERIFICATION', progress: 90, deadlineInDays: 3,
      scope: 'Menyusun katalog produk sepatu dalam satu berkas PDF berisi minimal 15 produk beserta harga.',
      done_definition: 'Selesai bila berkas PDF katalog diterima, dapat dikirim lewat WhatsApp, dan seluruh harga sudah dikoreksi pemilik usaha.',
      timeline: { created: 32, agreedByCommunity: 32, agreedByTalent: 31, started: 31, done: 2 },
      deliveries: [{ daysAgo: 2, link_url: 'https://example.com/demo/katalog-sepatu-cibaduyut.pdf' }],
    },
    notifications: [
      { user: 'siti', type: 'verifikasi', title: 'Proyek menunggu verifikasi', body: 'Talenta telah menandai proyek selesai', ref: 'project', daysAgo: 2, read: false },
    ],
  },
  {
    key: 'n6', owner: 'deden', community: 'karta', category: 'WEBSITE', createdDaysAgo: 60,
    title: 'Jadwal ronda sering bentrok dan tidak ada yang pegang',
    summary: 'Jadwal ronda di kertas sering hilang.',
    description: 'Jadwal ronda dibuat di kertas, sering hilang, akhirnya banyak yang tidak tahu gilirannya kapan.',
    skills: ['Google Sheets', 'HTML & CSS'], moderation: 'APPROVED', status: 'COMPLETED',
    applications: [
      { talent: 'fajar', status: 'DITERIMA', daysAgo: 58, decidedDaysAgo: 57, message: 'Saya bisa buatkan halaman jadwal ronda sederhana yang bisa dibuka dari HP.' },
    ],
    project: {
      talent: 'fajar', status: 'COMPLETED', progress: 100, deadlineInDays: -33,
      scope: 'Membuat halaman jadwal ronda sederhana yang dapat dibuka dari ponsel.',
      done_definition: 'Selesai bila halaman dapat diakses warga dan jadwal satu bulan penuh sudah terisi.',
      timeline: { created: 57, agreedByCommunity: 57, agreedByTalent: 56, started: 56, done: 31, verified: 30 },
      deliveries: [{ daysAgo: 31, link_url: 'https://example.com/demo/jadwal-ronda-rw08' }],
      testimonial: {
        from: 'deden', daysAgo: 30,
        text: 'Halaman jadwalnya dipakai terus sampai sekarang. Fajar sabar menjelaskan ke pengurus yang gaptek, tidak pernah membuat kami merasa bodoh.',
      },
    },
    notifications: [
      { user: 'fajar', type: 'verifikasi', title: 'Proyek diverifikasi, reputasi +1', body: 'Komunitas mengonfirmasi proyek Anda', ref: 'project', daysAgo: 30, read: true },
    ],
  },
  {
    key: 'n7', owner: 'budi', community: 'pkk', category: 'PENCATATAN', createdDaysAgo: 70,
    title: 'Iuran bulanan sering telat ditagih karena tidak ada catatan',
    summary: 'Bendahara PKK lupa siapa yang sudah membayar iuran.',
    description: 'Bendahara lupa siapa yang sudah bayar dan siapa yang belum, karena catatannya tercecer.',
    skills: ['Excel', 'Google Sheets'], moderation: 'APPROVED', status: 'COMPLETED',
    applications: [
      { talent: 'nabila', status: 'DITERIMA', daysAgo: 68, decidedDaysAgo: 67, message: 'Saya bisa buatkan pencatatan iuran otomatis; bendahara tinggal centang siapa yang sudah bayar.' },
    ],
    // Jalur assisted tuntas sampai reputasi: diverifikasi liaison atas nama komunitas.
    project: {
      talent: 'nabila', status: 'COMPLETED', progress: 100, deadlineInDays: -45,
      scope: 'Membuat pencatatan iuran bulanan berbasis spreadsheet dengan penanda status bayar.',
      done_definition: 'Selesai bila bendahara dapat mencatat pembayaran sendiri dan rekap tunggakan muncul otomatis.',
      timeline: { created: 67, agreedByCommunity: 67, agreedByTalent: 66, started: 66, done: 41, verified: 40 },
      deliveries: [{ daysAgo: 41, link_url: 'https://example.com/demo/iuran-pkk-rw04' }],
      testimonial: {
        from: 'budi', daysAgo: 40,
        text: 'Bendahara PKK sekarang bisa mencatat iuran sendiri tanpa dibantu. Nabila datang dua kali untuk memastikan ibu-ibu benar-benar bisa memakainya.',
      },
    },
    notifications: [
      { user: 'nabila', type: 'verifikasi', title: 'Proyek diverifikasi, reputasi +1', body: 'Komunitas mengonfirmasi proyek Anda', ref: 'project', daysAgo: 40, read: true },
    ],
  },
  {
    key: 'n8', owner: 'siti', community: 'cibaduyut', category: 'APLIKASI', createdDaysAgo: 40,
    title: 'Ingin bikin aplikasi kasir sendiri',
    summary: 'Ditarik pemiliknya karena belum mendesak.',
    description: 'Kepikiran mau punya aplikasi kasir, tapi setelah dipikir lagi belum terlalu perlu sekarang.',
    skills: [], moderation: 'APPROVED', status: 'CLOSED',
    applications: [],
  },
  {
    key: 'n9', owner: 'ujang', community: 'kebun', category: 'PENCATATAN', createdDaysAgo: 30,
    title: 'Catatan panen dan pembagian hasil kebun sering diperdebatkan',
    summary: 'Pembagian hasil panen ke anggota piket masih dihitung di buku.',
    description: 'Hasil panen kebun warga dibagi ke anggota yang ikut piket. Catatannya masih di buku, jadi setiap pembagian sering ada yang merasa kurang. Ingin ada catatan yang bisa dicek semua anggota.',
    skills: ['Google Sheets', 'Data Entry'], moderation: 'APPROVED', status: 'IN_PROGRESS',
    applications: [
      { talent: 'rizky', status: 'DITERIMA', daysAgo: 28, decidedDaysAgo: 27, message: 'Saya bisa buatkan rekap panen di Google Sheets yang menghitung bagian tiap anggota otomatis.' },
    ],
    project: {
      talent: 'rizky', status: 'DISPUTED', progress: 90, deadlineInDays: -5,
      scope: 'Membuat rekap panen mingguan dan pembagian hasil per anggota berbasis Google Sheets.',
      done_definition: 'Selesai bila input panen mingguan langsung menghasilkan bagian tiap anggota tanpa hitung manual, dan anggota bisa mengecek bagiannya sendiri.',
      timeline: { created: 27, agreedByCommunity: 27, agreedByTalent: 26, started: 26, done: 6 },
      deliveries: [{ daysAgo: 6, link_url: 'https://example.com/demo/rekap-panen-buahbatu' }],
      dispute: {
        openedDaysAgo: 3, status: 'MEDIASI',
        summary: 'Pembagian hasil per anggota belum otomatis seperti yang disepakati.',
        statement_community: 'Rekap sudah ada, tetapi bagian tiap anggota masih harus dihitung manual. Itu yang paling kami butuhkan.',
        statement_talent: null,
      },
    },
    notifications: [
      { user: 'rizky', type: 'sengketa', title: 'Sengketa dibuka', body: 'Komunitas membuka sengketa pada proyek Anda', ref: 'project', daysAgo: 3, read: false },
    ],
  },
  {
    key: 'n10', owner: 'ujang', community: 'kebun', category: 'APLIKASI', createdDaysAgo: 1,
    title: 'Ingin anggota bisa lihat jadwal piket kebun dari HP',
    summary: 'Jadwal piket dibagikan lewat foto kertas di grup WA.',
    description: 'Jadwal piket menyiram dan panen dibagikan lewat foto kertas di grup WA. Sering tertimbun chat lain dan ada yang lupa gilirannya.',
    skills: ['Google Sheets'], moderation: 'PENDING', status: 'OPEN',
    applications: [],
  },
  {
    key: 'n11', owner: 'budi', community: 'irma', category: 'WEBSITE', createdDaysAgo: 2,
    title: 'Jadwal kajian dan laporan donasi masih ditempel di papan masjid',
    summary: 'Jamaah yang jarang datang tidak tahu jadwal dan laporan donasi.',
    description: 'Pengurus remaja masjid menempel jadwal kajian dan laporan donasi di papan pengumuman. Jamaah yang jarang datang tidak tahu informasinya. Mereka ingin ada halaman sederhana yang bisa dibagikan.',
    skills: ['HTML & CSS', 'Canva'], moderation: 'PENDING', status: 'OPEN',
    applications: [],
  },
  {
    key: 'n12', owner: 'deden', community: 'karta', category: 'LAINNYA', createdDaysAgo: 15,
    title: 'Minta dibuatkan akun media sosial dan diisi kontennya setiap hari',
    summary: 'Pekerjaan rutin harian tanpa batas selesai.',
    description: 'Kami ingin ada yang membuatkan akun Instagram karang taruna sekaligus mengisi kontennya setiap hari.',
    skills: [], moderation: 'REJECTED', rejectReason: 'TIDAK LAYAK', status: 'OPEN',
    applications: [],
    notifications: [
      { user: 'deden', type: 'moderasi', title: 'Kebutuhan ditolak', body: 'Alasan: TIDAK LAYAK. Pekerjaan rutin harian belum bisa menjadi proyek; ajukan ulang dengan batasan yang jelas.', ref: 'need', daysAgo: 14, read: true },
    ],
  },
  {
    key: 'n13', owner: 'budi', community: 'arisan', category: 'PENCATATAN', createdDaysAgo: 8,
    title: 'Catatan setoran arisan sering beda dengan catatan peserta',
    summary: 'Selisih catatan setoran antara bendahara dan peserta.',
    description: 'Bendahara arisan mencatat setoran di buku, sementara peserta punya catatan sendiri. Tiap akhir putaran sering ada selisih dan bikin tidak enak. Mereka ingin satu catatan yang bisa dilihat bersama.',
    skills: ['Google Sheets', 'Excel'], moderation: 'APPROVED', status: 'OPEN',
    applications: [
      { talent: 'fajar', status: 'MENUNGGU', daysAgo: 4, message: 'Saya bisa buatkan pencatatan setoran yang bisa dicek peserta lewat tautan, jadi tidak ada lagi catatan berbeda.' },
    ],
    notifications: [
      { user: 'budi', ...NOTIF_LAMARAN_BARU, ref: 'need', daysAgo: 4, read: false },
    ],
  },
  {
    key: 'n14', owner: 'budi', community: 'gowes', category: 'APLIKASI', createdDaysAgo: 3,
    title: 'Pendaftaran gowes bareng dan pesanan kaos komunitas masih manual',
    summary: 'Data peserta dan ukuran kaos dikumpulkan lewat chat.',
    description: 'Setiap ada gowes bareng, koordinator mendata peserta dan ukuran kaos lewat chat satu per satu. Datanya sering tercecer dan pesanan kaos jadi salah ukuran.',
    skills: ['Google Forms', 'Google Sheets'], moderation: 'APPROVED', status: 'OPEN',
    applications: [],
  },
];

export const VISITS = [
  {
    liaison: 'budi', community: 'pkk', status: 'TERDATA', dayOffset: -6, time: '09:00:00', need: 'n2',
    contact_person: 'Ibu Euis Kurniasih',
    note: 'Pengurus tidak terbiasa memakai laptop; serah terima nanti perlu didampingi langsung.',
  },
  {
    liaison: 'budi', community: 'arisan', status: 'TERDATA', dayOffset: -9, time: '15:30:00', need: 'n13',
    contact_person: 'Ibu Tati Rostiati', note: 'Bendahara sudah memakai WhatsApp dan Google Drive di HP.',
  },
  {
    liaison: 'budi', community: 'gowes', status: 'TERDATA', dayOffset: -4, time: '07:00:00', need: 'n14',
    contact_person: 'Hendra Gunawan', note: 'Pesanan kaos sekitar 60 orang per batch.',
  },
  {
    liaison: 'budi', community: 'irma', status: 'TERDATA', dayOffset: -2, time: '19:30:00', need: 'n11',
    contact_person: 'Fikri Ramadhan', note: 'Pengurus aktif di Instagram; butuh halaman yang bisa dibagikan ke jamaah.',
  },
  // Belum dikunjungi: dipakai untuk demo alur kunjungan sampai TERDATA (T8).
  {
    liaison: 'budi', community: 'cijerah', status: 'DIRENCANAKAN', dayOffset: 2, time: '09:00:00', need: null,
    contact_person: 'Pak Ade Suryana', note: 'Perkenalan SUSI ke pengurus RW; gali kebutuhan pendataan warga.',
    notification: { type: 'kunjungan', title: 'Kunjungan terjadwal', body: 'Kunjungan ke Pengurus RW 03 Cijerah sudah dijadwalkan', read: false },
  },
];

// Warna mengikuti NOTE_COLORS di DashboardRequester.jsx.
export const TOPICS = [
  {
    author: 'siti', community: 'cibaduyut', category: 'TANYA', daysAgo: 2, pos_x: 90, pos_y: 70, rotation: -3, color: '#f4d4d4',
    text: 'Ada yang pernah catat stok barang pakai Google Sheets? Rumusnya bikin pusing, butuh contoh yang sederhana.',
    replies: [
      { author: 'nabila', community: null, daysAgo: 1, text: 'Bisa, Bu. Mulai dari satu sheet: tanggal, barang, masuk, keluar. Totalnya cukup pakai SUMIF.' },
    ],
  },
  {
    author: 'deden', community: 'karta', category: 'INFO', daysAgo: 5, pos_x: 430, pos_y: 140, rotation: 2, color: '#d8e2ec',
    text: 'Karang Taruna RW 08 buka kolaborasi lomba 17-an antar-RW. Komunitas lain yang mau ikut, balas di sini ya!',
    replies: [
      { author: 'ujang', community: 'kebun', daysAgo: 4, text: 'Komunitas kebun siap kirim bibit cabai buat hadiah lomba!' },
    ],
  },
  {
    author: 'nabila', community: null, category: 'DISKUSI', daysAgo: 3, pos_x: 780, pos_y: 90, rotation: -2, color: '#c9ecd9',
    text: 'Tips untuk komunitas yang baru mulai digital: catat transaksi harian dulu, rapikan seminggu sekali. Tidak perlu langsung bikin sistem yang rumit.',
    replies: [],
  },
  {
    author: 'ujang', community: 'kebun', category: 'TANYA', daysAgo: 1, pos_x: 250, pos_y: 420, rotation: 3, color: '#fdfcf7',
    text: 'Ada komunitas lain yang sudah pakai grup WA + spreadsheet untuk jadwal piket? Mau belajar caranya.',
    replies: [],
  },
];
