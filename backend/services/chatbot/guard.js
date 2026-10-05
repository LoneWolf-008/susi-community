// Pra-pemeriksaan pesan pengguna sebelum disimpan & diproses (T12.2.1):
//  - PII (email, nomor telepon, deretan angka panjang seperti NIK/rekening) disamarkan, sehingga
//    tidak tersimpan di chat_messages/ask_logs dan tidak terkirim ke LLM;
//  - upaya injeksi prompt dan kata kasar dideteksi agar pipeline bisa menolak tanpa memanggil LLM.
import { normalizeText, queryTerms } from './text.js';

export const MASK_EMAIL = '[email disamarkan]';
export const MASK_NUMBER = '[nomor disamarkan]';

const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
// Nomor Indonesia: +62 / 62 / 0 lalu 8xx, total 10–14 digit; boleh dipisah spasi, titik, atau strip.
const PHONE_RE = /(?<![\p{N}])(?:\+?62|0)[\s.-]?8(?:[\s.-]?\p{N}){7,11}(?![\p{N}])/gu;
// Deretan ≥ 10 digit (NIK, rekening). Titik tidak dihitung pemisah agar nominal "Rp 1.500.000.000" aman.
const LONG_NUMBER_RE = /(?<![\p{N}])\p{N}(?:[\s-]?\p{N}){9,}(?![\p{N}])/gu;

/** Teks tanpa penanda samaran, untuk retrieval & intent ("[email disamarkan]" bukan kata kunci topik). */
export const withoutMasks = (text) => String(text ?? '')
  .split(MASK_EMAIL).join(' ')
  .split(MASK_NUMBER).join(' ');

/** Samarkan PII; `masked` = ada yang disamarkan. */
export function maskPii(text) {
  let masked = false;
  const replace = (re, token) => (value) => value.replace(re, () => {
    masked = true;
    return token;
  });
  const out = [replace(EMAIL_RE, MASK_EMAIL), replace(PHONE_RE, MASK_NUMBER), replace(LONG_NUMBER_RE, MASK_NUMBER)]
    .reduce((value, fn) => fn(value), String(text ?? ''));
  return { text: out, masked };
}

// Karakter kontrol (kecuali tab & baris baru) tidak pernah dibutuhkan dalam pesan chat.
export const stripControlChars = (text) => String(text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

// Dicek pada teks huruf kecil apa adanya (tanda baca dipertahankan untuk pola tag).
const INJECTION_PATTERNS = [
  /\b(abaikan|lupakan|acuhkan|hiraukan|langgar|timpa|jangan ikuti)\b[^.?!\n]{0,40}\b(instruksi|perintah|aturan|arahan|prompt|sistem)\b/,
  /\b(ignore|disregard|forget|override|bypass)\b[^.?!\n]{0,40}\b(instructions?|rules?|prompts?|system|guidelines?)\b/,
  /\b(tampilkan|tunjukkan|perlihatkan|bocorkan|ungkapkan|ungkap|sebutkan|tuliskan|salin|cetak|print|show|reveal|repeat|ulangi)\b[^.?!\n]{0,40}\b(prompt|instruksi (awal|sistem|kamu|rahasia|internal)|instruksimu|aturan (internal|rahasia|sistem)|instructions?)\b/,
  /\b(system prompt|prompt sistem|developer mode|mode pengembang|jailbreak|do anything now)\b/,
  /\b(kamu|anda)\s+(sekarang|mulai sekarang)\s+(adalah|menjadi|jadi)\b/,
  /\bsekarang\s+(kamu|anda)\s+(adalah|menjadi|jadi)\b/,
  /\b(you are now|act as|pretend to be|roleplay as|berpura[- ]?pura|bertindaklah sebagai|berperanlah sebagai)\b/,
  /<\/?\s*(system|kb|entry|user_data|instructions?)\b/,
  /\[\s*(system|inst)\s*\]/,
];

export const detectInjection = (text) => {
  const lower = String(text ?? '').toLowerCase();
  return INJECTION_PATTERNS.some((re) => re.test(lower));
};

// Hanya kata yang hampir selalu bermakna kasar; kata bermakna ganda (mis. nama hewan) sengaja tidak
// dimasukkan agar "komunitas pecinta anjing" tidak dianggap kasar.
const PROFANITY = new Set([
  'bangsat', 'bajingan', 'keparat', 'brengsek', 'kampret', 'kontol', 'memek', 'ngentot', 'entot', 'jancok',
  'jancuk', 'goblok', 'goblog', 'tolol', 'taik', 'tai', 'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'bastard',
  'motherfucker', 'wtf',
]);

const words = (text) => normalizeText(text).split(' ').filter(Boolean);

export const detectProfanity = (text) => words(text).some((w) => PROFANITY.has(w));

/**
 * @returns {{ text: string, piiMasked: boolean, injection: boolean, profanity: boolean, abusiveOnly: boolean }}
 *   `text` = pesan yang aman disimpan & diproses; `abusiveOnly` = hanya berisi kata kasar/sapaan tanpa pertanyaan.
 */
export function precheck(message) {
  const clean = stripControlChars(message).trim();
  const { text, masked } = maskPii(clean);
  const profanity = detectProfanity(text);
  const withoutProfanity = words(text).filter((w) => !PROFANITY.has(w)).join(' ');
  return {
    text,
    piiMasked: masked,
    injection: detectInjection(clean),
    profanity,
    abusiveOnly: profanity && queryTerms(withoutProfanity).length === 0,
  };
}
