import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { getNeedOwnerId } from '../utils/ownership.js';

const MAX_TEXT = 1000;

export const getMyTestimonials = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const [rows] = await pool.query(
      `SELECT t.*, p.id AS project_id, n.title AS project_title,
              u.name AS from_name
       FROM testimonials t
       JOIN projects p ON p.id = t.project_id
       JOIN needs n ON n.id = p.need_id
       JOIN users u ON u.id = t.from_user_id
       WHERE t.to_user_id = ?
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM testimonials WHERE to_user_id = ?`,
      [req.user.id]
    );
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

export const getPublicTestimonials = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const where = `WHERE t.to_user_id = ? AND t.moderation_status = 'APPROVED' AND t.is_public = 1`;
    const [rows] = await pool.query(
      `SELECT t.*, p.id AS project_id, n.title AS project_title,
              u.name AS from_name
       FROM testimonials t
       JOIN projects p ON p.id = t.project_id
       JOIN needs n ON n.id = p.need_id
       JOIN users u ON u.id = t.from_user_id
       ${where}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [req.params.userId, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM testimonials t ${where}`, [req.params.userId]);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

// Testimoni manual (di luar alur verifikasi) masuk antrean moderasi sebelum tayang.
export const createTestimonial = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { project_id, to_user_id, text, is_public } = req.body;
    if (!project_id || !to_user_id || typeof text !== 'string' || !text.trim()) {
      await conn.rollback();
      return fail(res, 'project_id, to_user_id, dan text wajib diisi', 400);
    }
    if (text.trim().length > MAX_TEXT) {
      await conn.rollback();
      return fail(res, `Testimoni maksimal ${MAX_TEXT} karakter`, 400);
    }

    // Pastikan user terlibat di proyek
    const [projects] = await conn.query(
      `SELECT p.*, n.requester_id AS need_requester_id, n.created_by AS need_created_by
       FROM projects p JOIN needs n ON n.id = p.need_id
       WHERE p.id = ? AND p.status = 'COMPLETED'`,
      [project_id]
    );
    if (!projects[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan atau belum selesai', 404);
    }

    const proj = projects[0];
    const ownerId = Number(getNeedOwnerId({ requester_id: proj.need_requester_id, created_by: proj.need_created_by }));
    const talentId = Number(proj.talent_id);
    const me = Number(req.user.id);
    if (me !== talentId && me !== ownerId) {
      await conn.rollback();
      return fail(res, 'Anda tidak terlibat di proyek ini', 403);
    }

    // Testimoni hanya untuk pihak lawan di proyek yang sama.
    const counterpart = me === talentId ? ownerId : talentId;
    if (Number(to_user_id) !== counterpart) {
      await conn.rollback();
      return fail(res, 'Testimoni hanya bisa diberikan kepada pihak lawan di proyek ini', 400);
    }

    const [result] = await conn.query(
      `INSERT INTO testimonials (project_id, from_user_id, to_user_id, text, is_public, moderation_status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [proj.id, me, counterpart, text.trim(), is_public === undefined || is_public ? 1 : 0]
    );

    await conn.query(
      `INSERT INTO moderation_items (item_type, ref_id, title, submitted_by, source, decision)
       VALUES ('TESTIMONI', ?, ?, ?, ?, 'PENDING')`,
      [result.insertId, text.trim().substring(0, 100), me, req.user.role === 'liaison' ? 'AGENSUSI' : 'MANDIRI']
    );

    await conn.commit();

    const [rows] = await pool.query(`SELECT * FROM testimonials WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Testimoni dikirim, menunggu moderasi');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 'Anda sudah memberi testimoni untuk proyek ini', 409);
    }
    next(err);
  } finally {
    conn.release();
  }
};
