import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { assertCommunityAccess, communityManagers } from '../utils/communityAccess.js';
import { notify } from '../utils/activity.js';

const CATEGORIES = ['DISKUSI', 'TANYA', 'INFO'];
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
// U1: topik dipajang 7 hari bila tidak dipilih; NULL (topik lama) = tanpa batas.
const DEFAULT_DURATION_DAYS = 7;

/**
 * Hak atas topik: pemilik boleh memperpanjang & menghapus; pengurus komunitas terkait dan admin
 * boleh menghapus (moderasi papan).
 */
async function topicPermissions(conn, user, topic) {
  const isOwner = Number(topic.author_id) === Number(user.id);
  const isManager = topic.community_id ? (await communityManagers(conn, topic.community_id)).includes(Number(user.id)) : false;
  return { can_extend: isOwner, can_delete: isOwner || isManager || user.role === 'admin' };
}

export const listTopics = async (req, res, next) => {
  try {
    const { community_id, category } = req.query;
    const pg = parsePagination(req.query, { defaultLimit: 50 });
    let where = `WHERE dt.deleted_at IS NULL AND (dt.expires_at IS NULL OR dt.expires_at > NOW())`;
    const params = [];

    if (community_id) { where += ` AND dt.community_id = ?`; params.push(community_id); }
    if (category) { where += ` AND dt.category = ?`; params.push(category); }

    const [rows] = await pool.query(
      `SELECT dt.*, u.name AS author_name, c.name AS community_name,
        (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.topic_id = dt.id) AS replies_count
       FROM discussion_topics dt
       JOIN users u ON u.id = dt.author_id
       LEFT JOIN communities c ON c.id = dt.community_id
       ${where}
       ORDER BY dt.created_at DESC, dt.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM discussion_topics dt ${where}`, params);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

export const getTopic = async (req, res, next) => {
  try {
    // Topik yang masa pajangnya lewat hilang dari papan, tetapi tautan langsung (mis. notifikasi
    // balasan) tetap bisa dibuka; `expired` memberi tahu FE.
    const [rows] = await pool.query(
      `SELECT dt.*, u.name AS author_name, c.name AS community_name,
         (dt.expires_at IS NOT NULL AND dt.expires_at <= NOW()) AS expired
       FROM discussion_topics dt
       JOIN users u ON u.id = dt.author_id
       LEFT JOIN communities c ON c.id = dt.community_id
       WHERE dt.id = ? AND dt.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Topik tidak ditemukan', 404);

    const [replies] = await pool.query(
      `SELECT dr.*, u.name AS author_name, cm.name AS community_name
       FROM discussion_replies dr
       JOIN users u ON u.id = dr.author_id
       LEFT JOIN communities cm ON cm.id = dr.community_id
       WHERE dr.topic_id = ?
       ORDER BY dr.created_at ASC, dr.id ASC`,
      [req.params.id]
    );

    const isAdmin = req.user.role === 'admin';
    return success(res, {
      ...rows[0],
      ...(await topicPermissions(pool, req.user, rows[0])),
      expired: Boolean(rows[0].expired),
      replies: replies.map((r) => ({ ...r, can_delete: isAdmin || Number(r.author_id) === Number(req.user.id) })),
    });
  } catch (err) {
    next(err);
  }
};

export const createTopic = async (req, res, next) => {
  try {
    const { community_id, category, text, pos_x, pos_y, rotation, color, duration_days } = req.body;
    if (typeof text !== 'string' || !text.trim()) return fail(res, 'Isi topik wajib diisi', 400);
    if (text.trim().length > 1000) return fail(res, 'Isi topik maksimal 1000 karakter', 400);
    if (category !== undefined && !CATEGORIES.includes(category)) {
      return fail(res, `Kategori harus salah satu dari: ${CATEGORIES.join(', ')}`, 400);
    }
    if (color !== undefined && !COLOR_RE.test(String(color))) return fail(res, 'Warna harus format #RRGGBB', 400);

    // Hanya anggota komunitas (atau liaison/admin) yang boleh menulis atas nama komunitas.
    const communityId = await assertCommunityAccess(pool, req.user, community_id);

    const clampInt = (value, fallback, min, max) => {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
    };

    const [result] = await pool.query(
      `INSERT INTO discussion_topics
        (author_id, community_id, category, text, pos_x, pos_y, rotation, color, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? DAY)`,
      [
        req.user.id, communityId, category || 'DISKUSI', text.trim(),
        clampInt(pos_x, 100, 0, 32767), clampInt(pos_y, 100, 0, 32767),
        clampInt(rotation, 0, -45, 45), color || '#fdfcf7', duration_days ?? DEFAULT_DURATION_DAYS,
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM discussion_topics WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Topik dibuat');
  } catch (err) {
    next(err);
  }
};

export const createReply = async (req, res, next) => {
  try {
    const [topic] = await pool.query(
      `SELECT * FROM discussion_topics WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!topic[0]) return fail(res, 'Topik tidak ditemukan', 404);

    const { text, community_id } = req.body;
    if (typeof text !== 'string' || !text.trim()) return fail(res, 'Balasan wajib diisi', 400);
    if (text.trim().length > 1000) return fail(res, 'Balasan maksimal 1000 karakter', 400);

    const communityId = await assertCommunityAccess(pool, req.user, community_id);

    const [result] = await pool.query(
      `INSERT INTO discussion_replies (topic_id, author_id, community_id, text)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, req.user.id, communityId, text.trim()]
    );

    // Beri tahu pemilik topik (kecuali membalas topik sendiri); notify() menghormati notif_diskusi.
    const author = topic[0].author_id;
    if (Number(author) !== Number(req.user.id)) {
      await notify(pool, {
        userId: author, type: 'diskusi', title: 'Balasan baru di topik Anda',
        body: text.trim(), refType: 'topic', refId: topic[0].id,
      });
    }

    const [rows] = await pool.query(`SELECT * FROM discussion_replies WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Balasan dikirim');
  } catch (err) {
    next(err);
  }
};

// Posisi catatan di papan mading disimpan saat digeser (hanya oleh penulisnya).
export const updatePosition = async (req, res, next) => {
  try {
    const { pos_x, pos_y, rotation } = req.body;
    const [result] = await pool.query(
      `UPDATE discussion_topics SET pos_x = ?, pos_y = ?, rotation = COALESCE(?, rotation)
       WHERE id = ? AND author_id = ? AND deleted_at IS NULL`,
      [pos_x, pos_y, rotation ?? null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      const [exists] = await pool.query(`SELECT id FROM discussion_topics WHERE id = ? AND deleted_at IS NULL`, [req.params.id]);
      return exists[0]
        ? fail(res, 'Hanya penulis topik yang bisa memindahkan catatannya', 403)
        : fail(res, 'Topik tidak ditemukan', 404);
    }
    const [rows] = await pool.query(`SELECT id, pos_x, pos_y, rotation FROM discussion_topics WHERE id = ?`, [req.params.id]);
    return success(res, rows[0], 'Posisi tersimpan');
  } catch (err) {
    next(err);
  }
};

const findTopic = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM discussion_topics WHERE id = ? AND deleted_at IS NULL`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Topik tidak ditemukan');
  return rows[0];
};

/** Perpanjang masa pajang (pemilik): dari batas sekarang, atau dari saat ini bila sudah lewat. */
export const extendTopic = async (req, res, next) => {
  try {
    const topic = await findTopic(req.params.id);
    if (Number(topic.author_id) !== Number(req.user.id)) throw new HttpError(403, 'Hanya penulis topik yang bisa memperpanjangnya');
    if (topic.expires_at === null) throw new HttpError(400, 'Topik ini dipajang tanpa batas waktu');
    await pool.query(
      `UPDATE discussion_topics SET expires_at = GREATEST(expires_at, NOW()) + INTERVAL ? DAY WHERE id = ?`,
      [req.body.duration_days, topic.id]
    );
    const [rows] = await pool.query(`SELECT id, expires_at FROM discussion_topics WHERE id = ?`, [topic.id]);
    return success(res, rows[0], 'Masa pajang diperpanjang');
  } catch (err) {
    next(err);
  }
};

/** Hapus topik (soft delete): pemilik, pengurus komunitas terkait, atau admin. */
export const deleteTopic = async (req, res, next) => {
  try {
    const topic = await findTopic(req.params.id);
    if (!(await topicPermissions(pool, req.user, topic)).can_delete) {
      throw new HttpError(403, 'Hanya penulis, pengurus komunitasnya, atau admin yang bisa menghapus topik ini');
    }
    await pool.query(`UPDATE discussion_topics SET deleted_at = NOW() WHERE id = ?`, [topic.id]);
    return success(res, { id: topic.id }, 'Topik dihapus dari mading');
  } catch (err) {
    next(err);
  }
};

/** Hapus balasan: penulisnya (atau admin). */
export const deleteReply = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT id, author_id FROM discussion_replies WHERE id = ?`, [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'Balasan tidak ditemukan');
    if (Number(rows[0].author_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      throw new HttpError(403, 'Hanya penulis balasan yang bisa menghapusnya');
    }
    await pool.query(`DELETE FROM discussion_replies WHERE id = ?`, [rows[0].id]);
    return success(res, { id: rows[0].id }, 'Balasan dihapus');
  } catch (err) {
    next(err);
  }
};
