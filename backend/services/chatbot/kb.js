// Retrieval basis pengetahuan dengan MySQL FULLTEXT (keputusan desain #4, tanpa embedding).
// NATURAL LANGUAGE MODE dipakai karena BOOLEAN MODE galat pada masukan seperti "(baru" (pelajaran fase 2).
// FULLTEXT hanya menyaring kandidat; urutan & ambang relevansi dihitung ulang di sini (rankEntries).
import { normalizeText, queryTerms, fieldTokens, expandForSearch } from './text.js';

const ALL_AUDIENCES = ['all', 'public', 'requester', 'talent', 'liaison'];

// Ambang cakupan (dikalibrasi dengan kb.json di tests/unit/kb.test.js):
//  - MIN_COVERAGE: entri teratas harus mencapai ini agar pertanyaan dianggap terjawab KB;
//  - CONTEXT_COVERAGE: entri berikutnya cukup mencakup sebagian pertanyaan untuk ikut jadi konteks
//    (pertanyaan dua topik: "apa itu AgenSUSI dan berapa biayanya?");
//  - HIGH_COVERAGE: cukup yakin untuk menjawab langsung dari KB tanpa memanggil LLM (jalur murah).
export const MIN_COVERAGE = 0.5;
export const CONTEXT_COVERAGE = 0.25;
export const HIGH_COVERAGE = 0.8;
const CANDIDATE_LIMIT = 30;

/**
 * Audiens KB yang boleh dilihat: anonim → umum & publik; pengguna → umum & perannya; admin → semua.
 * `public` = informasi untuk pengunjung yang belum masuk (mis. cara memulai).
 */
export function audiencesFor(user) {
  if (!user) return ['all', 'public'];
  if (user.role === 'admin') return ALL_AUDIENCES;
  return ['all', user.role];
}

/** Normalisasi dasar kueri (nama lama, dipertahankan untuk pemanggil T11). */
export const normalizeQuery = normalizeText;

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * Skor leksikal deterministik atas kandidat. Setiap kata isi pertanyaan (beserta sinonim/bentuk
 * bakunya) bernilai 3 bila ada di judul, 2 di kata kunci, 1 di isi, dikali bobot kelangkaan
 * log(1 + N/df) atas himpunan kandidat: kata yang jarang (mis. "daftar") lebih menentukan daripada
 * kata yang ada di banyak entri ("talenta"). Kata yang tidak ada di kandidat mana pun mendapat bobot
 * maksimal, sehingga pertanyaan di luar KB tidak "nyangkut" ke entri yang kebetulan memuat satu kata.
 *
 * `coverage` (0–1) = porsi bobot kata pertanyaan yang tercakup entri: penuh bila ada di judul/kata
 * kunci, setengah bila hanya di isi. Skor FULLTEXT hanya pemecah seri: pada DB yang baru di-seed,
 * InnoDB bisa memberi skor 0 untuk semua entri (lihat syncKbIndex).
 */
export function rankEntries(text, entries) {
  const terms = queryTerms(text);
  const docs = entries.map((entry) => ({
    entry,
    title: fieldTokens(entry.title),
    keywords: fieldTokens(entry.keywords),
    reply: fieldTokens(entry.reply),
  }));
  const has = (set, term) => term.variants.some((v) => set.has(v));
  const idf = terms.map((term) => {
    const df = docs.filter((d) => has(d.title, term) || has(d.keywords, term) || has(d.reply, term)).length;
    return Math.log(1 + docs.length / Math.max(1, df));
  });
  const totalIdf = idf.reduce((sum, w) => sum + w, 0);

  return docs
    .map(({ entry, title, keywords, reply }) => {
      let lexical = 0;
      let covered = 0;
      terms.forEach((term, i) => {
        if (has(title, term)) {
          lexical += 3 * idf[i];
          covered += idf[i];
        } else if (has(keywords, term)) {
          lexical += 2 * idf[i];
          covered += idf[i];
        } else if (has(reply, term)) {
          lexical += idf[i];
          covered += 0.5 * idf[i];
        }
      });
      return {
        ...entry,
        score: Number(entry.score) || 0,
        lexical: round4(lexical),
        coverage: totalIdf > 0 ? round4(covered / totalIdf) : 0,
      };
    })
    .sort((a, b) => b.lexical - a.lexical || b.score - a.score || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
}

/**
 * Entri aktif yang relevan untuk `text` dan boleh dilihat `audiences`, paling relevan dulu.
 * Kandidat dari FULLTEXT (NATURAL LANGUAGE MODE, kueri diperluas dengan bentuk baku kata),
 * lalu diurutkan ulang dengan rankEntries. Kosong bila entri teratas di bawah MIN_COVERAGE;
 * selain itu entri dengan cakupan ≥ CONTEXT_COVERAGE, paling banyak `limit`.
 * @returns {Promise<Array<{id:number, slug:string|null, title:string|null, category:string|null, keywords:string,
 *   reply:string, audience:string, score:number, lexical:number, coverage:number}>>}
 */
export async function searchKb(db, text, { audiences, limit = 3 }) {
  const query = expandForSearch(text);
  if (!query) return [];
  const [rows] = await db.query(
    `SELECT id, slug, title, category, keywords, reply, audience, sort_order,
            MATCH(title, keywords, reply) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
     FROM kb_entries
     WHERE status = 'active' AND audience IN (?)
       AND MATCH(title, keywords, reply) AGAINST (? IN NATURAL LANGUAGE MODE) > 0
     ORDER BY score DESC, sort_order ASC, id ASC
     LIMIT ${CANDIDATE_LIMIT}`,
    [query, audiences, query],
  );
  return selectRelevant(rankEntries(text, rows), limit);
}

/** Terapkan ambang ke hasil rankEntries (dipisah agar bisa diuji tanpa DB). */
export function selectRelevant(ranked, limit = 3) {
  if (!ranked[0] || ranked[0].coverage < MIN_COVERAGE) return [];
  return ranked.filter((e) => e.coverage >= CONTEXT_COVERAGE).slice(0, limit);
}

/** Cukup yakin menjawab langsung dengan entri teratas (tanpa LLM)? */
export const isConfident = (entries) => entries.length > 0 && entries[0].coverage >= HIGH_COVERAGE;

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
