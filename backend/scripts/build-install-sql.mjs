// db/install.sql untuk hosting tanpa SSH (impor lewat phpMyAdmin ke database KOSONG yang sudah dibuat):
// db/schema.sql + semua migrasi db/migrations (urut), baris schema_migrations dengan checksum yang sama
// seperti utils/migrate.js (agar `npm run db:migrate` berikutnya hanya menjalankan migrasi baru), lalu
// data referensi: katalog keahlian dan basis pengetahuan Tanya SUSI (kb.json). TANPA data demo, tanpa
// CREATE DATABASE/USE, tanpa DEFINER. Stored procedure lama di schema.sql dilewati karena migrasi 001
// menghapusnya.
//
//   node scripts/build-install-sql.mjs [berkas-keluaran]   (bawaan: cetak ke stdout)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(BACKEND, 'db', 'migrations');
const MIGRATION_FILE_RE = /^\d{3}_[a-z0-9_]+\.sql$/;
const checksum = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Katalog keahlian awal (sama dengan yang dipakai pilihan keahlian di aplikasi; bukan data orang).
const SKILLS = [
  'React', 'JavaScript', 'HTML & CSS', 'MySQL', 'Laravel', 'PHP', 'Excel', 'Google Sheets',
  'Google Forms', 'Data Entry', 'Looker Studio', 'Figma', 'Canva', 'Desain Poster', 'Branding',
];

/** Buang blok DELIMITER (stored procedure), CREATE DATABASE/USE, dan klausa DEFINER. */
export function cleanSql(text) {
  return text
    .replace(/^DELIMITER \$\$[\s\S]*?^DELIMITER ;[^\n]*\n?/gm, '-- (stored procedure lama dilewati: dihapus migrasi 001)\n')
    .replace(/^\s*CREATE\s+DATABASE[^;]*;\s*$/gim, '')
    .replace(/^\s*USE\s+`?\w+`?\s*;\s*$/gim, '')
    .replace(/\s+DEFINER\s*=\s*`[^`]*`@`[^`]*`/gi, '');
}

export async function buildInstallSql() {
  const schemaText = fs.readFileSync(path.join(BACKEND, 'db', 'schema.sql'), 'utf8');
  const migrations = fs.readdirSync(MIGRATIONS_DIR).filter((n) => MIGRATION_FILE_RE.test(n)).sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8') }));
  // kb.json dibaca langsung (tanpa config/env.js); aturan status sama dengan utils/kbSeed.js:
  // entri tanpa `source` selalu draft.
  const kb = JSON.parse(fs.readFileSync(path.join(BACKEND, 'db', 'seeds', 'kb.json'), 'utf8')).entries;
  const effectiveStatus = (entry) => (entry.source ? entry.status ?? 'active' : 'draft');
  const sql = (text, values) => mysql.format(text, values);

  const out = [
    '-- SUSI Community: instalasi database untuk hosting tanpa SSH (cPanel/phpMyAdmin).',
    `-- Dibuat oleh scripts/build-install-sql.mjs pada ${new Date().toISOString()}.`,
    '-- Impor ke database KOSONG yang sudah Anda buat. Berkas ini tidak membuat database dan tidak berisi',
    '-- akun atau data demo. Akun admin dibuat terpisah dengan `npm run make-admin-sql`.',
    '',
    'SET NAMES utf8mb4;',
    '',
    '-- ===== db/schema.sql =====',
    cleanSql(schemaText).trim(),
    '',
  ];
  for (const m of migrations) out.push(`-- ===== db/migrations/${m.name} =====`, cleanSql(m.text).trim(), '');

  out.push(
    '-- ===== schema_migrations (sama seperti utils/migrate.js) =====',
    `CREATE TABLE IF NOT EXISTS schema_migrations (
  name       VARCHAR(255) NOT NULL,
  checksum   CHAR(64) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    sql('INSERT INTO schema_migrations (name, checksum) VALUES ?;', [[
      ['000_schema.sql', checksum(schemaText)],
      ...migrations.map((m) => [m.name, checksum(m.text)]),
    ]]),
    '',
    '-- ===== Data referensi: katalog keahlian =====',
    sql('INSERT IGNORE INTO skills (name) VALUES ?;', [SKILLS.map((s) => [s])]),
    '',
    '-- ===== Data referensi: basis pengetahuan Tanya SUSI (kb.json) =====',
  );
  kb.forEach((entry, index) => {
    out.push(sql(
      'INSERT INTO kb_entries (title, category, keywords, reply, audience, status, source, sort_order, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [entry.title, entry.category ?? null, entry.keywords.join(', '), entry.reply, entry.audience ?? 'all',
        effectiveStatus(entry), entry.source ?? null, (index + 1) * 10, entry.slug],
    ));
  });
  out.push(
    '',
    '-- Indeks FULLTEXT KB disinkronkan agar pencarian Tanya SUSI langsung bekerja (lihat services/chatbot/kb.js).',
    'OPTIMIZE TABLE kb_entries;',
    '',
  );
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = await buildInstallSql();
  if (process.argv[2]) {
    fs.mkdirSync(path.dirname(path.resolve(process.argv[2])), { recursive: true });
    fs.writeFileSync(process.argv[2], text);
    console.error(`install.sql ditulis: ${process.argv[2]} (${Math.round(text.length / 1024)} KB)`);
  } else {
    process.stdout.write(text);
  }
}
