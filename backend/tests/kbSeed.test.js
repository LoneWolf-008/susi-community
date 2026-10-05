import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../config/db.js';
import { resetData, one, all } from './helpers.js';
import { upsertKbEntries, readKbFile } from '../utils/kbSeed.js';

const ENTRIES = [
  { slug: 'uji-a', title: 'A', keywords: ['a'], reply: 'Jawaban A.', source: 'PRD §1' },
  { slug: 'uji-b', title: 'B', keywords: ['b'], reply: 'Jawaban B.' }, // tanpa sumber → draft
];

describe('Seed KB per slug (T12.1)', () => {
  beforeEach(resetData);

  it('entri baru dimasukkan; entri tanpa sumber selalu draft', async () => {
    expect(await upsertKbEntries(pool, ENTRIES)).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(await all(`SELECT slug, status, source, sort_order FROM kb_entries ORDER BY slug`)).toEqual([
      { slug: 'uji-a', status: 'active', source: 'PRD §1', sort_order: 10 },
      { slug: 'uji-b', status: 'draft', source: null, sort_order: 20 },
    ]);
  });

  it('seed ulang melewati entri yang ada (isi ubahan admin aman); --sync-kb menimpanya dari kb.json', async () => {
    await upsertKbEntries(pool, ENTRIES);
    await pool.query(`UPDATE kb_entries SET reply = 'Diubah admin.' WHERE slug = 'uji-a'`);
    expect(await upsertKbEntries(pool, ENTRIES)).toEqual({ created: 0, updated: 0, skipped: 2 });
    expect(await one(`SELECT reply FROM kb_entries WHERE slug = 'uji-a'`)).toEqual({ reply: 'Diubah admin.' });

    expect(await upsertKbEntries(pool, ENTRIES, { sync: true })).toEqual({ created: 0, updated: 2, skipped: 0 });
    expect(await one(`SELECT reply FROM kb_entries WHERE slug = 'uji-a'`)).toEqual({ reply: 'Jawaban A.' });
    expect(await one(`SELECT COUNT(*) AS n FROM kb_entries`)).toEqual({ n: 2 });
  });

  it('kb.json tidak valid ditolak sebelum ada yang ditulis', async () => {
    await expect(upsertKbEntries(pool, [...ENTRIES, { slug: 'Bukan Slug', title: '', keywords: [], reply: '' }]))
      .rejects.toThrow(/kb.json tidak valid/);
    expect(await one(`SELECT COUNT(*) AS n FROM kb_entries`)).toEqual({ n: 0 });
  });

  it('seluruh kb.json termuat sebagai entri aktif bersumber', async () => {
    const entries = await readKbFile();
    expect((await upsertKbEntries(pool, entries)).created).toBe(entries.length);
    expect(await one(`SELECT COUNT(*) AS n FROM kb_entries WHERE status = 'active' AND source IS NOT NULL`))
      .toEqual({ n: entries.length });
  });
});
