import fs from 'node:fs/promises';
import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { notify, addProjectEvent } from '../utils/activity.js';
import {
  parseDeliveryFilePath, deliveryAbsolutePath, removeDeliveryFile,
} from '../utils/uploads.js';
import { completeProject } from '../services/projectService.js';

const DISPUTABLE_STATUSES = ['IN_PROGRESS', 'AWAITING_VERIFICATION', 'REVISION'];

export const getMyProjects = async (req, res, next) => {
  try {
    const isTalent = req.user.role === 'talent';
    // Untuk pemilik: requester_id proyek = pemilik efektif kebutuhan (requester atau liaison).
    const where = isTalent
      ? `WHERE p.talent_id = ?`
      : `WHERE p.requester_id = ?`;
    const pg = parsePagination(req.query);

    const [rows] = await pool.query(
      `SELECT p.*, n.title AS project_title, n.category,
              c.name AS community_name,
              t.name AS talent_name
       FROM projects p
       JOIN needs n ON n.id = p.need_id
       LEFT JOIN communities c ON c.id = p.community_id
       LEFT JOIN users t ON t.id = p.talent_id
       ${where}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM projects p ${where}`, [req.user.id]);
    return success(res, paged(rows, total, pg));
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
      `SELECT * FROM project_events WHERE project_id = ? ORDER BY created_at DESC, id DESC`,
      [project.id]
    );
    const [revisions] = await pool.query(
      `SELECT pr.*, u.name AS requested_by_name
       FROM project_revisions pr
       LEFT JOIN users u ON u.id = pr.requested_by
       WHERE pr.project_id = ? ORDER BY pr.requested_at DESC, pr.id DESC`,
      [project.id]
    );

    return success(res, { ...project, deliveries, events, revisions });
  } catch (err) {
    next(err);
  }
};

export const agreeProject = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM projects WHERE id = ? AND talent_id = ? FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Proyek tidak ditemukan');

    const project = rows[0];
    if (project.status !== 'AGREEMENT') {
      throw new HttpError(409, `Proyek tidak bisa disetujui (status: ${project.status})`);
    }

    await conn.query(
      `UPDATE projects SET status = 'IN_PROGRESS', progress_pct = 10,
        agreed_by_talent_at = NOW(), started_at = NOW()
       WHERE id = ?`,
      [project.id]
    );

    await addProjectEvent(conn, {
      projectId: project.id, actorId: req.user.id, eventType: 'STARTED',
      label: 'Talenta menyetujui dan mulai mengerjakan',
    });

    await conn.commit();
    const [updated] = await pool.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
    return success(res, updated[0], 'Proyek dimulai');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Berkas yang diunggah tetapi gagal dicatat sebagai pengiriman dihapus agar tidak yatim,
// kecuali sudah dipakai pengiriman lain.
async function cleanupOrphan(filename, filePath) {
  if (!filename) return;
  const [used] = await pool.query(`SELECT id FROM project_deliveries WHERE file_path = ? LIMIT 1`, [filePath]);
  if (used.length === 0) await removeDeliveryFile(filename);
}

