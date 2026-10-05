// Antrean eskalasi Tanya SUSI untuk AgenSUSI (liaison) dan admin (T13).
// Alur: pending → claim (assigned ke liaison) → reply (pesan role 'agent' di sesi pengguna) →
// resolve (resolved/closed), opsional menyimpan penyelesaian sebagai draft KB untuk ditinjau admin.
// U6: handback ("Kembalikan ke AI") menyelesaikan tiket tanpa jawaban tuntas; pengguna bisa membatalkan
// (cancelled); lencana belum dibaca dari `agent_read_id`.
// Admin boleh membalas/menyelesaikan tiket siapa pun; liaison hanya tiket yang ia klaim.
import { pool } from '../config/db.js';
import { success, created } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import { notify, audit } from '../utils/activity.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { addMessage } from '../services/chatbot/sessions.js';
import { queryTerms } from '../services/chatbot/text.js';
import { displayQuestion } from '../services/chatbot/guard.js';
import { STALE_HOURS } from '../services/chatbot/escalation.js';
import { HANDBACK_REPLY } from '../services/chatbot/replies.js';

const OPEN = ['pending', 'assigned'];
const STATUS_FILTERS = {
  open: OPEN,
  pending: ['pending'],
  assigned: ['assigned'],
  resolved: ['resolved'],
  closed: ['closed'],
  cancelled: ['cancelled'],
  all: ['pending', 'assigned', 'resolved', 'closed', 'cancelled'],
};

// unread = pesan pengguna di bagian AgenSUSI yang belum dilihat agen (hanya tiket terbuka).
const SELECT_ESCALATION = `
  SELECT e.*, u.name AS user_name, u.role AS user_role, a.name AS assignee_name, s.last_active_at,
         (e.status = 'pending' AND e.created_at < NOW() - INTERVAL ${STALE_HOURS} HOUR) AS stale,
         IF(e.status IN ('pending', 'assigned'),
            (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = e.session_id AND m.role = 'user'
               AND m.id > GREATEST(e.agent_read_id, COALESCE(e.handoff_message_id, 0))), 0) AS unread,
         (SELECT m.content FROM chat_messages m WHERE m.session_id = e.session_id ORDER BY m.id DESC LIMIT 1) AS last_content,
         (SELECT m.role FROM chat_messages m WHERE m.session_id = e.session_id ORDER BY m.id DESC LIMIT 1) AS last_role
  FROM escalations e
  JOIN chat_sessions s ON s.id = e.session_id
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN users a ON a.id = e.assigned_to`;

const toItem = (r) => ({
  id: r.id,
  session_id: r.session_id,
  status: r.status,
  priority: r.priority,
  score: r.score,
  reasons: String(r.reason || '').split(',').filter(Boolean),
  summary: r.summary,
  summary_source: r.summary_source,
  // Kontak balik dari pengguna: hanya untuk liaison/admin.
  contact: r.contact,
  user: r.user_id ? { id: r.user_id, name: r.user_name, role: r.user_role } : null,
  assigned_to: r.assigned_to ? { id: r.assigned_to, name: r.assignee_name } : null,
  stale: Boolean(Number(r.stale)),
  resolution: r.resolution,
  kb_entry_id: r.kb_entry_id,
  // U6: inbox dua panel & transkrip (bagian AI = pesan sebelum handoff_message_id).
  unread: Number(r.unread ?? 0),
  last_message: r.last_role ? { role: r.last_role, preview: clip(r.last_content, 120) } : null,
  handoff_message_id: r.handoff_message_id ?? null,
  handed_back: Boolean(Number(r.handed_back)),
  rating: r.rating ?? null,
  created_at: r.created_at,
  assigned_at: r.assigned_at,
  resolved_at: r.resolved_at,
  last_active_at: r.last_active_at,
});

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== String(raw)) throw new HttpError(404, 'Tiket eskalasi tidak ditemukan');
  return id;
};

