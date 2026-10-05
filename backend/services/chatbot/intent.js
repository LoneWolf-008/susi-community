// Intent berbasis kata kunci (T12.2.2), tanpa LLM. Urutan aturan = prioritas:
// escalation_request → status_data → complaint → smalltalk → howto → faq.
// `out_of_scope` diputuskan pipeline setelah retrieval (tidak ada entri KB & tidak ada istilah SUSI).
import { intentText, queryTerms, isStopword, variantsOf, tokenize } from './text.js';

export const INTENTS = ['faq', 'howto', 'status_data', 'complaint', 'escalation_request', 'smalltalk', 'out_of_scope'];

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
]);

export const hasDomainTerms = (text) => tokenize(text).some((t) => variantsOf(t).some((v) => DOMAIN.has(v)));
