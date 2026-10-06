import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { getNeedOwnerId } from '../utils/ownership.js';
import { notify, addProjectEvent, audit } from '../utils/activity.js';
import { completeProject } from '../services/projectService.js';
import { decideCertificationRequest, focusLabel } from '../services/certification.js';
import { invalidateRecommendations } from '../services/recommendation/index.js';

const REJECT_REASONS = ['SPAM', 'DUPLIKAT', 'SALAH KATEGORI', 'TIDAK LAYAK'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WEEKS = 6;

// Angka platform (v_platform_stats) + rincian untuk dasbor admin: hasil moderasi, pengguna per
// peran, dan kunjungan situs per minggu (daily_stats, terlama → minggu ini).
export const getStats = async (req, res, next) => {
  try {
    const [[stats]] = await pool.query(`SELECT * FROM v_platform_stats`);
    const [moderation] = await pool.query(`SELECT decision, COUNT(*) AS n FROM moderation_items GROUP BY decision`);
    const [roles] = await pool.query(
      `SELECT role, COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND status = 'AKTIF' GROUP BY role`
    );
    const [weeks] = await pool.query(
      `SELECT FLOOR(DATEDIFF(CURDATE(), stat_date) / 7) AS weeks_ago, SUM(visits) AS visits
       FROM daily_stats WHERE stat_date > CURDATE() - INTERVAL ? DAY
       GROUP BY weeks_ago`,
      [WEEKS * 7]
    );
    const count = (rows, key, value) => Number(rows.find((r) => r[key] === value)?.n || 0);
    const byWeek = new Map(weeks.map((w) => [Number(w.weeks_ago), Number(w.visits)]));

    return success(res, {
      ...stats,
      moderation: {
        pending: count(moderation, 'decision', 'PENDING'),
        approved: count(moderation, 'decision', 'APPROVED'),
        rejected: count(moderation, 'decision', 'REJECTED'),
      },
      users_by_role: Object.fromEntries(['requester', 'talent', 'liaison', 'admin'].map((r) => [r, count(roles, 'role', r)])),
      weekly_visits: Array.from({ length: WEEKS }, (_, i) => byWeek.get(WEEKS - 1 - i) || 0),
    });
  } catch (err) {
    next(err);
  }
};

/** Isi item moderasi (cerita kebutuhan / teks testimoni) agar admin memutus dari konten, bukan judul. */
async function attachModerationDetails(rows) {
  const idsOf = (type) => rows.filter((r) => r.item_type === type).map((r) => r.ref_id);
  const details = new Map();
  const needIds = idsOf('KEBUTUHAN');
  if (needIds.length > 0) {
    const [needs] = await pool.query(
      `SELECT n.id, n.title, n.summary, n.description, n.category, n.address, n.source,
              n.moderation_status, n.status, c.name AS community_name, u.name AS created_by_name
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.id IN (?)`,
      [needIds]
    );
    needs.forEach((n) => details.set(`KEBUTUHAN:${n.id}`, n));
  }
  const testimonialIds = idsOf('TESTIMONI');
  if (testimonialIds.length > 0) {
    const [testimonials] = await pool.query(
      `SELECT t.id, t.text, t.is_public, t.moderation_status, f.name AS from_name, r.name AS to_name,
              n.title AS project_title
       FROM testimonials t
       JOIN users f ON f.id = t.from_user_id
       JOIN users r ON r.id = t.to_user_id
       JOIN projects p ON p.id = t.project_id
       JOIN needs n ON n.id = p.need_id
       WHERE t.id IN (?)`,
      [testimonialIds]
    );
    testimonials.forEach((t) => details.set(`TESTIMONI:${t.id}`, t));
  }
  // U5: pengajuan sertifikasi talenta (ref_id = certification_requests.id).
  const certIds = idsOf('TALENTA');
  if (certIds.length > 0) {
    const [requests] = await pool.query(
      `SELECT r.id, r.focus_area, r.pitch, r.status, u.name AS talent_name,
              (SELECT COUNT(*) FROM certification_request_projects rp WHERE rp.request_id = r.id) AS evidence_projects,
              (SELECT COUNT(*) FROM projects p WHERE p.talent_id = r.talent_id AND p.status = 'COMPLETED') AS completed_projects
       FROM certification_requests r JOIN users u ON u.id = r.talent_id
       WHERE r.id IN (?)`,
      [certIds]
    );
    requests.forEach((r) => details.set(`TALENTA:${r.id}`, { ...r, focus_label: focusLabel(r.focus_area) }));
  }
  return rows.map((r) => ({ ...r, detail: details.get(`${r.item_type}:${r.ref_id}`) || null }));
}

export const getModerationQueue = async (req, res, next) => {
  try {
    const { item_type, decision } = req.query;
    const pg = parsePagination(req.query);
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
       ORDER BY mi.created_at DESC, mi.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM moderation_items mi ${where}`, params);
    return success(res, paged(await attachModerationDetails(rows), total, pg));
  } catch (err) {
    next(err);
  }
};

export const decideModeration = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [items] = await conn.query(
      `SELECT * FROM moderation_items WHERE id = ? FOR UPDATE`,
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

    // Item yang sudah diputus tidak boleh diputus ulang (mis. dua admin menekan bersamaan).
    if (item.decision !== 'PENDING') {
      await conn.rollback();
      return fail(res, `Item sudah diputus (${item.decision})`, 409);
    }

    if (decision === 'REJECTED' && !REJECT_REASONS.includes(reject_reason)) {
      await conn.rollback();
      return fail(res, `Alasan penolakan wajib salah satu dari: ${REJECT_REASONS.join(', ')}`, 400);
    }
    const reason = decision === 'REJECTED' ? reject_reason : null;

    // U5: pengajuan sertifikasi diputus lewat logika yang sama dengan /admin/certifications
    // (sertifikat terbit, notifikasi, audit, dan item moderasi ikut diperbarui).
    if (item.item_type === 'TALENTA') {
      await decideCertificationRequest(conn, {
        requestId: item.ref_id, decision, reviewer: req.user,
        note: reason ? `Ditolak lewat antrean moderasi (${reason}).` : null,
      });
      await conn.commit();
      if (decision === 'APPROVED') invalidateRecommendations();
      return success(res, null, `Item ${decision.toLowerCase()}`);
    }

    await conn.query(
      `UPDATE moderation_items SET
        decision = ?, reject_reason = ?,
        checklist_layak = ?, checklist_kategori = ?,
        reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [
        decision, reason,
        checklist_layak ? 1 : 0, checklist_kategori ? 1 : 0,
        req.user.id, item.id,
      ]
    );

    // Update status entitas terkait
    if (item.item_type === 'KEBUTUHAN') {
      await conn.query(
        `UPDATE needs SET moderation_status = ?, reject_reason = ? WHERE id = ?`,
        [decision, reason, item.ref_id]
      );
    } else if (item.item_type === 'TESTIMONI') {
      await conn.query(
        `UPDATE testimonials SET moderation_status = ? WHERE id = ?`,
        [decision, item.ref_id]
      );
    }

    // Hasil moderasi diberitahukan ke pengaju (T3.5).
    const approved = decision === 'APPROVED';
    const what = item.item_type === 'KEBUTUHAN' ? 'Kebutuhan' : item.item_type === 'TESTIMONI' ? 'Testimoni' : 'Pengajuan';
    await notify(conn, {
      userId: item.submitted_by,
      type: 'moderasi',
      title: `${what} ${approved ? 'disetujui' : 'ditolak'}`,
      body: approved
        ? item.item_type === 'KEBUTUHAN'
          ? `"${item.title}" sudah tayang di katalog talenta`
          : `"${item.title}" sudah disetujui admin`
        : `"${item.title}" ditolak. Alasan: ${reason}. Perbaiki lalu ajukan ulang.`,
      refType: item.item_type === 'KEBUTUHAN' ? 'need' : item.item_type === 'TESTIMONI' ? 'testimonial' : 'moderation',
      refId: item.ref_id,
    });

    await audit(conn, {
      actorId: req.user.id, action: 'MODERATE', entity: 'moderation_items', entityId: item.id,
      title: item.title, meta: { decision, reject_reason: reason },
    });

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
    const pg = parsePagination(req.query);
    let where = `WHERE 1=1`;
    const params = [];
    if (status) { where += ` AND d.status = ?`; params.push(status); }

    const [rows] = await pool.query(
      `SELECT d.*, n.title AS project_title, c.name AS community_name,
              t.name AS talent_name, r.name AS requester_name, a.name AS decided_by_name
       FROM disputes d
       JOIN projects p ON p.id = d.project_id
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       LEFT JOIN users r ON r.id = p.requester_id
       LEFT JOIN users a ON a.id = d.decided_by
       ${where}
       ORDER BY d.opened_at DESC, d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM disputes d ${where}`, params);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

export const getDisputeById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, p.id AS project_id, p.status AS project_status, n.title AS project_title,
              c.name AS community_name, t.name AS talent_name, r.name AS requester_name,
              p.requester_id, p.talent_id, p.scope, p.done_definition, p.deadline
       FROM disputes d
       JOIN projects p ON p.id = d.project_id
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       LEFT JOIN users r ON r.id = p.requester_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Sengketa tidak ditemukan', 404);

    const [events] = await pool.query(
      `SELECT * FROM dispute_events WHERE dispute_id = ? ORDER BY created_at ASC, id ASC`,
      [req.params.id]
    );
    const [messages] = await pool.query(
      `SELECT am.*, u.name AS sender_name
       FROM admin_messages am
       JOIN users u ON u.id = am.sender_id
       WHERE am.target_type = 'DISPUTE' AND am.target_id = ?
       ORDER BY am.sent_at ASC, am.id ASC`,
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

    const [rows] = await conn.query(`SELECT * FROM disputes WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'Sengketa tidak ditemukan');

    const dispute = rows[0];
    if (dispute.status === 'SELESAI') throw new HttpError(409, 'Sengketa sudah diselesaikan');

    const { decision, statement_admin } = req.body;
    if (!['MARK_COMPLETE', 'EXTEND_7_DAYS'].includes(decision)) {
      throw new HttpError(400, 'Keputusan tidak valid');
    }

    const [projects] = await conn.query(
      `SELECT p.*, n.title AS need_title, n.requester_id AS need_requester_id, n.created_by AS need_created_by
       FROM projects p JOIN needs n ON n.id = p.need_id
       WHERE p.id = ? FOR UPDATE`,
      [dispute.project_id]
    );
    const project = projects[0];
    if (project.status !== 'DISPUTED') {
      throw new HttpError(409, `Proyek tidak dalam status sengketa (status: ${project.status})`);
    }

    if (decision === 'MARK_COMPLETE') {
      // Satu transaksi dengan penutupan sengketa; pernyataan admin BUKAN testimoni.
      await completeProject(conn, { projectId: project.id, actor: req.user, allowedFrom: ['DISPUTED'] });
    } else {
      // Kembali dikerjakan; talenta perlu menandai selesai lagi setelah perpanjangan.
      await conn.query(
        `UPDATE projects SET status = 'IN_PROGRESS', talent_marked_done_at = NULL,
           deadline = DATE_ADD(GREATEST(COALESCE(deadline, CURDATE()), CURDATE()), INTERVAL 7 DAY)
         WHERE id = ?`,
        [project.id]
      );
      await addProjectEvent(conn, {
        projectId: project.id, actorId: req.user.id, eventType: 'EXTENDED',
        label: 'Admin memperpanjang tenggat 7 hari setelah mediasi',
      });
    }

    await conn.query(
      `UPDATE disputes SET status = 'SELESAI', decision = ?, decided_by = ?, decided_at = NOW()
       WHERE id = ?`,
      [decision, req.user.id, dispute.id]
    );

    const note = typeof statement_admin === 'string' && statement_admin.trim()
      ? ` — ${statement_admin.trim()}`
      : '';
    await conn.query(
      `INSERT INTO dispute_events (dispute_id, label) VALUES (?, ?)`,
      [dispute.id, `Admin memutuskan: ${decision}${note}`.slice(0, 255)]
    );

    // Notif ke kedua pihak
    const ownerId = getNeedOwnerId({ requester_id: project.need_requester_id, created_by: project.need_created_by });
    const body = decision === 'MARK_COMPLETE'
      ? 'Admin menyatakan proyek selesai'
      : 'Admin memperpanjang tenggat proyek 7 hari';
    for (const userId of new Set([ownerId, project.talent_id])) {
      await notify(conn, {
        userId, type: 'sengketa', title: 'Sengketa diselesaikan', body, refType: 'dispute', refId: dispute.id,
      });
    }
    await audit(conn, {
      actorId: req.user.id, action: 'RESOLVE_DISPUTE', entity: 'disputes', entityId: dispute.id,
      title: project.need_title, meta: { decision },
    });

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
    const { body } = req.body;
    if (typeof body !== 'string' || !body.trim()) return fail(res, 'Pesan wajib diisi', 400);

    // Endpoint ini khusus pesan sengketa: target selalu sengketa pada URL.
    const [disputes] = await pool.query(
      `SELECT d.id, d.project_id, p.requester_id, p.talent_id
       FROM disputes d JOIN projects p ON p.id = d.project_id WHERE d.id = ?`,
      [req.params.id]
    );
    if (!disputes[0]) return fail(res, 'Sengketa tidak ditemukan', 404);
    const dispute = disputes[0];

    const [result] = await pool.query(
      `INSERT INTO admin_messages (sender_id, target_type, target_id, body)
       VALUES (?, 'DISPUTE', ?, ?)`,
      [req.user.id, dispute.id, body.trim()]
    );
    // Kedua pihak membaca pesan lewat GET /api/projects/:id/dispute.
    for (const userId of new Set([dispute.requester_id, dispute.talent_id])) {
      await notify(pool, {
        userId, type: 'sengketa', title: 'Pesan baru dari admin',
        body: body.trim(), refType: 'project', refId: dispute.project_id,
      });
    }

    const [rows] = await pool.query(`SELECT * FROM admin_messages WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Pesan terkirim');
  } catch (err) {
    next(err);
  }
};

export const takedownTestimonial = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT id, moderation_status FROM testimonials WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return fail(res, 'Testimoni tidak ditemukan', 404);
    if (rows[0].moderation_status === 'REJECTED') return fail(res, 'Testimoni sudah diturunkan', 409);

    await pool.query(`UPDATE testimonials SET moderation_status = 'REJECTED' WHERE id = ?`, [rows[0].id]);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : null;
    await audit(pool, {
      actorId: req.user.id, action: 'TAKEDOWN', entity: 'testimonials', entityId: rows[0].id,
      title: 'Testimoni diturunkan', meta: { reason },
    });
    return success(res, null, 'Testimoni diturunkan dari profil publik');
  } catch (err) {
    next(err);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const pg = parsePagination(req.query);
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
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
    return success(res, paged(rows, total, pg));
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
    if (Number(req.params.id) === Number(req.user.id)) {
      return fail(res, 'Admin tidak dapat mengubah status akunnya sendiri', 400);
    }

    const [result] = await pool.query(
      `UPDATE users SET status = ? WHERE id = ? AND deleted_at IS NULL`,
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return fail(res, 'User tidak ditemukan', 404);

    await audit(pool, {
      actorId: req.user.id, action: 'UPDATE_STATUS', entity: 'users', entityId: Number(req.params.id),
      title: `Status diubah ke ${status}`,
    });

    return success(res, null, `Status user diubah ke ${status}`);
  } catch (err) {
    next(err);
  }
};

export const getLiaisons = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at,
              lp.target_visits_month, lp.target_intake_month,
              (SELECT COUNT(*) FROM liaison_visits lv WHERE lv.liaison_id = u.id) AS total_visits,
              (SELECT COUNT(*) FROM liaison_visits lv WHERE lv.liaison_id = u.id AND lv.status = 'TERDATA') AS total_assisted
       FROM users u
       JOIN liaison_profiles lp ON lp.user_id = u.id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT ? OFFSET ?`,
      [pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u JOIN liaison_profiles lp ON lp.user_id = u.id WHERE u.deleted_at IS NULL`
    );
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

