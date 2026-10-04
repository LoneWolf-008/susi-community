import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const getMyTestimonials = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, p.id AS project_id, n.title AS project_title,
              u.name AS from_name
       FROM testimonials t
       JOIN projects p ON p.id = t.project_id
       JOIN needs n ON n.id = p.need_id
       JOIN users u ON u.id = t.from_user_id
       WHERE t.to_user_id = ?
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getPublicTestimonials = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, p.id AS project_id, n.title AS project_title,
              u.name AS from_name
       FROM testimonials t
       JOIN projects p ON p.id = t.project_id
       JOIN needs n ON n.id = p.need_id
       JOIN users u ON u.id = t.from_user_id
       WHERE t.to_user_id = ? AND t.moderation_status = 'APPROVED' AND t.is_public = 1
       ORDER BY t.created_at DESC`,
      [req.params.userId]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const createTestimonial = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { project_id, to_user_id, text, is_public } = req.body;
    if (!project_id || !to_user_id || !text) {
      await conn.rollback();
      return fail(res, 'project_id, to_user_id, dan text wajib diisi', 400);
    }

    // Pastikan user terlibat di proyek
    const [projects] = await conn.query(
      `SELECT * FROM projects WHERE id = ? AND status = 'COMPLETED'`,
      [project_id]
    );
    if (!projects[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan atau belum selesai', 404);
    }

    const proj = projects[0];
    if (proj.talent_id !== req.user.id && proj.requester_id !== req.user.id) {
      await conn.rollback();
      return fail(res, 'Anda tidak terlibat di proyek ini', 403);
    }

    const [result] = await conn.query(
      `INSERT INTO testimonials (project_id, from_user_id, to_user_id, text, is_public)
       VALUES (?, ?, ?, ?, ?)`,
      [project_id, req.user.id, to_user_id, text.trim(), is_public ? 1 : 1]
    );

    // Catat ke moderation_items
    await conn.query(
      `INSERT INTO moderation_items (item_type, ref_id, title, submitted_by, source, decision)
       VALUES ('TESTIMONI', ?, ?, ?, 'MANDIRI', 'APPROVED')`,
      [result.insertId, text.trim().substring(0, 100), req.user.id]
    );

    await conn.commit();

    const [rows] = await conn.query(`SELECT * FROM testimonials WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Testimoni dikirim');
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