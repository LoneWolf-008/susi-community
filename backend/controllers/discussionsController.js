import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { assertCommunityAccess } from '../utils/communityAccess.js';

const CATEGORIES = ['DISKUSI', 'TANYA', 'INFO'];
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const listTopics = async (req, res, next) => {
  try {
    const { community_id, category } = req.query;
    const pg = parsePagination(req.query, { defaultLimit: 50 });
    let where = `WHERE dt.deleted_at IS NULL`;
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
    const [rows] = await pool.query(
      `SELECT dt.*, u.name AS author_name, c.name AS community_name
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

    return success(res, { ...rows[0], replies });
  } catch (err) {
    next(err);
  }
};

export const createTopic = async (req, res, next) => {
  try {
    const { community_id, category, text, pos_x, pos_y, rotation, color } = req.body;
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
        (author_id, community_id, category, text, pos_x, pos_y, rotation, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, communityId, category || 'DISKUSI', text.trim(),
        clampInt(pos_x, 100, 0, 32767), clampInt(pos_y, 100, 0, 32767),
        clampInt(rotation, 0, -45, 45), color || '#fdfcf7',
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

    const [rows] = await pool.query(`SELECT * FROM discussion_replies WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Balasan dikirim');
  } catch (err) {
    next(err);
  }
};
