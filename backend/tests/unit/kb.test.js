import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rankEntries, searchKb, selectRelevant, isConfident, normalizeQuery, audiencesFor, MIN_COVERAGE, HIGH_COVERAGE,
} from '../../services/chatbot/kb.js';
import { queryTerms, fieldTokens } from '../../services/chatbot/text.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { entries } = JSON.parse(fs.readFileSync(path.join(here, '../../db/seeds/kb.json'), 'utf8'));
// Entri kb.json sebagai baris DB dengan skor FULLTEXT 0: keadaan InnoDB setelah db:reset + seed (uji live T11).
const rows = entries.map((e, i) => ({
  id: i + 1, slug: e.slug, title: e.title, keywords: e.keywords.join(', '), reply: e.reply,
  audience: e.audience, sort_order: (i + 1) * 10, score: 0,
}));

/** Tiruan kandidat FULLTEXT: entri yang memuat salah satu kata isi pertanyaan (atau variannya). */
function candidates(question, pool = rows) {
  const terms = queryTerms(question);
  return pool.filter((r) => {
    const all = new Set([...fieldTokens(r.title), ...fieldTokens(r.keywords), ...fieldTokens(r.reply)]);
    return terms.some((t) => t.variants.some((v) => all.has(v)));
  });
}
const relevant = (question, pool) => selectRelevant(rankEntries(question, candidates(question, pool)));
const topSlug = (question) => relevant(question)[0]?.slug ?? null;

