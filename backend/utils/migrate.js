// Runner skema & migrasi database.
//
//   npm run db:init     buat database bila belum ada, pasang db/schema.sql (hanya pada DB
//                       kosong), lalu jalankan migrasi yang tertunda
//   npm run db:migrate  jalankan migrasi tertunda di db/migrations/NNN_nama.sql
//   npm run db:status   tampilkan migrasi yang sudah/belum dijalankan
//   npm run db:reset    HAPUS semua tabel/view/procedure lalu db:init (ditolak di production)
//
// Setiap migrasi tercatat di tabel schema_migrations (nama + checksum). Pernyataan dijalankan
// satu per satu; DDL MySQL tidak bisa di-rollback, jadi tulis migrasi seidempoten mungkin.
import { env, BACKEND_DIR } from '../config/env.js';
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { splitSqlStatements } from './sqlSplit.js';

const SCHEMA_FILE = path.join(BACKEND_DIR, 'db', 'schema.sql');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  ? path.resolve(process.env.MIGRATIONS_DIR)
  : path.join(BACKEND_DIR, 'db', 'migrations');
const BASELINE_NAME = '000_schema.sql';
const MIGRATION_FILE_RE = /^\d{3}_[a-z0-9_]+\.sql$/;
const LOCK_NAME = 'susi_schema_migrations';

const defaultLog = (msg) => console.log(msg);

const assertSafeDbName = (name) => {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`DB_NAME "${name}" hanya boleh berisi huruf, angka, dan garis bawah`);
  }
};

const checksum = (text) => crypto.createHash('sha256').update(text).digest('hex');

const connect = (withDatabase = true) =>
  mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: withDatabase ? env.db.name : undefined,
    charset: 'utf8mb4_unicode_ci',
    dateStrings: true,
  });

async function ensureDatabase(log) {
  assertSafeDbName(env.db.name);
  const conn = await connect(false);
  try {
    const [result] = await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    if (result.warningStatus === 0) log(`Database ${env.db.name} dibuat.`);
  } finally {
    await conn.end();
  }
}

async function listTables(conn) {
  const [rows] = await conn.query(
    `SELECT table_name AS name, table_type AS type
     FROM information_schema.tables WHERE table_schema = DATABASE()`,
  );
  return rows;
}

async function ensureMigrationsTable(conn) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       VARCHAR(255) NOT NULL,
       checksum   CHAR(64) NOT NULL,
       applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (name)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

async function runSqlFile(conn, file, sqlText) {
  const statements = splitSqlStatements(sqlText);
  for (const [index, statement] of statements.entries()) {
    try {
      await conn.query(statement);
    } catch (err) {
      const preview = statement.replace(/\s+/g, ' ').slice(0, 160);
      err.message = `${path.basename(file)} pernyataan #${index + 1} gagal: ${err.message}\n  → ${preview}`;
      throw err;
    }
  }
  return statements.length;
}

async function readMigrationFiles() {
  let names;
  try {
    names = await fs.readdir(MIGRATIONS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const invalid = names.filter((n) => n.endsWith('.sql') && !MIGRATION_FILE_RE.test(n));
  if (invalid.length > 0) {
    throw new Error(`Nama berkas migrasi tidak valid (pola NNN_nama.sql): ${invalid.join(', ')}`);
  }
  const files = names.filter((n) => MIGRATION_FILE_RE.test(n)).sort();
  const result = [];
  for (const name of files) {
    const text = await fs.readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
    result.push({ name, text, checksum: checksum(text) });
  }
  return result;
}

async function withLock(conn, fn) {
  const [[{ locked }]] = await conn.query(`SELECT GET_LOCK(?, 30) AS locked`, [LOCK_NAME]);
  if (locked !== 1) throw new Error('Gagal memperoleh kunci migrasi (runner lain sedang berjalan?)');
  try {
    return await fn();
  } finally {
    await conn.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]);
  }
}

async function applyPendingMigrations(conn, log) {
  await ensureMigrationsTable(conn);
  const [appliedRows] = await conn.query(`SELECT name, checksum FROM schema_migrations`);
  const applied = new Map(appliedRows.map((r) => [r.name, r.checksum]));
  const files = await readMigrationFiles();

  for (const file of files) {
    const recorded = applied.get(file.name);
    if (recorded && recorded !== file.checksum) {
      log(`PERINGATAN: ${file.name} berubah setelah dijalankan. Buat migrasi baru, jangan ubah yang lama.`);
    }
  }

  const pending = files.filter((f) => !applied.has(f.name));
  for (const file of pending) {
    const count = await runSqlFile(conn, file.name, file.text);
    await conn.query(`INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)`, [file.name, file.checksum]);
    log(`✔ ${file.name} (${count} pernyataan)`);
  }
  if (pending.length === 0) log('Tidak ada migrasi tertunda.');
  return pending.map((f) => f.name);
}

