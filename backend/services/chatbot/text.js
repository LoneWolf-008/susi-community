// Normalisasi teks Bahasa Indonesia untuk retrieval KB, intent, dan kunci cache:
// huruf kecil, tanpa tanda baca, frasa slang digabung, sinonim/slang → bentuk baku,
// dan sufiks -nya/-ku/-mu dilepas (tanpa stemmer penuh: kata kunci KB memuat variannya sendiri).

const PHRASES = [
  [/\blog in\b/g, 'login'],
  [/\bsign up\b/g, 'signup'],
  [/\bsign in\b/g, 'signin'],
  [/\bagen susi\b/g, 'agensusi'],
  [/\be mail\b/g, 'email'],
  [/\bwhats app\b/g, 'whatsapp'],
  [/\bdi mana\b/g, 'dimana'],
  [/\bterima kasih\b/g, 'terimakasih'],
];

/** Huruf kecil, NFKC, tanpa tanda baca/operator FULLTEXT, spasi tunggal, frasa slang digabung. */
export function normalizeText(text) {
  let out = String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, to] of PHRASES) out = out.replace(re, to);
  return out;
}

// Bentuk baku → varian. Satu kata hanya boleh muncul di satu grup.
// Slang umum (dipakai juga untuk intent, yang perlu membedakan "melamar" dari "lamaran").
const SLANG_GROUPS = {
  tidak: ['gak', 'ga', 'nggak', 'ngga', 'enggak', 'engga', 'gk', 'tdk', 'kagak'],
  sudah: ['udah', 'udh', 'sdh', 'dah'],
  belum: ['blm', 'blom'],
  bagaimana: ['gimana', 'gmn', 'gmna', 'bgmn', 'gmana'],
  yang: ['yg'],
  dengan: ['dgn'],
  untuk: ['utk'],
  karena: ['krn', 'karna'],
  jadi: ['jd'],
  saja: ['aja'],
  bisa: ['bs'],
  tolong: ['tlg'],
  saya: ['sy', 'aku', 'aq', 'gue', 'gw', 'ane'],
  kamu: ['km', 'lu', 'lo', 'elu'],
  kenapa: ['knp', 'mengapa'],
  kapan: ['kpn'],
  dimana: ['dmn'],
  berapa: ['brp'],
  banget: ['bgt'],
  kalau: ['klo', 'kalo'],
  terus: ['trus'],
  terimakasih: ['makasih', 'makasi', 'mksh', 'thx', 'thanks', 'tq'],
  halo: ['hallo', 'helo', 'hai', 'hay', 'hi', 'hello', 'hey', 'hei'],
};

// Sinonim & imbuhan istilah domain SUSI (hanya untuk retrieval & kunci cache).
const DOMAIN_GROUPS = {
  daftar: ['mendaftar', 'mendaftarkan', 'didaftarkan', 'pendaftaran', 'terdaftar', 'daftarkan', 'registrasi', 'register', 'regis', 'signup'],
  masuk: ['login', 'signin'],
  lamar: ['melamar', 'lamaran', 'pelamar', 'dilamar', 'ngelamar', 'apply'],
  ajukan: ['mengajukan', 'pengajuan', 'diajukan', 'ajuan', 'ngajuin', 'ngajukan', 'ajuin'],
  ubah: ['mengubah', 'diubah', 'merubah', 'rubah', 'edit', 'mengedit', 'diedit', 'ganti', 'mengganti', 'diganti'],
  verifikasi: ['memverifikasi', 'diverifikasi', 'terverifikasi', 'verif', 'verify', 'konfirmasi', 'mengonfirmasi', 'dikonfirmasi', 'konfirm'],
  batal: ['membatalkan', 'dibatalkan', 'pembatalan', 'batalkan', 'cancel'],
  mundur: ['mengundurkan', 'pengunduran', 'undur'],
  tarik: ['menarik', 'ditarik', 'penarikan', 'withdraw'],
  pilih: ['memilih', 'dipilih', 'pemilihan', 'terpilih'],
  sepakat: ['kesepakatan', 'menyepakati', 'disepakati', 'sepakati', 'agreement', 'setuju', 'menyetujui', 'disetujui', 'persetujuan'],
  revisi: ['merevisi', 'direvisi', 'perbaikan', 'memperbaiki', 'diperbaiki'],
  moderasi: ['dimoderasi', 'moderator', 'ditinjau', 'peninjauan', 'tinjau'],
  tolak: ['ditolak', 'menolak', 'penolakan'],
  kirim: ['mengirim', 'dikirim', 'pengiriman', 'kirimkan'],
  unggah: ['mengunggah', 'diunggah', 'upload', 'uplod'],
  hubungi: ['menghubungi', 'dihubungi', 'hubungkan', 'menghubungkan', 'dihubungkan', 'sambungkan', 'disambungkan', 'terhubung', 'tersambung'],
  notifikasi: ['notif', 'notification', 'pemberitahuan'],
  biaya: ['bayar', 'membayar', 'dibayar', 'pembayaran', 'bayaran', 'harga', 'tarif', 'ongkos', 'fee', 'duit', 'uang', 'gratis', 'gratisan', 'berbayar', 'mahal', 'murah'],
  proyek: ['project', 'projek', 'projekan', 'proyekan'],
  talenta: ['talent', 'developer', 'programmer', 'programer', 'coder', 'freelancer', 'freelance'],
  komunitas: ['community', 'requester'],
  agensusi: ['agen', 'liaison', 'agent'],
  akun: ['account'],
  reputasi: ['poin', 'point', 'points', 'rep', 'skor', 'score'],
  testimoni: ['testi', 'testimonial', 'review', 'ulasan', 'rating'],
  sengketa: ['dispute', 'konflik', 'perselisihan', 'mediasi'],
  profil: ['profile', 'biodata'],
  keahlian: ['skill', 'skills', 'skil', 'kemampuan', 'keterampilan'],
  peta: ['map', 'maps', 'gmaps'],
  website: ['web', 'situs', 'site'],
  aplikasi: ['app', 'apps', 'apk'],
  whatsapp: ['wa', 'whatsap', 'watsap', 'wasap'],
  keamanan: ['aman', 'privasi', 'privacy', 'security'],
  kontak: ['contact'],
};

