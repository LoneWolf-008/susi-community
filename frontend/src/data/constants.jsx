export const AUTH_ROLES = [
  { num: '01', id: 'requester', label: 'Komunitas', desc: 'Contoh: Pengurus RT/RW, PKK, UMKM, karang taruna, atau yang lainnya', field: 'Nama Komunitas / Usaha', ph: 'Mis. PKK RW 03, Warung Bu Ani', fallback: 'Pengurus PKK RW 03' },
  { num: '02', id: 'talent', label: 'Talenta', desc: 'Mahasiswa, fresh graduate, career switcher, atau engineer yang ingin mendapatkan pengalaman proyek nyata.', field: 'Keahlian Utama', ph: 'Mis. React, Node.js, UI/UX', fallback: 'Derien Adelio' },
  { num: '03', id: 'admin', label: 'Admin', desc: 'Pengelola platform: moderasi, penanganan sengketa, dan keberlanjutan sistem.', field: 'Kode Akses', ph: 'Kode internal tim SUSI', fallback: 'Admin SUSI' },
];

export const FLOW_STEPS = [
  { num: '01', title: 'Komunitas Ceritakan Masalahnya', sub: 'Pihak komunitas atau UMKM cukup mengisi formulir singkat menggunakan bahasa sehari-hari melalui website!', tag: 'START' },
  { num: '02', title: 'Pendataan Langsung di Lapangan', sub: 'Kalau komunitas belum familiar dengan website, tim AgenSUSI siap datang langsung ke lokasi untuk membantu mencatatkan masalahmu ke dalam sistem.', tag: '02' },
  { num: '03', title: 'Kebutuhan tampil di Katalog', sub: 'Masalah operasional yang sudah dicatat akan langsung muncul di katalog proyek terbuka agar bisa dilihat oleh para talenta IT.', tag: '03' },
  { num: '04', title: 'Talenta IT Mengajukan Diri', sub: 'Para developer muda atau mahasiswa IT yang tertarik akan memilih proyek yang sesuai dengan keahlian mereka dan mengirimkan lamaran.', tag: '04' },
  { num: '05', title: 'Komunitas Pilih Talenta yang Cocok', sub: 'Pihak komunitas bisa melihat rekam jejak serta portofolio para pelamar, lalu memilih satu talenta yang paling pas untuk menggarap proyeknya.', tag: '05' },
  { num: '06', title: 'Sepakati Batasan & Target Kerja', sub: 'Kedua pihak sama-sama menentukan apa saja yang bakal dibuat dan sepakat mengenai kriteria seperti apa proyek tersebut dianggap "selesai".', tag: '06' },
  { num: '07', title: 'Pengerjaan Dimulai!', sub: 'Kalau sudah saling setuju, proyek akan langsung digarap!', tag: '07'},
  { num: '08', title: 'Proyek selesai? verifikasi dulu!', sub: 'Setelah proyek rampung, Talenta menandai selesai dan komunitas memberikan konfirmasi serta ulasan.', tag: 'END', success: true },
];

export const SEED_ACCOUNTS = [
  { email: 'komunitas@susi.id', role: 'requester', name: 'Pengurus PKK RW 03' },
  { email: 'talenta@susi.id', role: 'talent', name: 'Derien Adelio' },
  { email: 'agen@susi.id', role: 'agensusi', name: 'Hasby Wira Al Muflih' },
];

export function loadAccounts() {
  try {
    const stored = JSON.parse(localStorage.getItem('susi_accounts') || '[]');
    return [...SEED_ACCOUNTS, ...stored];
  } catch (e) {
    return SEED_ACCOUNTS;
  }
}
