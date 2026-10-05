// Retrieval basis pengetahuan dengan MySQL FULLTEXT (keputusan desain #4, tanpa embedding).
// NATURAL LANGUAGE MODE dipakai karena BOOLEAN MODE galat pada masukan seperti "(baru" (pelajaran fase 2).

const ALL_AUDIENCES = ['all', 'public', 'requester', 'talent', 'liaison'];

/**
 * Audiens KB yang boleh dilihat: anonim → umum & publik; pengguna → umum & perannya; admin → semua.
 * `public` = informasi untuk pengunjung yang belum masuk (mis. cara mendaftar).
 */
export function audiencesFor(user) {
  if (!user) return ['all', 'public'];
  if (user.role === 'admin') return ALL_AUDIENCES;
  return ['all', user.role];
}

/** Normalisasi dasar untuk kueri FULLTEXT: huruf kecil, tanpa tanda baca/operator. */
export function normalizeQuery(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kata tanya & kata fungsi umum: tidak membedakan topik, tetapi bisa menaikkan entri yang kebetulan
// memuatnya (mis. "cara" di entri "cara kerja"). Daftar lengkap & sinonim slang menyusul di T12.
const STOPWORDS = new Set([
  'apa', 'apakah', 'bagaimana', 'gimana', 'gmn', 'cara', 'caranya', 'bisa', 'bisakah', 'boleh', 'mau', 'ingin',
  'saya', 'aku', 'gue', 'gw', 'kamu', 'anda', 'kita', 'kami', 'yang', 'dan', 'atau', 'di', 'ke', 'dari', 'untuk',
  'buat', 'dengan', 'ini', 'itu', 'ada', 'jadi', 'kalau', 'kalo', 'tolong', 'dong', 'sih', 'ya', 'kah', 'nya',
  'tentang', 'soal', 'gak', 'nggak', 'tidak', 'sudah', 'udah', 'belum', 'lagi', 'juga', 'aja', 'saja',
]);
const tokens = (text) => normalizeQuery(text).split(' ').filter(Boolean);
const contentTokens = (text) => [...new Set(tokens(text).filter((t) => !STOPWORDS.has(t)))];

/**
 * Skor leksikal deterministik. Setiap kata isi pertanyaan bernilai 3 bila ada di judul, 2 di kata kunci,
 * 1 di isi (diambil yang tertinggi), dikali bobot kelangkaan log(1 + N/df) atas himpunan kandidat:
 * kata yang jarang (mis. "daftar") lebih menentukan daripada kata yang ada di banyak entri ("talenta").
 * Skor FULLTEXT hanya pemecah seri: pada DB yang baru di-seed, InnoDB bisa memberi skor 0 untuk semua
 * entri (lihat syncKbIndex), sehingga urutan tidak boleh bergantung padanya saja.
 */
export function rankEntries(text, entries) {
  const words = contentTokens(text);
  const docs = entries.map((entry) => {
    const fields = { title: new Set(tokens(entry.title)), keywords: new Set(tokens(entry.keywords)), reply: new Set(tokens(entry.reply)) };
    return { entry, fields, all: new Set([...fields.title, ...fields.keywords, ...fields.reply]) };
  });
  const idf = Object.fromEntries(words.map((w) => {
    const df = docs.filter((d) => d.all.has(w)).length;
    return [w, Math.log(1 + docs.length / Math.max(1, df))];
  }));
  return docs
    .map(({ entry, fields }) => {
      const lexical = words.reduce((sum, w) => {
        const weight = fields.title.has(w) ? 3 : fields.keywords.has(w) ? 2 : fields.reply.has(w) ? 1 : 0;
        return sum + weight * idf[w];
      }, 0);
      return { ...entry, score: Number(entry.score) || 0, lexical: Math.round(lexical * 10000) / 10000 };
    })
    .sort((a, b) => b.lexical - a.lexical || b.score - a.score || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
}

/**
 * Kandidat dari FULLTEXT (NATURAL LANGUAGE MODE), lalu diurutkan ulang dengan rankEntries.
 * @returns {Promise<Array<{id:number, title:string|null, category:string|null, keywords:string,
 *   reply:string, audience:string, score:number, lexical:number}>>} terurut dari paling relevan
 */
export async function searchKb(db, text, { audiences, limit = 3 }) {
  const query = normalizeQuery(text);
  if (!query) return [];
  const [rows] = await db.query(
    `SELECT id, title, category, keywords, reply, audience, sort_order,
            MATCH(title, keywords, reply) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
     FROM kb_entries
     WHERE status = 'active' AND audience IN (?)
       AND MATCH(title, keywords, reply) AGAINST (? IN NATURAL LANGUAGE MODE) > 0
     ORDER BY score DESC, sort_order ASC, id ASC
     LIMIT 20`,
    [query, audiences, query],
  );
  return rankEntries(text, rows).slice(0, limit);
}

/**
 * Sinkronkan indeks FULLTEXT kb_entries. InnoDB menghitung relevansi dari statistik indeks; bila indeks
 * dibuat pada tabel kosong lalu semua baris masuk sekaligus (db:reset + seed, tabel test yang baru
 * dikosongkan), SEMUA skor bernilai 0 sampai cache FTS disinkronkan, sehingga urutan retrieval jatuh ke
 * sort_order (ditemukan saat uji live T11). OPTIMIZE TABLE membangun ulang tabel kecil ini beserta
 * indeksnya. Melakukan commit implisit: panggil di luar transaksi, setelah isi KB berubah.
 */
export async function syncKbIndex(db) {
  await db.query('OPTIMIZE TABLE kb_entries');
}

/** Judul tampilan sumber: judul entri, atau kata kunci pertamanya untuk entri lama tanpa judul. */
export const kbTitle = (entry) => entry.title || String(entry.keywords || '').split(',')[0].trim() || `Entri #${entry.id}`;
