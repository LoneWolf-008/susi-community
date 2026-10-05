// Memuat basis pengetahuan dari backend/db/seeds/kb.json (T12.1). Dipakai `npm run seed` dan test.
// Kunci entri = slug: entri yang slug-nya sudah ada dilewati, sehingga isi yang sudah diubah admin
// tidak tertimpa — kecuali diminta eksplisit (`npm run seed -- --sync-kb`) untuk menerapkan
// perubahan kb.json ke DB yang sudah terisi. Entri tanpa `source` dimuat sebagai draft (aturan isi
// KB: tidak boleh dikarang).
import fs from 'node:fs/promises';
import path from 'node:path';
import { BACKEND_DIR } from '../config/env.js';

export const KB_FILE = path.join(BACKEND_DIR, 'db', 'seeds', 'kb.json');
export const KB_AUDIENCES = ['all', 'public', 'requester', 'talent', 'liaison'];
export const KB_STATUSES = ['active', 'draft', 'archived'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function readKbFile(file = KB_FILE) {
  const { entries } = JSON.parse(await fs.readFile(file, 'utf8'));
  return entries;
}

/** Status efektif: entri tanpa sumber selalu draft. */
export const effectiveStatus = (entry) => (entry.source ? entry.status ?? 'active' : 'draft');

/** @returns {string[]} daftar masalah; kosong bila semua entri layak dimuat. */
export function validateKbEntries(entries) {
  const errors = [];
  const slugs = new Set();
  entries.forEach((e, i) => {
    const at = `entri #${i + 1}${e?.slug ? ` (${e.slug})` : ''}`;
    if (!e || typeof e !== 'object') {
      errors.push(`${at}: bukan objek`);
      return;
    }
    if (!SLUG_RE.test(e.slug || '') || e.slug.length > 80) errors.push(`${at}: slug wajib, huruf kecil-angka-strip, ≤ 80`);
    else if (slugs.has(e.slug)) errors.push(`${at}: slug ganda`);
    slugs.add(e.slug);
    if (!e.title || String(e.title).length > 200) errors.push(`${at}: title wajib, ≤ 200 karakter`);
    if (!Array.isArray(e.keywords) || e.keywords.length === 0) errors.push(`${at}: keywords wajib berupa daftar`);
    else if (e.keywords.join(', ').length > 500) errors.push(`${at}: keywords maksimal 500 karakter`);
    if (!e.reply || !String(e.reply).trim()) errors.push(`${at}: reply wajib`);
    if (e.audience && !KB_AUDIENCES.includes(e.audience)) errors.push(`${at}: audience tidak dikenal`);
    if (e.status && !KB_STATUSES.includes(e.status)) errors.push(`${at}: status tidak dikenal`);
    if (e.category && String(e.category).length > 50) errors.push(`${at}: category maksimal 50 karakter`);
    if (e.source && String(e.source).length > 255) errors.push(`${at}: source maksimal 255 karakter`);
  });
  return errors;
}

/**
 * Masukkan entri yang slug-nya belum ada; dengan `sync`, entri yang sudah ada ditimpa isi kb.json.
 * Tidak melakukan commit/sinkron indeks: pemanggil menjalankan syncKbIndex setelah transaksi selesai.
 * @returns {Promise<{ created: number, updated: number, skipped: number }>}
 */
export async function upsertKbEntries(conn, entries, { sync = false } = {}) {
  const errors = validateKbEntries(entries);
  if (errors.length > 0) throw new Error(`kb.json tidak valid:\n  - ${errors.join('\n  - ')}`);
  const counts = { created: 0, updated: 0, skipped: 0 };
  for (const [index, entry] of entries.entries()) {
    const values = [entry.title, entry.category ?? null, entry.keywords.join(', '), entry.reply,
      entry.audience ?? 'all', effectiveStatus(entry), entry.source ?? null, (index + 1) * 10];
    const [rows] = await conn.query(`SELECT id FROM kb_entries WHERE slug = ? LIMIT 1`, [entry.slug]);
    if (!rows[0]) {
      await conn.query(
        `INSERT INTO kb_entries (title, category, keywords, reply, audience, status, source, sort_order, slug)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...values, entry.slug],
      );
      counts.created += 1;
    } else if (sync) {
      await conn.query(
        `UPDATE kb_entries SET title = ?, category = ?, keywords = ?, reply = ?, audience = ?, status = ?,
                source = ?, sort_order = ?
         WHERE id = ?`,
        [...values, rows[0].id],
      );
      counts.updated += 1;
    } else {
      counts.skipped += 1;
    }
  }
  return counts;
}