const UNMANAGED_DB_MESSAGE = (name) =>
  `Database ${name} sudah berisi tabel tetapi belum dikelola runner migrasi ` +
  `(tidak ada schema_migrations), mis. hasil impor dump phpMyAdmin. ` +
  `Jalankan "npm run db:reset" (MENGHAPUS semua data) atau arahkan DB_NAME ke database kosong.`;

export async function initDatabase({ log = defaultLog } = {}) {
  await ensureDatabase(log);
  const conn = await connect();
  try {
    return await withLock(conn, async () => {
      const tables = await listTables(conn);
      const names = tables.map((t) => t.name.toLowerCase());

      if (tables.length === 0) {
        const schemaText = await fs.readFile(SCHEMA_FILE, 'utf8');
        const count = await runSqlFile(conn, SCHEMA_FILE, schemaText);
        await ensureMigrationsTable(conn);
        await conn.query(`INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)`, [
          BASELINE_NAME,
          checksum(schemaText),
        ]);
        log(`✔ ${BASELINE_NAME} (db/schema.sql, ${count} pernyataan)`);
      } else if (!names.includes('schema_migrations')) {
        throw new Error(UNMANAGED_DB_MESSAGE(env.db.name));
      }

      return applyPendingMigrations(conn, log);
    });
  } finally {
    await conn.end();
  }
}

export async function migrateDatabase({ log = defaultLog } = {}) {
  const conn = await connect();
  try {
    return await withLock(conn, async () => {
      const tables = await listTables(conn);
      if (tables.length === 0) throw new Error(`Database ${env.db.name} kosong. Jalankan "npm run db:init".`);
      if (!tables.some((t) => t.name.toLowerCase() === 'schema_migrations')) {
        throw new Error(UNMANAGED_DB_MESSAGE(env.db.name));
      }
      return applyPendingMigrations(conn, log);
    });
  } finally {
    await conn.end();
  }
}

export async function resetDatabase({ log = defaultLog } = {}) {
  if (env.isProduction) {
    throw new Error('db:reset ditolak: NODE_ENV=production. Reset hanya untuk development/test.');
  }
  await ensureDatabase(log);
  const conn = await connect();
  try {
    await withLock(conn, async () => {
      const objects = await listTables(conn);
      const [routines] = await conn.query(
        `SELECT routine_name AS name, routine_type AS type
         FROM information_schema.routines WHERE routine_schema = DATABASE()`,
      );
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const obj of objects.filter((o) => o.type === 'VIEW')) {
        await conn.query(`DROP VIEW IF EXISTS \`${obj.name}\``);
      }
      for (const obj of objects.filter((o) => o.type !== 'VIEW')) {
        await conn.query(`DROP TABLE IF EXISTS \`${obj.name}\``);
      }
      for (const routine of routines) {
        await conn.query(`DROP ${routine.type === 'FUNCTION' ? 'FUNCTION' : 'PROCEDURE'} IF EXISTS \`${routine.name}\``);
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      log(`Database ${env.db.name} dikosongkan (${objects.length} tabel/view, ${routines.length} routine).`);
    });
  } finally {
    await conn.end();
  }
  return initDatabase({ log });
}

export async function migrationStatus({ log = defaultLog } = {}) {
  const conn = await connect();
  try {
    const tables = await listTables(conn);
    if (!tables.some((t) => t.name.toLowerCase() === 'schema_migrations')) {
      log(tables.length === 0 ? 'Database kosong (belum db:init).' : UNMANAGED_DB_MESSAGE(env.db.name));
      return;
    }
    const [rows] = await conn.query(`SELECT name, applied_at FROM schema_migrations ORDER BY name`);
    const applied = new Set(rows.map((r) => r.name));
    for (const row of rows) log(`✔ ${row.name}  (${row.applied_at})`);
    const pending = (await readMigrationFiles()).filter((f) => !applied.has(f.name));
    for (const file of pending) log(`… ${file.name}  (tertunda)`);
  } finally {
    await conn.end();
  }
}

const COMMANDS = {
  init: initDatabase,
  migrate: migrateDatabase,
  reset: resetDatabase,
  status: migrationStatus,
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const command = process.argv[2];
  const fn = COMMANDS[command];
  if (!fn) {
    console.error(`Pemakaian: node utils/migrate.js <${Object.keys(COMMANDS).join('|')}>`);
    process.exit(1);
  }
  console.log(`[db:${command}] ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name}`);
  fn()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n[db:${command}] GAGAL: ${err.message}`);
      process.exit(1);
    });
}