// Liaison tidak bisa mendaftar sendiri (keputusan desain #2): akunnya dibuat admin.
export const createLiaison = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { name, email, password, phone, target_visits_month, target_intake_month } = req.body;

    if (typeof name !== 'string' || !name.trim()) return fail(res, 'Nama wajib diisi', 400);
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return fail(res, 'Email tidak valid', 400);
    if (typeof password !== 'string' || password.length < 10) return fail(res, 'Password minimal 10 karakter', 400);

    const targets = {};
    for (const [key, value] of Object.entries({ target_visits_month, target_intake_month })) {
      if (value === undefined || value === null || value === '') continue;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 1000) return fail(res, `${key} harus bilangan bulat 0–1000`, 400);
      targets[key] = n;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
    if (existing.length > 0) {
      await conn.rollback();
      return fail(res, 'Email sudah terdaftar', 409);
    }

    const [result] = await conn.query(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, 'liaison', ?)`,
      [name.trim(), normalizedEmail, passwordHash, typeof phone === 'string' && phone.trim() ? phone.trim() : null]
    );
    const userId = result.insertId;
    await conn.query(
      `INSERT INTO liaison_profiles (user_id, target_visits_month, target_intake_month)
       VALUES (?, COALESCE(?, 30), COALESCE(?, 25))`,
      [userId, targets.target_visits_month ?? null, targets.target_intake_month ?? null]
    );
    await conn.query(`INSERT INTO user_settings (user_id) VALUES (?)`, [userId]);
    await audit(conn, {
      actorId: req.user.id, action: 'CREATE_LIAISON', entity: 'users', entityId: userId, title: name.trim(),
    });
    await conn.commit();

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at,
              lp.target_visits_month, lp.target_intake_month
       FROM users u JOIN liaison_profiles lp ON lp.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    );
    return created(res, rows[0], 'Akun liaison dibuat');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Email sudah terdaftar', 409);
    next(err);
  } finally {
    conn.release();
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

    await audit(pool, {
      actorId: req.user.id, action: 'UPDATE_STATUS', entity: 'users', entityId: Number(req.params.id),
      title: `Status liaison diubah ke ${status}`,
    });
    return success(res, null, 'Status liaison diperbarui');
  } catch (err) {
    next(err);
  }
};

// Log audit (T3.8): tabel sudah terisi oleh semua aksi penting, kini bisa ditelusuri admin.
export const getAuditLogs = async (req, res, next) => {
  try {
    const { entity, action, actor_id } = req.query;
    const pg = parsePagination(req.query);
    let where = `WHERE 1=1`;
    const params = [];
    if (entity) { where += ` AND al.entity = ?`; params.push(entity); }
    if (action) { where += ` AND al.action = ?`; params.push(action); }
    if (actor_id) { where += ` AND al.actor_id = ?`; params.push(actor_id); }

    const [rows] = await pool.query(
      `SELECT al.id, al.actor_id, u.name AS actor_name, u.role AS actor_role, al.action, al.entity,
              al.entity_id, al.title, al.subtitle, al.meta, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       ${where}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs al ${where}`, params);

    const items = rows.map((r) => {
      let meta = null;
      try {
        meta = r.meta ? JSON.parse(r.meta) : null;
      } catch {
        meta = null;
      }
      return { ...r, meta };
    });
    return success(res, paged(items, total, pg));
  } catch (err) {
    next(err);
  }
};
