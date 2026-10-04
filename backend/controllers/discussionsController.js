import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const listTopics = async (req, res, next) => {
  try {
    const { community_id, category } = req.query;
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
       ORDER BY dt.created_at DESC`,
      params
    );
    return success(res, rows);
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
       ORDER BY dr.created_at ASC`,
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
    if (!text || !text.trim()) return fail(res, 'Isi topik wajib diisi', 400);

    const [result] = await pool.query(
      `INSERT INTO discussion_topics
        (author_id, community_id, category, text, pos_x, pos_y, rotation, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, community_id || null, category || 'DISKUSI',
        text.trim(), pos_x || 100, pos_y || 100, rotation || 0, color || '#fdfcf7',
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
    if (!text || !text.trim()) return fail(res, 'Balasan wajib diisi', 400);

    const [result] = await pool.query(
      `INSERT INTO discussion_replies (topic_id, author_id, community_id, text)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, req.user.id, community_id || null, text.trim()]
    );

    const [rows] = await pool.query(`SELECT * FROM discussion_replies WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Balasan dikirim');
  } catch (err) {
    next(err);
  }
};