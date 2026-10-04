import { pool } from '../config/db.js';
import { success, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';

export const getProfile = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT id, name, email, phone, bio, extra_info, avatar_url FROM users WHERE id = ?`,
      [req.user.id]
    );
    const [profiles] = await pool.query(
      `SELECT * FROM talent_profiles WHERE user_id = ?`,
      [req.user.id]
    );
    const [skills] = await pool.query(
      `SELECT s.id, s.name FROM talent_skills ts
       JOIN skills s ON s.id = ts.skill_id
       WHERE ts.talent_id = ?`,
      [req.user.id]
    );
    const [projects] = await pool.query(
      `SELECT p.id, n.title, n.category, p.status, p.progress_pct, p.created_at
       FROM projects p
       JOIN needs n ON n.id = p.need_id
       WHERE p.talent_id = ?
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 50`,
      [req.user.id]
    );

    return success(res, {
      user: users[0],
      profile: profiles[0] || { reputation_points: 0, level: 'TALENTA_MUDA', next_level_target: 20 },
      skills,
      projects,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bio, phone, extra_info, skills, skill_ids } = req.body;

    if (bio !== undefined || phone !== undefined || extra_info !== undefined) {
      const fields = [];
      const values = [];
      if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
      if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
      if (extra_info !== undefined) { fields.push('extra_info = ?'); values.push(extra_info); }
      values.push(req.user.id);
      await conn.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Daftar keahlian diganti utuh bila skill_ids (dari GET /api/skills) dan/atau skills
    // (nama; dibuat bila belum ada) dikirim.
    if (Array.isArray(skill_ids) || Array.isArray(skills)) {
      const ids = new Set();
      if (Array.isArray(skill_ids) && skill_ids.length > 0) {
        const [found] = await conn.query(`SELECT id FROM skills WHERE id IN (?)`, [skill_ids]);
        if (found.length !== skill_ids.length) {
          await conn.rollback();
          return fail(res, 'Ada keahlian yang tidak dikenal', 400);
        }
        found.forEach((s) => ids.add(s.id));
      }
      for (const name of skills || []) {
        await conn.query(`INSERT IGNORE INTO skills (name) VALUES (?)`, [name]);
        const [[row]] = await conn.query(`SELECT id FROM skills WHERE name = ?`, [name]);
        ids.add(row.id);
      }
      if (ids.size > 20) {
        await conn.rollback();
        return fail(res, 'Keahlian maksimal 20 item', 400);
      }

      await conn.query(`DELETE FROM talent_skills WHERE talent_id = ?`, [req.user.id]);
      if (ids.size > 0) {
        await conn.query(
          `INSERT INTO talent_skills (talent_id, skill_id) VALUES ?`,
          [[...ids].map((skillId) => [req.user.id, skillId])]
        );
      }
    }

    await conn.commit();

    const [skillRows] = await pool.query(
      `SELECT s.id, s.name FROM talent_skills ts JOIN skills s ON s.id = ts.skill_id
       WHERE ts.talent_id = ? ORDER BY s.name`,
      [req.user.id]
    );
    return success(res, { skills: skillRows }, 'Profil talenta diperbarui');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const getTopTalents = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const [rows] = await pool.query(
      `SELECT * FROM v_top_talents LIMIT ? OFFSET ?`,
      [pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM v_top_talents`);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

// Testimoni publik: sudah lolos moderasi dan tidak disembunyikan penerimanya.
export const getTestimonials = async (req, res, next) => {
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
      [req.params.id, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM testimonials t ${where}`, [req.params.id]);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};