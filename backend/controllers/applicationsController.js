import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const getMyApplications = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, n.title, n.category, c.name AS community_name
       FROM applications a
       JOIN needs n ON n.id = a.need_id
       LEFT JOIN communities c ON c.id = n.community_id
       WHERE a.talent_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getApplicationsForNeed = async (req, res, next) => {
  try {
    const [need] = await pool.query(
      `SELECT * FROM needs WHERE id = ? AND requester_id = ?`,
      [req.params.needId, req.user.id]
    );
    if (!need[0]) return fail(res, 'Kebutuhan tidak ditemukan', 404);

    const [rows] = await pool.query(
      `SELECT a.*, u.name AS talent_name, u.email, u.bio, u.extra_info,
              tp.reputation_points, tp.level
       FROM applications a
       JOIN users u ON u.id = a.talent_id
       LEFT JOIN talent_profiles tp ON tp.user_id = u.id
       WHERE a.need_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.needId]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const apply = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [needs] = await conn.query(
      `SELECT * FROM needs WHERE id = ? AND moderation_status = 'APPROVED' AND status = 'OPEN'`,
      [req.params.needId]
    );
    if (!needs[0]) {
      await conn.rollback();
      return fail(res, 'Kebutuhan tidak tersedia', 404);
    }

    const need = needs[0];

    // Cek duplikasi
    const [existing] = await conn.query(
      `SELECT id FROM applications WHERE need_id = ? AND talent_id = ?`,
      [need.id, req.user.id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return fail(res, 'Anda sudah melamar kebutuhan ini', 409);
    }

    // Cek apakah sudah ada proyek aktif untuk need ini
    const [project] = await conn.query(
      `SELECT id FROM projects WHERE need_id = ? AND status NOT IN ('COMPLETED','CANCELLED')`,
      [need.id]
    );
    if (project.length > 0) {
      await conn.rollback();
      return fail(res, 'Kebutuhan ini sudah memiliki talenta', 409);
    }

    const { message } = req.body;

    const [result] = await conn.query(
      `INSERT INTO applications (need_id, talent_id, message) VALUES (?, ?, ?)`,
      [need.id, req.user.id, message || null]
    );

    await conn.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES (?, 'talenta', 'Lamaran baru', 'Ada talenta yang melamar kebutuhan Anda', 'need', ?)`,
      [need.requester_id, need.id]
    );

    await conn.commit();

    const [rows] = await conn.query(
      `SELECT * FROM applications WHERE id = ?`,
      [result.insertId]
    );
    return created(res, rows[0], 'Lamaran terkirim');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const decide = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [apps] = await conn.query(
      `SELECT a.*, n.requester_id, n.title AS need_title, n.community_id
       FROM applications a
       JOIN needs n ON n.id = a.need_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!apps[0]) {
      await conn.rollback();
      return fail(res, 'Lamaran tidak ditemukan', 404);
    }

    const app = apps[0];
    if (app.requester_id !== req.user.id) {
      await conn.rollback();
      return fail(res, 'Akses ditolak', 403);
    }

    const { decision, scope, done_definition, deadline } = req.body;
    if (!['DITERIMA', 'DITOLAK'].includes(decision)) {
      await conn.rollback();
      return fail(res, 'Keputusan tidak valid', 400);
    }

    await conn.query(
      `UPDATE applications SET status = ?, decided_at = NOW() WHERE id = ?`,
      [decision, app.id]
    );

    if (decision === 'DITERIMA') {
      // Tolak lamaran lain untuk need yang sama
      await conn.query(
        `UPDATE applications SET status = 'DITOLAK', decided_at = NOW()
         WHERE need_id = ? AND id <> ? AND status = 'MENUNGGU'`,
        [app.need_id, app.id]
      );

      // Ambil data need
      const [needs] = await conn.query(`SELECT * FROM needs WHERE id = ?`, [app.need_id]);
      const need = needs[0];

      // Buat proyek
      const [projRes] = await conn.query(
        `INSERT INTO projects
          (need_id, community_id, requester_id, talent_id, application_id,
           scope, done_definition, deadline, status, progress_pct, agreed_by_community_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AGREEMENT', 5, NOW())`,
        [
          app.need_id,
          need.community_id,
          req.user.id,
          app.talent_id,
          app.id,
          scope || need.description,
          done_definition || null,
          deadline || null,
        ]
      );

      // Update status need
      await conn.query(
        `UPDATE needs SET status = 'IN_PROGRESS' WHERE id = ?`,
        [app.need_id]
      );

      await conn.query(
        `INSERT INTO project_events (project_id, actor_id, event_type, label)
         VALUES (?, ?, 'CREATED', 'Proyek dibuat dari lamaran yang diterima')`,
        [projRes.insertId, req.user.id]
      );

      await conn.query(
        `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
         VALUES (?, 'talenta', 'Lamaran diterima', 'Lamaran Anda diterima, silakan tinjau kesepakatan', 'project', ?)`,
        [app.talent_id, projRes.insertId]
      );
    } else {
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
         VALUES (?, 'talenta', 'Lamaran ditolak', 'Lamaran Anda belum diterima kali ini', 'application', ?)`,
        [app.talent_id, app.id]
      );
    }

    await conn.commit();
    return success(res, null, `Lamaran ${decision.toLowerCase()}`);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};