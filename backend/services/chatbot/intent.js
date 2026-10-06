// Intent berbasis kata kunci (T12.2.2), tanpa LLM. Urutan aturan = prioritas:
// escalation_request → intent personal (R3) → status_data → complaint → smalltalk → howto → faq.
// `out_of_scope` diputuskan pipeline setelah retrieval (tidak ada entri KB & tidak ada istilah SUSI).
import { intentText, queryTerms, isStopword, variantsOf, tokenize } from './text.js';

// R3: jawaban pribadi berbasis profil & rekomendasi (services/chatbot/personal.js).
export const PERSONAL_INTENTS = ['rekomendasi_proyek', 'rekomendasi_talenta', 'karir', 'sertifikasi'];
export const INTENTS = ['faq', 'howto', 'status_data', 'complaint', 'escalation_request', 'smalltalk', 'out_of_scope', ...PERSONAL_INTENTS];

// ===== Intent personal (R3) =====
const MATCH_WORD = '(cocok|sesuai|pas|rekomendasi|rekomendasikan|direkomendasikan|sarankan|saranin|disarankan|terbaik)';
const TALENT_WORD = '(talenta|talent|developer|programmer|freelancer|pelamar|kandidat)';
const WORK_WORD = '(proyek|projek|project|kebutuhan|kerjaan|pekerjaan|lowongan|job|gawean)';
const PERSONAL_RES = {
  // "talenta mana yang cocok", "rekomendasi talenta", "siapa yang cocok mengerjakan kebutuhan saya"
  rekomendasi_talenta: [
    new RegExp(`\\b${TALENT_WORD}\\b(?:\\s+\\S+){0,4}?\\s+${MATCH_WORD}\\b`),
    new RegExp(`\\b${MATCH_WORD}\\b(?:\\s+\\S+){0,3}?\\s+${TALENT_WORD}\\b`),
    /\bsiapa\b(?:\s+\S+){0,3}?\s+(cocok|sesuai|pas)\b/,
  ],
  // "proyek apa yang cocok buat aku", "rekomendasi proyek", "kebutuhan yang sesuai skill saya"
  rekomendasi_proyek: [
    new RegExp(`\\b${WORK_WORD}\\b(?:\\s+\\S+){0,4}?\\s+${MATCH_WORD}\\b`),
    new RegExp(`\\b${MATCH_WORD}\\b(?:\\s+\\S+){0,3}?\\s+${WORK_WORD}\\b`),
    // "kenapa proyek <judul kebutuhan> cocok buat saya": judul bisa jauh lebih dari 4 kata.
    /\b(kenapa|mengapa|alasan)\b.*\b(proyek|projek|project|kebutuhan)\b.*\b(cocok|sesuai|pas)\s+(buat|untuk|bagi|dengan)\s+(saya|aku|gue|gw|gua)\b/,
  ],
  // "skill apa yang perlu saya pelajari", "karier saya", "keahlian yang paling dicari"
  karir: [
    /\b(karier|karir|career|kariernya|karirnya|pengembangan diri|jenjang karier|jenjang karir)\b/,
    /\b(skill|skil|keahlian|kemampuan)\s+(apa|yang)\b(?:\s+\S+){0,4}?\s+(pelajari|dipelajari|belajar|tingkatkan|ditingkatkan|kembangkan|dicari|dibutuhkan|diminta|laku|kurang)\b/,
    /\b(belajar|pelajari|upgrade|tingkatkan)\s+(skill|keahlian|kemampuan)\b/,
    // harapan kerja/penghasilan → dijawab tanpa janji (lihat NO_PROMISE di personal.js)
    /\b(kerja tetap|pekerjaan tetap|jaminan kerja|dapat kerja|dapat pekerjaan|lapangan kerja|penyaluran kerja|disalurkan kerja)\b/,
  ],
  sertifikasi: [/\b(sertifikasi|sertifikat|tersertifikasi|certified|certificate|certification)\b/],
};
// "Bagaimana cara …" tentang fitur → panduan umum KB, bukan jawaban pribadi.
const FEATURE_HOWTO_RE = /\bcara\b/;
// Mengecek keaslian sertifikat orang lain → panduan verifikasi publik, bukan kelayakan sertifikasi penanya.
const CERT_CHECK_RE = /\b(asli|palsu|keaslian|valid|cek|mengecek|ngecek|periksa|verifikasi|memverifikasi)\b/;

