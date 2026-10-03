/* Knowledge base + mesin jawab "Tanya SUSI" — dipakai Landing, Navigation, dan AiAgent */

export const KB = [
  { keys: ['halo', 'hai', 'hi', 'hello', 'pagi', 'siang', 'sore'], reply: 'Halo! Saya Agen SUSI AI 👋\nSiap bantu navigasi platform SUSI. Mau tanya soal apa hari ini?' },
  { keys: ['proyek', 'status', 'progress', 'lacak'], reply: 'Untuk melihat progres proyek, buka tab **Beranda** di dasbor → klik kartu proyek yang ingin dipantau.\n\nSetiap proyek punya 4 fase:\n• DITERIMA → DIKERJAKAN → SELESAI → VERIFIKASI\n\nProgres visual muncul otomatis di kartu proyek.' },
  { keys: ['verifikasi', 'konfirmasi', 'testimoni'], reply: 'SUSI pakai **verifikasi dua arah** (langkah 08):\n\n1. Talenta menandai proyek selesai\n2. Komunitas mengonfirmasi + beri testimoni\n\nReputasi talenta bertambah **setelah kedua pihak konfirmasi** — menjaga kejujuran sistem.' },
  { keys: ['talenta', 'reputasi', 'poin', 'level'], reply: 'Sistem Reputasi Talenta:\n\n• Setiap proyek terverifikasi = +1 poin\n• Level: Talenta Muda → Terpercaya → Ahli\n• Reputasi tinggi = prioritas dipilih komunitas\n\nCek poinmu di tab **Profil** dasbor talenta.' },
  { keys: ['cara kerja', 'alur', 'langkah', 'proses'], reply: 'SUSI bekerja dalam **8 langkah**:\n\n1. Komunitas cerita masalah\n2. AgenSUSI data lapangan\n3. Masuk katalog terbuka\n4. Talenta mengajukan diri\n5. Komunitas pilih talenta\n6. Kesepakatan target\n7. Pengerjaan\n8. Verifikasi dua arah\n\nScroll ke section "Delapan Langkah" di beranda untuk detail visualnya.' },
  { keys: ['komunitas', 'daftar', 'gabung', 'ikut'], reply: 'Komunitas bergabung **gratis**:\n\n1. Daftar via halaman Masuk/Daftar → pilih peran Komunitas\n2. Lengkapi profil\n3. Ajukan kebutuhan di dasbor\n\nBelum familiar digital? AgenSUSI siap datang ke lokasi Anda.' },
  { keys: ['mading', 'diskusi', 'forum', 'topik'], reply: '**Mading Komunitas** adalah ruang diskusi lintas komunitas:\n\n• Drag papan untuk jelajah topik\n• Tempel topik baru (Diskusi/Tanya/Info)\n• Balas topik komunitas lain\n\nAkses via tab **Komunitas** di dasbor komunitas.' },
  { keys: ['map', 'peta', 'lokasi'], reply: 'Tab **Map** menampilkan komunitas terdaftar di Bandung:\n\n• Titik merah = komunitas existing\n• Titik mint = komunitas Anda\n• Klik titik → detail + rute Google Maps\n\nAnda juga bisa menandai komunitas baru dari tab ini.' },
  { keys: ['agen', 'agensusi', 'lapangan', 'kunjungan'], reply: '**AgenSUSI** adalah tim lapangan kami yang:\n\n• Datang langsung ke komunitas\n• Mencatat kebutuhan secara personal\n• Menjembatani komunitas yang belum familiar digital\n\nButuh kunjungan? Hubungi via WhatsApp di halaman Tentang Kami.' },
  { keys: ['biaya', 'bayar', 'gratis', 'harga', 'mahal'], reply: '**SUSI 100% gratis** untuk komunitas maupun talenta.\n\n• Komunitas dapat solusi tanpa biaya\n• Talenta dapat portofolio + poin reputasi\n\nPlatform didukung SMKN 4 Bandung sebagai proyek sosial-edukasi.' },
  { keys: ['bantuan', 'help', 'tolong', 'support'], reply: 'Saya siap bantu! Beberapa hal yang bisa saya jawab:\n\n• Cara kerja SUSI\n• Status proyek & verifikasi\n• Reputasi talenta\n• Mading komunitas & Map\n\nAtau ketik pertanyaan spesifik Anda 😊' },
];

export const QUICK_ASK = [
  'Bagaimana cara kerja SUSI?',
  'Apa itu verifikasi dua arah?',
  'Cara gabung sebagai talenta?',
  'Apakah SUSI gratis?',
];

export function findReply(text) {
  const q = (text || '').toLowerCase();
  for (const item of KB) {
    if (item.keys.some((k) => q.includes(k))) return item.reply;
  }
  return 'Hmm, saya belum paham pertanyaan itu 🤔\n\nCoba tanyakan soal:\n• Cara kerja SUSI\n• Status proyek & verifikasi\n• Reputasi talenta\n• Mading komunitas & Map\n\nAtau hubungi tim via **WhatsApp** di halaman Tentang Kami untuk bantuan manusia.';
}