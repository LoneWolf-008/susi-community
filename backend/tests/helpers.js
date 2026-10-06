// Helper & factory untuk test integrasi. Data dibuat langsung lewat SQL agar setiap
// test hanya menguji perilaku yang sedang diperiksa.
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { pool } from '../config/db.js';
import { app } from '../app.js';
import { signAccessToken } from '../utils/jwt.js';

export const api = () => request(app);
export const PASSWORD = 'rahasia-uji-123';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq += 1).toString(36)}`;

export async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0];
}

export async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Kosongkan semua tabel (kecuali schema_migrations) di awal sebuah berkas test. */
export async function resetData() {
  const conn = await pool.getConnection();
  try {
    const [tables] = await conn.query(
      `SELECT table_name AS t FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'`,
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t } of tables) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

export async function createUser(role = 'requester', overrides = {}) {
  const email = overrides.email || `${role}-${uniq()}@uji.test`;
  const [res] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)`,
    [overrides.name || `Uji ${role} ${uniq()}`, email, PASSWORD_HASH, role, overrides.status || 'AKTIF'],
  );
  const id = res.insertId;
  await pool.query(`INSERT INTO user_settings (user_id) VALUES (?)`, [id]);
  if (role === 'talent') await pool.query(`INSERT INTO talent_profiles (user_id) VALUES (?)`, [id]);
  if (role === 'liaison') await pool.query(`INSERT INTO liaison_profiles (user_id) VALUES (?)`, [id]);

  const token = signAccessToken({ userId: id, role });
  return { id, role, email, password: PASSWORD, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function createCommunity(creator, overrides = {}) {
  const [res] = await pool.query(
    `INSERT INTO communities (name, type, lat, lng, source, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [overrides.name || `Komunitas ${uniq()}`, overrides.type || 'UMKM', overrides.lat ?? -6.9, overrides.lng ?? 107.6,
      creator?.role === 'liaison' ? 'AGENSUSI' : 'MANDIRI', creator?.id ?? null],
  );
  if (creator && creator.role !== 'liaison') {
    await pool.query(
      `INSERT INTO community_members (community_id, user_id, role_in) VALUES (?, ?, 'PENGURUS')`,
      [res.insertId, creator.id],
    );
  }
  return { id: res.insertId };
}

/** owner requester → jalur MANDIRI; owner liaison → jalur AGENSUSI (requester_id NULL). */
export async function createNeed(owner, overrides = {}) {
  const isLiaison = owner.role === 'liaison';
  const title = overrides.title || `Kebutuhan ${uniq()}`;
  const [res] = await pool.query(
    `INSERT INTO needs (community_id, requester_id, created_by, title, category, description, source,
                        moderation_status, reject_reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [overrides.communityId ?? null, isLiaison ? null : owner.id, owner.id, title, overrides.category || 'PENCATATAN',
      overrides.description || 'Deskripsi kebutuhan uji', isLiaison ? 'AGENSUSI' : 'MANDIRI',
      overrides.moderation || 'APPROVED', overrides.rejectReason ?? null, overrides.status || 'OPEN'],
  );
  if (overrides.moderationItem) {
    await pool.query(
      `INSERT INTO moderation_items (item_type, ref_id, title, submitted_by, source, decision, reject_reason)
       VALUES ('KEBUTUHAN', ?, ?, ?, ?, ?, ?)`,
      [res.insertId, title, owner.id, isLiaison ? 'AGENSUSI' : 'MANDIRI', overrides.moderation || 'PENDING',
        overrides.rejectReason ?? null],
    );
  }
  return { id: res.insertId, title, ownerId: owner.id };
}

export async function createApplication(need, talent, status = 'MENUNGGU') {
  const [res] = await pool.query(
    `INSERT INTO applications (need_id, talent_id, message, status, decided_at)
     VALUES (?, ?, 'Saya siap membantu', ?, ?)`,
    [need.id, talent.id, status, status === 'MENUNGGU' ? null : new Date()],
  );
  return { id: res.insertId };
}

const DONE_BY_DEFAULT = ['AWAITING_VERIFICATION', 'COMPLETED'];

/**
 * Proyek siap pakai. `talentMarkedDone` default true untuk AWAITING_VERIFICATION/COMPLETED.
 * Kebutuhan ikut berstatus IN_PROGRESS (atau COMPLETED).
 */
export async function createProject({ need, owner, talent, status = 'AGREEMENT', talentMarkedDone, deadline = null }) {
  const app = await createApplication(need, talent, 'DITERIMA');
  const done = talentMarkedDone ?? DONE_BY_DEFAULT.includes(status);
  const [res] = await pool.query(
    `INSERT INTO projects (need_id, community_id, requester_id, talent_id, application_id, scope, done_definition,
                           deadline, status, progress_pct, agreed_by_community_at, agreed_by_talent_at, started_at,
                           talent_marked_done_at)
     VALUES (?, (SELECT community_id FROM needs WHERE id = ?), ?, ?, ?, 'Lingkup uji', 'Selesai bila uji lulus',
             ?, ?, 50, NOW(), ?, ?, ?)`,
    [need.id, need.id, owner.id, talent.id, app.id, deadline, status,
      status === 'AGREEMENT' ? null : new Date(), status === 'AGREEMENT' ? null : new Date(), done ? new Date() : null],
  );
  await pool.query(`UPDATE needs SET status = ? WHERE id = ?`, [status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS', need.id]);
  return { id: res.insertId, applicationId: app.id };
}

export async function createDispute(project, overrides = {}) {
  const [res] = await pool.query(
    `INSERT INTO disputes (project_id, status, summary) VALUES (?, ?, ?)`,
    [project.id, overrides.status || 'MEDIASI', overrides.summary || 'Hasil belum sesuai kesepakatan'],
  );
  return { id: res.insertId };
}
