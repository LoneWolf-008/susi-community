import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankEntries, searchKb, normalizeQuery, audiencesFor } from '../../services/chatbot/kb.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { entries } = JSON.parse(fs.readFileSync(path.join(here, '../../db/seeds/kb.json'), 'utf8'));
// Entri KB seed sebagai baris DB dengan skor FULLTEXT 0: keadaan InnoDB setelah db:reset + seed (uji live T11).
const rows = entries.map((e, i) => ({
  id: i + 1, title: null, keywords: e.keywords.join(', '), reply: e.reply, sort_order: (i + 1) * 10, score: 0,
}));
const top = (q) => rankEntries(q, rows)[0].id;

describe('Retrieval KB: pemeringkatan ulang (T11)', () => {
  it('pertanyaan uji live → entri "daftar", walau semua skor FULLTEXT 0 (regresi)', () => {
    const ranked = rankEntries('gimana cara daftar jadi talenta?', rows);
    expect(ranked[0].keywords).toBe('komunitas, daftar, gabung, ikut');
    // Tanpa bobot kelangkaan, entri "talenta" (sort_order lebih kecil) menang seri.
    expect(ranked[0].lexical).toBeGreaterThan(ranked[1].lexical);
  });

  it('topik lain mendapat entri yang tepat', () => {
    expect(top('cara kerja susi gimana')).toBe(5);
    expect(top('berapa biaya pakai susi')).toBe(10);
    expect(top('lacak status proyek saya')).toBe(2);
    expect(top('apa itu agensusi')).toBe(9);
  });

  it('kata tanya/fungsi diabaikan; tanpa kata isi, urutan jatuh ke skor FULLTEXT lalu sort_order', () => {
    const ranked = rankEntries('gimana caranya dong?', [
      { id: 1, keywords: 'cara kerja', reply: 'x', sort_order: 1, score: 0.2 },
      { id: 2, keywords: 'lain', reply: 'y', sort_order: 2, score: 0.9 },
    ]);
    expect(ranked.map((e) => [e.id, e.lexical])).toEqual([[2, 0], [1, 0]]);
  });

  it('searchKb memakai pemeringkatan ulang atas kandidat FULLTEXT (bukan urutan SQL)', async () => {
    const calls = [];
    const fakeDb = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        // Urutan "salah" dari SQL: skor 0, sort_order kecil dulu.
        return [[rows[3], rows[4], rows[5], rows[2]]];
      },
    };
    const found = await searchKb(fakeDb, 'gimana cara daftar jadi talenta?', { audiences: ['all', 'public'], limit: 2 });
    expect(found.map((e) => e.id)).toEqual([6, 4]);
    expect(calls[0].sql).toMatch(/NATURAL LANGUAGE MODE/);
    expect(calls[0].params).toEqual(['gimana cara daftar jadi talenta', ['all', 'public'], 'gimana cara daftar jadi talenta']);
  });

  it('normalisasi kueri: huruf kecil, tanpa tanda baca/operator FULLTEXT', () => {
    expect(normalizeQuery('  Gimana   CARA daftar?!  (baru) +talenta* ')).toBe('gimana cara daftar baru talenta');
    expect(normalizeQuery('')).toBe('');
  });

  it('audiens per peran', () => {
    expect(audiencesFor(null)).toEqual(['all', 'public']);
    expect(audiencesFor({ role: 'talent' })).toEqual(['all', 'talent']);
    expect(audiencesFor({ role: 'admin' })).toEqual(['all', 'public', 'requester', 'talent', 'liaison']);
  });
});
