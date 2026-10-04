import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const getMyProjects = async (req, res, next) => {
  try {
    const isTalent = req.user.role === 'talent';
    const where = isTalent
      ? `WHERE p.talent_id = ?`
      : `WHERE p.requester_id = ?`;

    const [rows] = await pool.query(
      `SELECT p.*, n.title AS project_title, n.category,
              c.name AS community_name,
              t.name AS talent_name
       FROM projects p
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       ${where}
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, n.title AS project_title, n.description AS project_description,
              n.category, c.name AS community_name,
              t.name AS talent_name, r.name AS requester_name
       FROM projects p
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       LEFT JOIN users r ON r.id = p.requester_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Proyek tidak ditemukan', 404);

    const project = rows[0];

    // Akses: hanya talent, requester, atau admin
    if (
      req.user.role !== 'admin' &&
      project.talent_id !== req.user.id &&
      project.requester_id !== req.user.id
    ) {
      return fail(res, 'Akses ditolak', 403);
    }

    const [deliveries] = await pool.query(
      `SELECT * FROM project_deliveries WHERE project_id = ? ORDER BY round_no DESC`,
      [project.id]
    );
    const [events] = await pool.query(
      `SELECT * FROM project_events WHERE project_id = ? ORDER BY created_at DESC`,
      [project.id]
    );
    const [revisions] = await pool.query(
      `SELECT pr.*, u.name AS requested_by_name
       FROM project_revisions pr
       LEFT JOIN users u ON u.id = pr.requested_by
       WHERE pr.project_id = ? ORDER BY pr.requested_at DESC`,
      [project.id]
    );

    return success(res, { ...project, deliveries, events, revisions });
  } catch (err) {
    next(err);
  }
};

export const agreeProject = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM projects WHERE id = ? AND talent_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return fail(res, 'Proyek tidak ditemukan', 404);

    const project = rows[0];
    if (project.status !== 'AGREEMENT') {
      return fail(res, `Proyek tidak bisa disetujui (status: ${project.status})`, 400);
    }

    await pool.query(
      `UPDATE projects SET status = 'IN_PROGRESS', progress_pct = 10,
        agreed_by_talent_at = NOW(), started_at = NOW()
       WHERE id = ?`,
      [project.id]
    );

    await pool.query(
      `INSERT INTO project_events (project_id, actor_id, event_type, label)
       VALUES (?, ?, 'STARTED', 'Talenta menyetujui dan mulai mengerjakan')`,
      [project.id, req.user.id]
    );

    const [updated] = await pool.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
    return success(res, updated[0], 'Proyek dimulai');
  } catch (err) {
    next(err);
  }
};

export const submitDelivery = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM projects WHERE id = ? AND talent_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan', 404);
    }

    const project = rows[0];
    if (!['IN_PROGRESS', 'REVISION'].includes(project.status)) {
      await conn.rollback();
      return fail(res, 'Proyek tidak bisa dikirim saat ini', 400);
    }

    const { file_name, file_path, file_size, link_url } = req.body;
    if (!file_name && !link_url) {
      await conn.rollback();
      return fail(res, 'File atau tautan wajib diisi', 400);
    }

    // Hitung round
    const [[{ maxRound }]] = await conn.query(
      `SELECT COALESCE(MAX(round_no), 0) AS maxRound FROM project_deliveries WHERE project_id = ?`,
      [project.id]
    );

    await conn.query(
      `INSERT INTO project_deliveries (project_id, round_no, file_name, file_path, file_size, link_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [project.id, maxRound + 1, file_name || null, file_path || null, file_size || null, link_url || null]
    );

    // Tandai selesai → AWAITING_VERIFICATION
    await conn.query(
      `UPDATE projects SET status = 'AWAITING_VERIFICATION', progress_pct = 90,
        talent_marked_done_at = NOW()
       WHERE id = ?`,
      [project.id]
    );

    await conn.query(
      `INSERT INTO project_events (project_id, actor_id, event_type, label)
       VALUES (?, ?, 'DELIVERED', 'Talenta menandai proyek selesai')`,
      [project.id, req.user.id]
    );

    // Notif ke requester
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES (?, 'verifikasi', 'Proyek menunggu verifikasi', 'Talenta telah menandai proyek selesai', 'project', ?)`,
      [project.requester_id, project.id]
    );

    await conn.commit();

    const [updated] = await conn.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
    return success(res, updated[0], 'Hasil proyek dikirim, menunggu verifikasi komunitas');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const verifyProject = async (req, res, next) => {
  try {
    const { testimonial } = req.body;

    // Pakai stored procedure yang sudah ada
    await pool.query(
      `CALL sp_verify_project(?, ?, ?)`,
      [req.params.id, req.user.id, testimonial || null]
    );

    const [rows] = await pool.query(`SELECT * FROM projects WHERE id = ?`, [req.params.id]);
    return success(res, rows[0], 'Proyek terverifikasi, reputasi talenta +1');
  } catch (err) {
    if (err.sqlState === '45000') {
      return fail(res, err.message, 400);
    }
    next(err);
  }
};

export const requestRevision = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM projects WHERE id = ? AND requester_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan', 404);
    }

    const project = rows[0];
    if (project.status !== 'AWAITING_VERIFICATION') {
      await conn.rollback();
      return fail(res, 'Revisi hanya bisa diminta setelah talenta menandai selesai', 400);
    }

    const { note } = req.body;
    if (!note || !note.trim()) {
      await conn.rollback();
      return fail(res, 'Catatan revisi wajib diisi', 400);
    }

    // Ambil delivery terakhir
    const [deliveries] = await conn.query(
      `SELECT id FROM project_deliveries WHERE project_id = ? ORDER BY round_no DESC LIMIT 1`,
      [project.id]
    );

    await conn.query(
      `INSERT INTO project_revisions (project_id, delivery_id, note, requested_by)
       VALUES (?, ?, ?, ?)`,
      [project.id, deliveries[0]?.id || null, note.trim(), req.user.id]
    );

    await conn.query(
      `UPDATE projects SET status = 'REVISION', progress_pct = GREATEST(progress_pct - 20, 30)
       WHERE id = ?`,
      [project.id]
    );

    await conn.query(
      `INSERT INTO project_events (project_id, actor_id, event_type, label)
       VALUES (?, ?, 'REVISION_REQUESTED', 'Komunitas meminta revisi')`,
      [project.id, req.user.id]
    );

    await conn.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES (?, 'sistem', 'Revisi diminta', 'Komunitas meminta revisi pada proyek Anda', 'project', ?)`,
      [project.talent_id, project.id]
    );

    await conn.commit();

    const [updated] = await conn.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
    return success(res, updated[0], 'Revisi diminta');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const openDispute = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(`SELECT * FROM projects WHERE id = ?`, [req.params.id]);
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan', 404);
    }

    const project = rows[0];
    if (project.talent_id !== req.user.id && project.requester_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return fail(res, 'Akses ditolak', 403);
    }

    const { summary, statement } = req.body;
    if (!summary) {
      await conn.rollback();
      return fail(res, 'Ringkasan sengketa wajib diisi', 400);
    }

    const [existing] = await conn.query(
      `SELECT id FROM disputes WHERE project_id = ? AND status <> 'SELESAI'`,
      [project.id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return fail(res, 'Sengketa sudah dibuka untuk proyek ini', 409);
    }

    const isTalent = project.talent_id === req.user.id;

    await conn.query(
      `INSERT INTO disputes (project_id, status, summary, statement_community, statement_talent)
       VALUES (?, 'MEDIASI', ?, ?, ?)`,
      [
        project.id,
        summary.trim(),
        isTalent ? null : statement || null,
        isTalent ? statement || null : null,
      ]
    );

    await conn.query(
      `UPDATE projects SET status = 'DISPUTED' WHERE id = ?`,
      [project.id]
    );

    await conn.query(
      `INSERT INTO project_events (project_id, actor_id, event_type, label)
       VALUES (?, ?, 'DISPUTED', 'Sengketa dibuka')`,
      [project.id, req.user.id]
    );

    await conn.commit();
    return created(res, null, 'Sengketa dibuka, menunggu mediasi admin');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};