import { pool } from '../config/db.js';
import { success, fail } from '../utils/response.js';

export const getStats = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM v_platform_stats`);
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
};

export const getModerationQueue = async (req, res, next) => {
  try {
    const { item_type, decision } = req.query;
    let where = `WHERE 1=1`;
    const params = [];

    if (item_type) { where += ` AND mi.item_type = ?`; params.push(item_type); }
    if (decision) { where += ` AND mi.decision = ?`; params.push(decision); }

    const [rows] = await pool.query(
      `SELECT mi.*, u.name AS submitter_name, r.name AS reviewer_name
       FROM moderation_items mi
       LEFT JOIN users u ON u.id = mi.submitted_by
       LEFT JOIN users r ON r.id = mi.reviewed_by
       ${where}
       ORDER BY mi.created_at DESC`,
      params
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const decideModeration = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [items] = await conn.query(
      `SELECT * FROM moderation_items WHERE id = ?`,
      [req.params.id]
    );
    if (!items[0]) {
      await conn.rollback();
      return fail(res, 'Item tidak ditemukan', 404);
    }

    const item = items[0];
    const { decision, reject_reason, checklist_layak, checklist_kategori } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      await conn.rollback();
      return fail(res, 'Keputusan tidak valid', 400);
    }

    if (decision === 'REJECTED' && !reject_reason) {
      await conn.rollback();
      return fail(res, 'Alasan penolakan wajib diisi', 400);
    }

    await conn.query(
      `UPDATE moderation_items SET
        decision = ?, reject_reason = ?,
        checklist_layak = ?, checklist_kategori = ?,
        reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [
        decision, reject_reason || null,
        checklist_layak ? 1 : 0, checklist_kategori ? 1 : 0,
        req.user.id, item.id,
      ]
    );

    // Update status entitas terkait
    const newStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    if (item.item_type === 'KEBUTUHAN') {
      await conn.query(
        `UPDATE needs SET moderation_status = ?, reject_reason = ? WHERE id = ?`,
        [newStatus, reject_reason || null, item.ref_id]
      );
    } else if (item.item_type === 'TESTIMONI') {
      await conn.query(
        `UPDATE testimonials SET moderation_status = ? WHERE id = ?`,
        [newStatus, item.ref_id]
      );
    }

    await conn.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title, meta)
       VALUES (?, 'MODERATE', 'moderation_items', ?, ?, ?)`,
      [
        req.user.id, item.id, item.title,
        JSON.stringify({ decision, reject_reason }),
      ]
    );

    await conn.commit();
    return success(res, null, `Item ${decision.toLowerCase()}`);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const getDisputes = async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = `WHERE 1=1`;
    const params = [];
    if (status) { where += ` AND d.status = ?`; params.push(status); }

    const [rows] = await pool.query(
      `SELECT d.*, n.title AS project_title, c.name AS community_name,
              t.name AS talent_name, a.name AS decided_by_name
       FROM disputes d
       JOIN projects p ON p.id = d.project_id
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       LEFT JOIN users a ON a.id = d.decided_by
       ${where}
       ORDER BY d.opened_at DESC`,
      params
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getDisputeById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, p.id AS project_id, n.title AS project_title,
              c.name AS community_name, t.name AS talent_name,
              p.requester_id, p.talent_id
       FROM disputes d
       JOIN projects p ON p.id = d.project_id
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Sengketa tidak ditemukan', 404);

    const [events] = await pool.query(
      `SELECT * FROM dispute_events WHERE dispute_id = ? ORDER BY created_at ASC`,
      [req.params.id]
    );
    const [messages] = await pool.query(
      `SELECT am.*, u.name AS sender_name
       FROM admin_messages am
       JOIN users u ON u.id = am.sender_id
       WHERE am.target_type = 'DISPUTE' AND am.target_id = ?
       ORDER BY am.sent_at ASC`,
      [req.params.id]
    );

    return success(res, { ...rows[0], events, messages });
  } catch (err) {
    next(err);
  }
};

export const resolveDispute = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(`SELECT * FROM disputes WHERE id = ?`, [req.params.id]);
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Sengketa tidak ditemukan', 404);
    }

    const dispute = rows[0];
    const { decision, statement_admin } = req.body;

    if (!['MARK_COMPLETE', 'EXTEND_7_DAYS'].includes(decision)) {
      await conn.rollback();
      return fail(res, 'Keputusan tidak valid', 400);
    }

    await conn.query(
      `UPDATE disputes SET status = 'SELESAI', decision = ?, decided_by = ?, decided_at = NOW()
       WHERE id = ?`,
      [decision, req.user.id, dispute.id]
    );

    const [project] = await conn.query(`SELECT * FROM projects WHERE id = ?`, [dispute.project_id]);

    if (decision === 'MARK_COMPLETE') {
      // Paksa selesai — panggil stored procedure
      await conn.query(
        `CALL sp_verify_project(?, ?, ?)`,
        [dispute.project_id, req.user.id, statement_admin || 'Diselesaikan oleh admin setelah mediasi']
      );
    } else {
      // Perpanjang 7 hari
      await conn.query(
        `UPDATE projects SET status = 'IN_PROGRESS', deadline = DATE_ADD(COALESCE(deadline, NOW()), INTERVAL 7 DAY)
         WHERE id = ?`,
        [dispute.project_id]
      );
    }

    await conn.query(
      `INSERT INTO dispute_events (dispute_id, label) VALUES (?, ?)`,
      [dispute.id, `Admin memutuskan: ${decision}`]
    );

    // Notif ke kedua pihak
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES (?, 'sengketa', 'Sengketa diselesaikan', 'Admin telah memberikan keputusan', 'dispute', ?)`,
      [project[0].requester_id, dispute.id]
    );
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES (?, 'sengketa', 'Sengketa diselesaikan', 'Admin telah memberikan keputusan', 'dispute', ?)`,
      [project[0].talent_id, dispute.id]
    );

    await conn.commit();
    return success(res, null, 'Sengketa diselesaikan');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { body, target_type, target_id } = req.body;
    if (!body || !body.trim()) return fail(res, 'Pesan wajib diisi', 400);

    const [result] = await pool.query(
      `INSERT INTO admin_messages (sender_id, target_type, target_id, body)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, target_type || 'DISPUTE', target_id || req.params.id, body.trim()]
    );

    const [rows] = await pool.query(`SELECT * FROM admin_messages WHERE id = ?`, [result.insertId]);
    return success(rows, rows[0], 'Pesan terkirim');
  } catch (err) {
    next(err);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    let where = `WHERE u.deleted_at IS NULL`;
    const params = [];

    if (role) { where += ` AND u.role = ?`; params.push(role); }
    if (status) { where += ` AND u.status = ?`; params.push(status); }
    if (search) {
      where += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.created_at, u.last_login_at,
              tp.reputation_points, tp.level
       FROM users u
       LEFT JOIN talent_profiles tp ON tp.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC`,
      params
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['AKTIF', 'DITANGGUHKAN'].includes(status)) {
      return fail(res, 'Status tidak valid', 400);
    }

    const [result] = await pool.query(
      `UPDATE users SET status = ? WHERE id = ? AND deleted_at IS NULL`,
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return fail(res, 'User tidak ditemukan', 404);

    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title)
       VALUES (?, 'UPDATE_STATUS', 'users', ?, ?)`,
      [req.user.id, req.params.id, `Status diubah ke ${status}`]
    );

    return success(res, null, `Status user diubah ke ${status}`);
  } catch (err) {
    next(err);
  }
};

export const getLiaisons = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.created_at,
              lp.target_visits_month, lp.target_intake_month,
              (SELECT COUNT(*) FROM liaison_visits lv WHERE lv.liaison_id = u.id) AS total_visits,
              (SELECT COUNT(*) FROM liaison_visits lv WHERE lv.liaison_id = u.id AND lv.status = 'TERDATA') AS total_assisted
       FROM users u
       JOIN liaison_profiles lp ON lp.user_id = u.id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC`
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const updateLiaisonStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['AKTIF', 'DITANGGUHKAN'].includes(status)) {
      return fail(res, 'Status tidak valid', 400);
    }

    const [result] = await pool.query(
      `UPDATE users SET status = ? WHERE id = ? AND role = 'liaison' AND deleted_at IS NULL`,
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return fail(res, 'Liaison tidak ditemukan', 404);

    return success(res, null, 'Status liaison diperbarui');
  } catch (err) {
    next(err);
  }
};