// Urutan cek: "talenta yang cocok untuk kebutuhan saya" juga memuat kata kebutuhan + cocok.
const PERSONAL_ORDER = ['rekomendasi_talenta', 'rekomendasi_proyek', 'karir', 'sertifikasi'];
// "skill apa yang perlu saya pelajari supaya lebih banyak proyek cocok" memuat proyek + cocok, tetapi
// yang ditanyakan keahlian: pola skill-gap karier dicek sebelum rekomendasi proyek.
const SKILL_GAP_RES = PERSONAL_RES.karir.slice(1, 3);

/** Intent personal yang diminta, atau null. */
export function personalIntent(text) {
  const t = intentText(text);
  const certificate = PERSONAL_RES.sertifikasi.some((re) => re.test(t));
  if (FEATURE_HOWTO_RE.test(t) && !certificate) return null;
  if (certificate && CERT_CHECK_RE.test(t)) return null;
  if (PERSONAL_RES.rekomendasi_talenta.some((re) => re.test(t))) return 'rekomendasi_talenta';
  if (SKILL_GAP_RES.some((re) => re.test(t))) return 'karir';
  return PERSONAL_ORDER.find((intent) => PERSONAL_RES[intent].some((re) => re.test(t))) ?? null;
}

// ===== Permintaan bicara dengan manusia =====
const AGENT = '(agensusi|agen|liaison|admin|cs|operator|manusia|orang|petugas|staf|staff|tim)';
const CONTACT = '(hubungi|hubungkan|menghubungi|menghubungkan|dihubungkan|sambungkan|disambungkan|kontak|panggil|panggilkan|bicara|berbicara|ngobrol|ngomong|chat|telepon|telpon|dilayani|minta tolong|minta bantuan|butuh bantuan|perlu bantuan)';
const ESCALATION_RES = [
  new RegExp(`\\b${CONTACT}\\b(?:\\s+\\S+){0,3}?\\s+${AGENT}\\b`),
  /\b(eskalasi|bukan bot|orang asli|manusia asli|orang beneran|customer service|live chat|agen manusia)\b/,
];

// ===== Data pribadi ("status proyek saya") =====
const TOPIC = '(proyek|projek|project|lamaran|kebutuhan|pengajuan|notifikasi|notif|poin|reputasi|level|status|progres|progress)';
const STATUS_DATA_RES = [
  new RegExp(`\\b${TOPIC}\\s+(milik\\s+|punya\\s+)?saya\\b`),
  /\b(proyek|projek|lamaran|kebutuhan|pengajuan|notifikasi|notif|poin|reputasi|level)ku\b/,
  /\bsaya\s+(punya\s+)?(berapa\s+)?(poin|reputasi|level|notifikasi|notif)\b/,
];
// "kebutuhan saya adalah website…" = sedang menjelaskan kebutuhan, bukan menanyakan datanya.
const DESCRIBING_RE = /\b(adalah|yaitu|yakni|berupa)\b/;
const NEED_STATUS_CUE_RE = /\b(status|progres|progress|sudah|belum|tayang|ditolak|disetujui|diterima|moderasi|dimoderasi|bagaimana|kok|kenapa|masih|apakah|cek|lihat|kabar|muncul|tampil)\b/;
const TOPIC_RES = {
  projects: /\b(proyek|projek|project|proyekku|projekku)\b/,
  applications: /\b(lamaran|lamaranku)\b/,
  needs: /\b(kebutuhan|kebutuhanku|pengajuan|pengajuanku)\b/,
  notifications: /\b(notifikasi|notif|notifikasiku|notifku)\b/,
  reputation: /\b(poin|reputasi|level|poinku|reputasiku|levelku)\b/,
};