describe('Retrieval KB: skor & pemeringkatan ulang (T11–T12)', () => {
  it('regresi T11: "gimana cara daftar jadi talenta?" → entri pendaftaran talenta walau semua skor FULLTEXT 0', () => {
    const ranked = rankEntries('gimana cara daftar jadi talenta?', candidates('gimana cara daftar jadi talenta?'));
    expect(ranked[0].slug).toBe('daftar-sebagai-talenta');
    expect(ranked[0].lexical).toBeGreaterThan(ranked[1].lexical);
  });

  it.each([
    ['cara kerja susi gimana', 'cara-kerja-delapan-langkah'],
    ['berapa biaya pakai susi?', 'biaya'],
    ['apa itu agensusi', 'apa-itu-agensusi'],
    ['gmn cara regis jd talent', 'daftar-sebagai-talenta'],
    ['kenapa kebutuhan saya belum muncul', 'moderasi-kebutuhan'],
    ['talentanya kabur gimana nih', 'talenta-mundur'],
    ['gimana cara melamar proyek', 'cari-dan-lamar-proyek'],
    ['apa itu verifikasi dua arah', 'verifikasi-dua-arah'],
    ['level talenta ada apa aja', 'reputasi-dan-level'],
    ['datanya aman ga?', 'keamanan-data'],
    ['nomor wa susi berapa', 'kontak-susi'],
    ['kalau hasilnya jelek gimana', 'cara-verifikasi-hasil'],
    ['talenta dibayar ga?', 'manfaat-talenta'],
    ['bagaimana cara mengubah kebutuhan', 'tarik-kebutuhan'],
    ['bagaimana cara verifikasi hasil kerja talenta', 'cara-verifikasi-hasil'],
    ['saya gaptek, bisa dibantu?', 'minta-bantuan-agensusi'],
    ['apa bedanya komunitas dan talenta', 'peran-pengguna'],
    ['cara upload hasil', 'kirim-hasil'],
    ['kok saya ga bisa login', 'tidak-bisa-masuk'],
    ['bisa bikin website buat toko saya?', 'contoh-masalah'],
    ['saya ditipu talenta, bagaimana cara lapor sengketa?', 'sengketa'],
    ['mau mengadukan talenta yang bermasalah', 'sengketa'],
    // regresi evaluasi T15: bentuk kata kerja "ditulis" dikenali sebagai "tulis"
    ['bagaimana testimoni ditulis?', 'testimoni'],
  ])('"%s" → %s', (question, slug) => {
    expect(topSlug(question)).toBe(slug);
  });

  it('ambang: pertanyaan di luar KB tidak "nyangkut" ke entri mana pun', () => {
    for (const q of ['siapa presiden indonesia', 'resep nasi goreng', 'apakah bisa bikin game?']) {
      expect(relevant(q)).toEqual([]);
    }
  });

  it('ambang: kata kebetulan di isi entri saja tidak cukup (cakupan < MIN_COVERAGE)', () => {
    const pool = [
      { id: 1, title: 'Biaya', keywords: 'biaya, gratis', reply: 'SUSI tidak memungut biaya dari komunitas di Bandung.', sort_order: 1, score: 0 },
    ];
    // "bandung" hanya ada di isi, "cuaca" & "hari" tidak ada sama sekali → cakupan jauh di bawah ambang.
    const ranked = rankEntries('cuaca bandung hari ini', pool);
    expect(ranked[0].coverage).toBeLessThan(MIN_COVERAGE);
    expect(selectRelevant(ranked)).toEqual([]);
  });

  it('kepercayaan tinggi (jawab langsung dari KB) hanya bila satu entri mencakup seluruh pertanyaan', () => {
    expect(isConfident(relevant('berapa biaya pakai susi?'))).toBe(true);
    expect(relevant('berapa biaya pakai susi?')[0].coverage).toBeGreaterThanOrEqual(HIGH_COVERAGE);
    // Dua topik: entri teratas hanya mencakup sebagian → perlu LLM untuk merangkum.
    const twoTopics = relevant('apa itu agensusi dan berapa biayanya?');
    expect(isConfident(twoTopics)).toBe(false);
    expect(twoTopics.map((e) => e.slug)).toEqual(expect.arrayContaining(['biaya', 'apa-itu-agensusi']));
  });

  it('kata tanya/fungsi diabaikan; tanpa kata isi, cakupan 0 dan urutan jatuh ke sort_order lalu skor FULLTEXT', () => {
    const ranked = rankEntries('gimana caranya dong?', [
      { id: 1, keywords: 'cara kerja', reply: 'x', sort_order: 2, score: 0.2 },
      { id: 2, keywords: 'lain', reply: 'y', sort_order: 1, score: 0.1 },
      { id: 3, keywords: 'lain', reply: 'z', sort_order: 2, score: 0.9 },
    ]);
    expect(ranked.map((e) => [e.id, e.lexical, e.coverage])).toEqual([[2, 0, 0], [3, 0, 0], [1, 0, 0]]);
  });

  it('regresi T15: seri leksikal dipecah urutan kurasi, bukan skor FULLTEXT ("gimana caranya daftar kak")', () => {
    const question = 'gimana caranya daftar kak';
    // Skor FULLTEXT dari DB evaluasi: entri talenta lebih tinggi karena kata "daftar" lebih sering muncul.
    const ftScore = { 'daftar-sebagai-talenta': 2.62, 'cara-daftar': 1.747 };
    const ranked = rankEntries(question, candidates(question).map((r) => ({ ...r, score: ftScore[r.slug] ?? 0.5 })));
    const talent = ranked.find((e) => e.slug === 'daftar-sebagai-talenta');
    expect(ranked[0].slug).toBe('cara-daftar');
    expect(ranked[0].lexical).toBe(talent.lexical);
  });

  it('searchKb: kueri FULLTEXT diperluas dengan bentuk baku, hasil diurutkan ulang & diberi ambang', async () => {
    const calls = [];
    const question = 'gmn cara regis jd talent?';
    const fakeDb = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        // Urutan "salah" dari SQL (skor 0 → sort_order) + satu entri tak relevan.
        return [[...candidates(question)].sort((a, b) => a.sort_order - b.sort_order)];
      },
    };
    const found = await searchKb(fakeDb, question, { audiences: ['all', 'public'], limit: 2 });
    expect(found.map((e) => e.slug)).toEqual(['daftar-sebagai-talenta', 'cara-daftar']);
    expect(calls[0].sql).toMatch(/NATURAL LANGUAGE MODE/);
    expect(calls[0].sql).toMatch(/status = 'active' AND audience IN \(\?\)/);
    const [query, audiences] = calls[0].params;
    expect(query.split(' ')).toEqual(expect.arrayContaining(['regis', 'daftar', 'talent', 'talenta']));
    expect(audiences).toEqual(['all', 'public']);
  });

  it('searchKb: kueri kosong setelah normalisasi → tanpa query DB', async () => {
    const fakeDb = { query: async () => { throw new Error('tidak boleh dipanggil'); } };
    expect(await searchKb(fakeDb, '?!', { audiences: ['all'] })).toEqual([]);
  });

  it('normalisasi kueri: huruf kecil, tanpa tanda baca/operator FULLTEXT', () => {
    expect(normalizeQuery('  Gimana   CARA daftar?!  (baru) +talenta* ')).toBe('gimana cara daftar baru talenta');
    expect(normalizeQuery('')).toBe('');
  });

  it('audiens per peran', () => {
    expect(audiencesFor(null)).toEqual(['all', 'public']);
    expect(audiencesFor({ role: 'talent' })).toEqual(['all', 'talent']);
    expect(audiencesFor({ role: 'liaison' })).toEqual(['all', 'liaison']);
    expect(audiencesFor({ role: 'admin' })).toEqual(['all', 'public', 'requester', 'talent', 'liaison']);
  });

  it('filter audiens: entri khusus AgenSUSI tidak pernah jadi kandidat bagi anonim', () => {
    const visible = (audiences) => rows.filter((r) => audiences.includes(r.audience));
    const anon = relevant('cara mencatat kunjungan lapangan', visible(audiencesFor(null)));
    const liaison = relevant('cara mencatat kunjungan lapangan', visible(audiencesFor({ role: 'liaison' })));
    expect(anon.map((e) => e.slug)).not.toContain('agensusi-kunjungan');
    expect(liaison[0].slug).toBe('agensusi-kunjungan');
  });
});