export const submitDelivery = async (req, res, next) => {
  const { file_name, file_path, link_url } = req.body;
  let filename = null;
  const conn = await pool.getConnection();
  try {
    let fileSize = null;
    let displayName = null;
    let link = null;

    if (file_path !== undefined && file_path !== null && file_path !== '') {
      filename = parseDeliveryFilePath(file_path);
      if (!filename) {
        throw new HttpError(400, 'file_path tidak valid. Unggah berkas lewat /api/upload/delivery terlebih dahulu.');
      }
      try {
        fileSize = (await fs.stat(deliveryAbsolutePath(filename))).size;
      } catch {
        filename = null; // tidak ada yang perlu dibersihkan
        throw new HttpError(400, 'Berkas tidak ditemukan di server, silakan unggah ulang');
      }
      const [used] = await pool.query(`SELECT id FROM project_deliveries WHERE file_path = ? LIMIT 1`, [file_path]);
      if (used.length > 0) {
        filename = null; // milik pengiriman lain, jangan dihapus
        throw new HttpError(409, 'Berkas ini sudah dipakai pada pengiriman lain');
      }
      displayName = typeof file_name === 'string' && file_name.trim() ? file_name.trim().slice(0, 255) : filename;
    }

    if (link_url !== undefined && link_url !== null && link_url !== '') {
      if (typeof link_url !== 'string' || link_url.length > 500 || !isHttpUrl(link_url.trim())) {
        throw new HttpError(400, 'Tautan harus berupa URL http/https yang valid');
      }
      link = link_url.trim();
    }

    if (!filename && !link) throw new HttpError(400, 'File atau tautan wajib diisi');

    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM projects WHERE id = ? AND talent_id = ? FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Proyek tidak ditemukan');

    const project = rows[0];
    if (!['IN_PROGRESS', 'REVISION'].includes(project.status)) {
      throw new HttpError(409, 'Proyek tidak bisa dikirim saat ini');
    }

    // Hitung round
    const [[{ maxRound }]] = await conn.query(
      `SELECT COALESCE(MAX(round_no), 0) AS maxRound FROM project_deliveries WHERE project_id = ?`,
      [project.id]
    );

    await conn.query(
      `INSERT INTO project_deliveries (project_id, round_no, file_name, file_path, file_size, link_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [project.id, maxRound + 1, displayName, filename ? file_path : null, fileSize, link]
    );

    // Tandai selesai → AWAITING_VERIFICATION
    await conn.query(
      `UPDATE projects SET status = 'AWAITING_VERIFICATION', progress_pct = 90,
        talent_marked_done_at = NOW()
       WHERE id = ?`,
      [project.id]
    );

    await addProjectEvent(conn, {
      projectId: project.id, actorId: req.user.id, eventType: 'DELIVERED',
      label: 'Talenta menandai proyek selesai',
    });

    // Notif ke pemilik (requester atau liaison)
    await notify(conn, {
      userId: project.requester_id, type: 'verifikasi', title: 'Proyek menunggu verifikasi',
      body: 'Talenta telah menandai proyek selesai', refType: 'project', refId: project.id,
    });

    await conn.commit();
    filename = null; // sudah tercatat

    const [updated] = await pool.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
    return success(res, updated[0], 'Hasil proyek dikirim, menunggu verifikasi komunitas');
  } catch (err) {
    await conn.rollback();
    try {
      await cleanupOrphan(filename, file_path);
    } catch (cleanupErr) {
      console.error('[delivery] gagal menghapus berkas yatim:', cleanupErr.code || cleanupErr.message);
    }
    next(err);
  } finally {
    conn.release();
  }
};

export const verifyProject = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const project = await completeProject(conn, {
      projectId: req.params.id,
      actor: req.user,
      testimonial: req.body?.testimonial ?? null,
      allowedFrom: ['AWAITING_VERIFICATION'],
    });
    await conn.commit();
    return success(res, project, 'Proyek terverifikasi, reputasi talenta +1');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const requestRevision = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM projects WHERE id = ? AND requester_id = ? FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan', 404);
    }

    const project = rows[0];
    if (project.status !== 'AWAITING_VERIFICATION') {
      await conn.rollback();
      return fail(res, 'Revisi hanya bisa diminta setelah talenta menandai selesai', 409);
    }

    const { note } = req.body;
    if (typeof note !== 'string' || !note.trim()) {
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

    // Talenta perlu menandai selesai lagi setelah revisi (sign-off dua arah).
    await conn.query(
      `UPDATE projects SET status = 'REVISION', talent_marked_done_at = NULL,
         progress_pct = GREATEST(progress_pct - 20, 30)
       WHERE id = ?`,
      [project.id]
    );

    await addProjectEvent(conn, {
      projectId: project.id, actorId: req.user.id, eventType: 'REVISION_REQUESTED',
      label: 'Komunitas meminta revisi',
    });

    await notify(conn, {
      userId: project.talent_id, type: 'sistem', title: 'Revisi diminta',
      body: 'Komunitas meminta revisi pada proyek Anda', refType: 'project', refId: project.id,
    });

    await conn.commit();

    const [updated] = await pool.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
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

    const [rows] = await conn.query(`SELECT * FROM projects WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Proyek tidak ditemukan', 404);
    }

    const project = rows[0];
    if (project.talent_id !== req.user.id && project.requester_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return fail(res, 'Akses ditolak', 403);
    }

    if (!DISPUTABLE_STATUSES.includes(project.status)) {
      await conn.rollback();
      return fail(res, `Sengketa tidak bisa dibuka pada status ${project.status}`, 409);
    }

    const { summary, statement } = req.body;
    if (typeof summary !== 'string' || !summary.trim()) {
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
    const statementText = typeof statement === 'string' && statement.trim() ? statement.trim() : null;

    const [disputeRes] = await conn.query(
      `INSERT INTO disputes (project_id, status, summary, statement_community, statement_talent)
       VALUES (?, 'MEDIASI', ?, ?, ?)`,
      [
        project.id,
        summary.trim(),
        isTalent ? null : statementText,
        isTalent ? statementText : null,
      ]
    );
    await conn.query(
      `INSERT INTO dispute_events (dispute_id, label) VALUES (?, ?)`,
      [disputeRes.insertId, isTalent ? 'Sengketa dibuka oleh talenta' : 'Sengketa dibuka oleh komunitas']
    );

    await conn.query(
      `UPDATE projects SET status = 'DISPUTED' WHERE id = ?`,
      [project.id]
    );

    await addProjectEvent(conn, {
      projectId: project.id, actorId: req.user.id, eventType: 'DISPUTED', label: 'Sengketa dibuka',
    });

    await conn.commit();
    return created(res, { id: disputeRes.insertId }, 'Sengketa dibuka, menunggu mediasi admin');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