const toMap = (groups) => {
  const map = new Map();
  for (const [canon, words] of Object.entries(groups)) {
    for (const w of words) map.set(w, canon);
  }
  return map;
};
const SLANG = toMap(SLANG_GROUPS);
const CANONICAL = new Map([...SLANG, ...toMap(DOMAIN_GROUPS)]);

/** Bentuk baku satu kata (slang & sinonim domain), atau kata itu sendiri. */
export const canonical = (token) => CANONICAL.get(token) ?? token;

/** Bentuk baku slang saja: "gw" → "saya", tetapi "melamar" tetap "melamar". */
export const deslang = (token) => SLANG.get(token) ?? token;

// Kata tanya, kata fungsi, sapaan: tidak membedakan topik (dicek pada bentuk bakunya).
export const STOPWORDS = new Set([
  'apa', 'apakah', 'apaan', 'bagaimana', 'bagaimanakah', 'cara', 'caranya', 'siapa', 'kapan', 'dimana', 'kenapa',
  'berapa', 'bisa', 'bisakah', 'boleh', 'mau', 'ingin', 'pengen', 'pingin', 'harus', 'perlu', 'saya', 'kamu', 'anda',
  'kita', 'kami', 'dia', 'mereka', 'yang', 'dan', 'atau', 'serta', 'tapi', 'tetapi', 'namun', 'di', 'ke', 'dari',
  'untuk', 'buat', 'bikin', 'dengan', 'pada', 'oleh', 'sebagai', 'seperti', 'ini', 'itu', 'tersebut', 'ada', 'adalah',
  'akan', 'agar', 'supaya', 'jadi', 'menjadi', 'kalau', 'jika', 'bila', 'karena', 'tolong', 'mohon', 'dong', 'sih',
  'deh', 'kok', 'nih', 'tuh', 'kan', 'ya', 'yah', 'iya', 'kah', 'nya', 'pun', 'lah', 'tentang', 'soal', 'mengenai',
  'tidak', 'sudah', 'belum', 'lagi', 'juga', 'saja', 'banget', 'sekali', 'sangat', 'lebih', 'paling', 'hal', 'terus',
  'lalu', 'kemudian', 'setelah', 'sebelum', 'pakai', 'pake', 'gunakan', 'menggunakan', 'lewat', 'melalui', 'sama',
  'punya', 'milik', 'gitu', 'begitu', 'gini', 'begini', 'kak', 'kakak', 'min', 'mimin', 'mas', 'mbak', 'bang', 'pak',
  'bu', 'ibu', 'bapak', 'tanya', 'nanya', 'bertanya', 'tanyain',
]);

const SUFFIXES = ['nya', 'ku', 'mu'];

/** Lepas satu sufiks kepemilikan bila sisanya cukup panjang (proyeknya → proyek, akunku → akun). */
export function stripSuffix(token) {
  for (const s of SUFFIXES) {
    if (token.length - s.length >= 4 && token.endsWith(s)) return token.slice(0, -s.length);
  }
  return token;
}

export const isStopword = (token) => STOPWORDS.has(token) || STOPWORDS.has(canonical(token));

export const tokenize = (text) => normalizeText(text).split(' ').filter(Boolean);

/** Varian satu kata: dirinya, bentuk baku, dan bentuk tanpa sufiks (beserta bentuk bakunya). */
export function variantsOf(token) {
  const stem = stripSuffix(token);
  return [...new Set([token, canonical(token), stem, canonical(stem)])];
}

/** Himpunan semua varian kata dalam satu teks (untuk kolom entri KB). */
export function fieldTokens(text) {
  const out = new Set();
  for (const t of tokenize(text)) for (const v of variantsOf(t)) out.add(v);
  return out;
}

/**
 * Kata isi pertanyaan sebagai grup varian, tanpa kata tanya/fungsi.
 * Satu kata dianggap cocok bila salah satu variannya ada di entri.
 * @returns {{ word: string, variants: string[] }[]}
 */
export function queryTerms(text) {
  const seen = new Set();
  const terms = [];
  for (const t of tokenize(text)) {
    const variants = variantsOf(t).filter((v) => v.length >= 2 && !isStopword(v));
    if (variants.length === 0 || isStopword(t)) continue;
    const key = [...variants].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push({ word: t, variants });
  }
  return terms;
}

/** Teks kueri FULLTEXT: kata asli + bentuk baku kata isi (agar "project" menemukan entri "proyek"). */
export function expandForSearch(text) {
  const words = tokenize(text);
  const extra = [];
  for (const t of words) {
    for (const v of variantsOf(t)) if (v !== t && !isStopword(v)) extra.push(v);
  }
  return [...new Set([...words, ...extra])].join(' ');
}

/** Teks dalam bentuk baku per kata (kunci cache): "gmn status project gw" → "bagaimana status proyek saya". */
export const canonicalText = (text) => tokenize(text).map(canonical).join(' ');

/** Teks untuk pola intent: slang dibakukan, istilah domain apa adanya ("gw lamaran" → "saya lamaran"). */
export const intentText = (text) => tokenize(text).map(deslang).join(' ');
