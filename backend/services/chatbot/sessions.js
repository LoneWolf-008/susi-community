// Sesi & pesan chat. Aturan akses:
//  - sesi milik pengguna (user_id terisi) hanya bisa dibuka pemiliknya;
//  - sesi anonim hanya bisa dibuka dengan id-nya (UUID acak dari server);
//  - pengguna yang masuk lalu melanjutkan sesi anonim "mengklaim" sesi itu, sehingga jawaban yang
//    nanti memuat data pribadinya (T12) tidak bisa dibaca siapa pun yang memegang id lama.
import crypto from 'node:crypto';
import { HttpError } from '../../utils/httpError.js';

export const MAX_MESSAGES_PER_SESSION = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => new HttpError(404, 'Sesi chat tidak ditemukan');

export async function createSession(db, user) {
  const id = crypto.randomUUID();
  await db.query(`INSERT INTO chat_sessions (id, user_id, role) VALUES (?, ?, ?)`, [id, user?.id ?? null, user?.role ?? 'public']);
  return { id, user_id: user?.id ?? null, role: user?.role ?? 'public' };
}

/** Sesi yang boleh diakses `user` (atau anonim); 404 untuk id tak dikenal maupun sesi orang lain. */
export async function findAccessibleSession(db, sessionId, user) {
  if (!UUID_RE.test(String(sessionId || ''))) throw notFound();
  const [rows] = await db.query(`SELECT * FROM chat_sessions WHERE id = ?`, [sessionId]);
  const session = rows[0];
  if (!session) throw notFound();
  if (session.user_id !== null && (!user || Number(user.id) !== Number(session.user_id))) throw notFound();
  return session;
}

export async function claimIfAnonymous(db, session, user) {
  if (session.user_id !== null || !user) return session;
  await db.query(`UPDATE chat_sessions SET user_id = ?, role = ? WHERE id = ? AND user_id IS NULL`, [user.id, user.role, session.id]);
  return { ...session, user_id: user.id, role: user.role };
}

export async function countMessages(db, sessionId) {
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ?`, [sessionId]);
  return Number(n);
}

export async function addMessage(db, sessionId, role, content) {
  const [res] = await db.query(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`, [sessionId, role, content]);
  await db.query(`UPDATE chat_sessions SET last_active_at = NOW() WHERE id = ?`, [sessionId]);
  return res.insertId;
}

/** N pesan terakhir (urut lama → baru) untuk konteks LLM. */
export async function recentMessages(db, sessionId, limit) {
  const [rows] = await db.query(
    `SELECT id, role, content FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?`,
    [sessionId, limit],
  );
  return rows.reverse();
}

/** Pesan untuk ditampilkan; `afterId` untuk polling balasan baru. */
export async function listMessages(db, sessionId, { afterId = 0, limit = 100 } = {}) {
  const [rows] = await db.query(
    `SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? AND id > ? ORDER BY id ASC LIMIT ?`,
    [sessionId, afterId, limit],
  );
  return rows;
}