/** Topik data pribadi yang ditanyakan, `[]` = ringkasan sesuai peran, `null` = bukan intent data pribadi. */
export function dataTopics(text) {
  const t = intentText(text);
  if (DESCRIBING_RE.test(t) || !STATUS_DATA_RES.some((re) => re.test(t))) return null;
  const topics = Object.keys(TOPIC_RES).filter((topic) => TOPIC_RES[topic].test(t));
  if (topics.length === 1 && topics[0] === 'needs' && !NEED_STATUS_CUE_RE.test(t)) return null;
  return topics;
}

// ===== Keluhan / sentimen negatif (sinyal eskalasi T13) =====
const COMPLAINT_RE = /\b(kecewa|mengecewakan|kesal|kesel|marah|sebel|sebal|parah|payah|jelek|buruk|lambat|lelet|lemot|ribet|komplain|keluhan|mengeluh|laporkan|melaporkan|penipuan|penipu|tipu|menipu|ditipu|scam|rugi|dirugikan|kabur|ghosting|menghilang|error|eror|rusak|bug|gagal|zonk|tidak puas|tidak dibalas|tidak membalas|tidak ada kabar|tidak becus)\b/;

// ===== Basa-basi =====
const SMALLTALK = {
  thanks: ['terimakasih', 'nuhun', 'suwun'],
  bye: ['bye', 'dadah', 'daah', 'babay', 'jumpa', 'sampai'],
  howareyou: ['kabar'],
  greeting: ['halo', 'pagi', 'siang', 'sore', 'malam', 'selamat', 'assalamualaikum', 'assalamu', 'alaikum', 'salam', 'permisi', 'hola'],
  ack: ['oke', 'ok', 'okay', 'okey', 'okee', 'sip', 'siap', 'mantap', 'mantab', 'keren', 'bagus', 'baik', 'oh', 'oalah', 'wah', 'hehe', 'haha', 'wkwk', 'wkwkwk', 'noted', 'paham', 'mengerti', 'ngerti'],
};
const SMALLTALK_KIND = new Map(Object.entries(SMALLTALK).flatMap(([kind, words]) => words.map((w) => [w, kind])));
const SMALLTALK_ORDER = ['thanks', 'bye', 'howareyou', 'greeting', 'ack'];

/** Jenis basa-basi bila pesan hanya berisi sapaan/terima kasih/dll (≤ 6 kata), selain itu null. */
export function smalltalkKind(text) {
  const tokens = intentText(text).split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) return null;
  const kinds = new Set();
  for (const t of tokens) {
    const kind = SMALLTALK_KIND.get(t);
    if (kind) kinds.add(kind);
    else if (!isStopword(t)) return null;
  }
  return SMALLTALK_ORDER.find((k) => kinds.has(k)) ?? null;
}

const HOWTO_RE = /\b(cara|caranya|bagaimana|langkah|tutorial|prosedur|dimana|letak|menu|tombol)\b/;

/**
 * @returns {{ intent: string, topics: string[], negative: boolean, smalltalk: string|null }}
 *   `negative` = ada nada keluhan (dipakai skor eskalasi T13) walau intent utamanya lain.
 */
export function classifyIntent(text) {
  const t = intentText(text);
  const negative = COMPLAINT_RE.test(t);
  const result = (intent, extra = {}) => ({ intent, topics: [], negative, smalltalk: null, ...extra });

  if (ESCALATION_RES.some((re) => re.test(t))) return result('escalation_request');
  const personal = personalIntent(text);
  if (personal) return result(personal);
  const topics = dataTopics(text);
  if (topics) return result('status_data', { topics });
  if (negative) return result('complaint');
  const kind = smalltalkKind(text);
  if (kind) return result('smalltalk', { smalltalk: kind });
  if (HOWTO_RE.test(t)) return result('howto');
  return result('faq');
}