async function findEscalation(db, id) {
  const [rows] = await db.query(`${SELECT_ESCALATION} WHERE e.id = ?`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Tiket eskalasi tidak ditemukan');
  return rows[0];
}

/** Liaison hanya boleh menangani tiket yang ia klaim; admin boleh semuanya. */
function assertCanHandle(row, user, { allowPendingForAdmin = false } = {}) {
  const isAdmin = user.role === 'admin';
  if (row.status === 'cancelled') throw new HttpError(409, 'Pengguna sudah kembali ke asisten AI');
  if (row.status === 'resolved' || row.status === 'closed') throw new HttpError(409, 'Tiket ini sudah selesai');
  if (row.status === 'pending' && !(isAdmin && allowPendingForAdmin)) {
    throw new HttpError(409, 'Klaim tiket ini dulu sebelum menanganinya');
  }
  if (!isAdmin && row.status === 'assigned' && Number(row.assigned_to) !== Number(user.id)) {
    throw new HttpError(403, 'Tiket ini ditangani AgenSUSI lain');
  }
}

export const listEscalations = async (req, res, next) => {
  try {
    const statuses = STATUS_FILTERS[req.query.status ?? 'open'];
    if (!statuses) throw new HttpError(400, `Status harus salah satu dari: ${Object.keys(STATUS_FILTERS).join(', ')}`);
    const where = ['e.status IN (?)'];
    const params = [statuses];
    if (req.query.mine === 'true') {
      where.push('e.assigned_to = ?');
      params.push(req.user.id);
    }
    const pg = parsePagination(req.query);
    // Tiket terbuka dulu (prioritas tinggi, lalu terlama); yang sudah selesai terbaru dulu.
    const [rows] = await pool.query(
      `${SELECT_ESCALATION}
       WHERE ${where.join(' AND ')}
       ORDER BY e.status IN ('pending', 'assigned') DESC,
                IF(e.status IN ('pending', 'assigned'), e.priority = 'high', 0) DESC,
                IF(e.status IN ('pending', 'assigned'), e.created_at, NULL) ASC,
                e.created_at DESC, e.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset],
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM escalations e WHERE ${where.join(' AND ')}`, params);
    const [[counts]] = await pool.query(
      `SELECT COALESCE(SUM(status = 'pending'), 0) AS pending,
              COALESCE(SUM(status = 'assigned'), 0) AS assigned,
              COALESCE(SUM(status = 'assigned' AND assigned_to = ?), 0) AS mine,
              COALESCE(SUM(status = 'pending' AND created_at < NOW() - INTERVAL ${STALE_HOURS} HOUR), 0) AS stale
       FROM escalations`,
      [req.user.id],
    );
    return success(res, {
      ...paged(rows.map(toItem), total, pg),
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
    });
  } catch (err) {
    next(err);
  }
};

/** Detail + transkrip sesi (pesan pengguna sudah disamarkan PII-nya), maksimal 100 pesan terakhir. */
export const getEscalation = async (req, res, next) => {
  try {
    const row = await findEscalation(pool, parseId(req.params.id));
    const [messages] = await pool.query(
      `SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 100`,
      [row.session_id],
    );
    // U6: AgenSUSI yang menangani membuka tiket → pesan pengguna sampai saat ini dianggap terbaca.
    if (messages.length > 0 && Number(row.assigned_to) === Number(req.user.id)) {
      await pool.query(`UPDATE escalations SET agent_read_id = GREATEST(agent_read_id, ?) WHERE id = ?`, [messages[0].id, row.id]);
      row.unread = 0;
    }
    return success(res, { ...toItem(row), messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
};

export const claimEscalation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parseId(req.params.id);
    await conn.beginTransaction();
    const [[row]] = await conn.query(`SELECT id, status, assigned_to FROM escalations WHERE id = ? FOR UPDATE`, [id]);
    if (!row) throw new HttpError(404, 'Tiket eskalasi tidak ditemukan');
    const mine = row.status === 'assigned' && Number(row.assigned_to) === Number(req.user.id);
    if (!mine) {
      if (row.status === 'assigned') throw new HttpError(409, 'Tiket ini sudah diklaim AgenSUSI lain');
      if (row.status !== 'pending') throw new HttpError(409, 'Tiket ini sudah selesai');
      await conn.query(
        `UPDATE escalations SET status = 'assigned', assigned_to = ?, assigned_at = NOW() WHERE id = ?`,
        [req.user.id, id],
      );
      await audit(conn, { actorId: req.user.id, action: 'CLAIM_ESCALATION', entity: 'escalations', entityId: id });
    }
    await conn.commit();
    return success(res, toItem(await findEscalation(pool, id)), mine ? 'Tiket sudah Anda klaim' : 'Tiket diklaim');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** Balasan agen masuk ke sesi pengguna (role 'agent'); pengguna melihatnya lewat polling sesi. */
export const replyEscalation = async (req, res, next) => {
  try {
    const row = await findEscalation(pool, parseId(req.params.id));
    assertCanHandle(row, req.user);
    const content = req.body.message;
    const messageId = await addMessage(pool, row.session_id, 'agent', content);
    // Pengguna terdaftar juga diberi notifikasi; anonim mengandalkan polling sesi / kontak balik.
    await notify(pool, {
      userId: row.user_id, type: 'eskalasi', title: 'Balasan dari AgenSUSI', body: content, refType: 'escalation', refId: row.id,
    });
    const [[message]] = await pool.query(`SELECT id, role, content, created_at FROM chat_messages WHERE id = ?`, [messageId]);
    return created(res, { message }, 'Balasan terkirim');
  } catch (err) {
    next(err);
  }
};

/**
 * "Kembalikan ke AI" (U6): tiket selesai tanpa jawaban tuntas dari AgenSUSI (`handed_back`), sesi
 * pengguna kembali ke mode AI. Pesan agen (atau pesan bawaan) tampil di percakapan pengguna.
 */
export const handbackEscalation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parseId(req.params.id);
    await conn.beginTransaction();
    const [[row]] = await conn.query(`SELECT * FROM escalations WHERE id = ? FOR UPDATE`, [id]);
    if (!row) throw new HttpError(404, 'Tiket eskalasi tidak ditemukan');
    assertCanHandle(row, req.user, { allowPendingForAdmin: true });
    const content = req.body.message || HANDBACK_REPLY;
    await addMessage(conn, row.session_id, 'agent', content);
    await conn.query(
      `UPDATE escalations
       SET status = 'resolved', handed_back = 1, resolution = 'Dikembalikan ke asisten AI', resolved_at = NOW(),
           assigned_to = COALESCE(assigned_to, ?)
       WHERE id = ?`,
      [req.user.id, id],
    );
    await audit(conn, { actorId: req.user.id, action: 'HANDBACK_ESCALATION', entity: 'escalations', entityId: id });
    await notify(conn, {
      userId: row.user_id, type: 'eskalasi', title: 'AgenSUSI mengembalikan percakapan ke asisten AI', body: content,
      refType: 'escalation', refId: id,
    });
    await conn.commit();
    return success(res, toItem(await findEscalation(pool, id)), 'Percakapan dikembalikan ke asisten AI');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const clip = (text, max) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** Judul & kata kunci draft KB dari pertanyaan pengguna di sesi (bila liaison tidak mengisinya). */
async function draftKbFields(conn, sessionId, { title, keywords }) {
  const [turns] = await conn.query(`SELECT question FROM ask_logs WHERE session_id = ? ORDER BY id`, [sessionId]);
  const questions = turns.map((t) => displayQuestion(t.question)).filter(Boolean);
  const derivedKeywords = [...new Set(questions.flatMap((q) => queryTerms(q).map((t) => t.word)))].slice(0, 12);
  return {
    title: clip(title || questions.find((q) => queryTerms(q).length > 0) || 'Pertanyaan dari eskalasi', 200),
    keywords: clip((keywords?.length ? keywords : derivedKeywords).join(', ') || 'eskalasi', 500),
  };
}

export const resolveEscalation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parseId(req.params.id);
    const { outcome = 'resolved', resolution, save_as_kb: saveAsKb, kb_title: kbTitle, kb_keywords: kbKeywords } = req.body;
    await conn.beginTransaction();
    const [[row]] = await conn.query(`SELECT * FROM escalations WHERE id = ? FOR UPDATE`, [id]);
    if (!row) throw new HttpError(404, 'Tiket eskalasi tidak ditemukan');
    // Admin boleh menutup/menyelesaikan tiket pending (mis. spam) tanpa klaim.
    assertCanHandle(row, req.user, { allowPendingForAdmin: true });

    let kbEntryId = null;
    if (saveAsKb) {
      // Jalur peningkatan AI dari jawaban manusia: draft, tidak dipakai chatbot sampai admin menyetujui.
      const fields = await draftKbFields(conn, row.session_id, { title: kbTitle, keywords: kbKeywords });
      const [kb] = await conn.query(
        `INSERT INTO kb_entries (title, category, keywords, reply, audience, status, source, sort_order)
         VALUES (?, 'eskalasi', ?, ?, 'all', 'draft', ?, 1000)`,
        [fields.title, fields.keywords, resolution, `Eskalasi #${id} (jawaban AgenSUSI)`],
      );
      kbEntryId = kb.insertId;
    }
    await conn.query(
      `UPDATE escalations
       SET status = ?, resolution = ?, resolved_at = NOW(), kb_entry_id = ?, assigned_to = COALESCE(assigned_to, ?)
       WHERE id = ?`,
      [outcome, resolution, kbEntryId, req.user.id, id],
    );
    await audit(conn, {
      actorId: req.user.id,
      action: outcome === 'resolved' ? 'RESOLVE_ESCALATION' : 'CLOSE_ESCALATION',
      entity: 'escalations',
      entityId: id,
      meta: kbEntryId ? { kb_entry_id: kbEntryId } : null,
    });
    if (outcome === 'resolved') {
      await notify(conn, {
        userId: row.user_id, type: 'eskalasi', title: 'Permintaan bantuan Anda sudah diselesaikan', refType: 'escalation', refId: id,
      });
    }
    await conn.commit();
    return success(res, toItem(await findEscalation(pool, id)), outcome === 'resolved' ? 'Tiket diselesaikan' : 'Tiket ditutup');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