// ===== Lanjutan percakapan & cakupan topik =====
const FOLLOW_UP_RE = /\b(terus|lalu|kalau|itu|tersebut|maksudnya|maksud|contohnya|contoh|selain|tadi|lagi|juga|bagaimana dengan)\b/;

/** Pesan pendek yang bergantung pada giliran sebelumnya ("terus apa lagi?", "kalau talenta?"). */
export function isFollowUp(text) {
  const terms = queryTerms(text);
  if (terms.length === 0) return true;
  return terms.length === 1 && FOLLOW_UP_RE.test(intentText(text));
}

// Istilah yang menandakan pertanyaan masih seputar SUSI (bentuk baku dari text.js).
const DOMAIN = new Set([
  'susi', 'komunitas', 'talenta', 'proyek', 'kebutuhan', 'ajukan', 'lamar', 'daftar', 'akun', 'masuk', 'verifikasi',
  'reputasi', 'level', 'agensusi', 'admin', 'mading', 'diskusi', 'peta', 'notifikasi', 'biaya', 'testimoni',
  'sengketa', 'profil', 'keahlian', 'umkm', 'website', 'aplikasi', 'data', 'kontak', 'whatsapp', 'portofolio',
  'relawan', 'kunjungan', 'moderasi', 'katalog', 'revisi', 'mundur', 'batal', 'tarik', 'status', 'dasbor',
  'dashboard', 'fitur', 'chatbot', 'bot', 'asisten', 'sepakat', 'scope', 'lingkup', 'selesai', 'hasil', 'unggah',
  'kirim', 'pilih', 'keamanan', 'password', 'sandi', 'lokasi', 'iuran', 'pencatatan', 'promosi', 'jadwal',
  'laporan', 'rekap', 'pengaturan', 'ditangguhkan', 'tayang', 'masalah', 'bantuan', 'bantu', 'ubah', 'email',
  'tolak', 'hubungi', 'pelamar',
  // Pemandu & CS: komunitas warga, UMKM, dan masalah sehari-harinya juga dijawab (saran umum + cara SUSI
  // membantu), bukan ditolak sebagai di luar topik.
  'warga', 'rt', 'rw', 'desa', 'kelurahan', 'kampung', 'karang', 'taruna', 'pkk', 'posyandu', 'masjid', 'dkm',
  'remaja', 'pemuda', 'paguyuban', 'arisan', 'koperasi', 'kas', 'keuangan', 'anggota', 'pengurus', 'organisasi',
  'kegiatan', 'rapat', 'usaha', 'bisnis', 'toko', 'warung', 'jualan', 'penjualan', 'pelanggan', 'produk', 'pesanan',
  'stok', 'gudang', 'pembukuan', 'digital', 'online', 'internet', 'sosmed', 'instagram', 'facebook', 'tiktok',
  'pemasaran', 'marketing', 'desain', 'logo', 'poster', 'absensi', 'inventaris', 'donasi', 'sumbangan', 'spreadsheet',
  'excel', 'komputer', 'teknologi', 'programmer', 'developer', 'sertifikat', 'sertifikasi', 'rekomendasi', 'undang',
  'login', 'chat', 'cs', 'keluhan', 'komplain', 'kendala',
  // Pengerjaan proyek & pengalaman talenta.
  'kerja', 'kerjakan', 'pekerjaan', 'sanggup', 'diterima', 'tugas', 'deadline', 'tenggat', 'klien', 'magang',
  'pengalaman', 'mahasiswa', 'cv', 'freelance', 'jasa',
]);

export const hasDomainTerms = (text) => tokenize(text).some((t) => variantsOf(t).some((v) => DOMAIN.has(v)));
