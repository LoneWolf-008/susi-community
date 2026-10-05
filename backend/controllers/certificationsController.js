// Sertifikasi talenta (U5). Talenta: kelayakan, ajukan, riwayat. Peninjau (admin & AgenSUSI): antrean,
// setujui/tolak (sertifikat terbit + notifikasi + audit). Admin: cabut. Publik: verifikasi kode tanpa
// login, hanya nama, bidang, tanggal terbit, jumlah proyek, dan status (tanpa email/kontak).
import { pool } from '../config/db.js';
import { success, created } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import { notify, audit } from '../utils/activity.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { invalidateRecommendations } from '../services/recommendation/index.js';
import {
  CERT_MIN_PROJECTS, focusLabel, certificationEligibility, decideCertificationRequest,
} from '../services/certification.js';

const STATUS_FILTERS = {
  PENDING: ['PENDING'],
  APPROVED: ['APPROVED'],
  REJECTED: ['REJECTED'],
  all: ['PENDING', 'APPROVED', 'REJECTED'],
};

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== String(raw)) throw new HttpError(404, 'Pengajuan sertifikasi tidak ditemukan');
  return id;
};

const certificateOf = (r) => (r.code ? {
  code: r.code, issued_at: r.issued_at, revoked_at: r.revoked_at, revoke_reason: r.revoke_reason ?? null,
  status: r.revoked_at ? 'REVOKED' : 'VALID',
} : null);

/** Proyek bukti per pengajuan, beserta testimoni & tautan hasil (bukti untuk peninjau). */
async function evidenceFor(requestIds, { withEvidence = true } = {}) {
  const byRequest = new Map(requestIds.map((id) => [id, []]));
  if (requestIds.length === 0) return byRequest;
  const [projects] = await pool.query(
    `SELECT rp.request_id, p.id, p.talent_id, n.title, n.category, c.name AS community_name, p.community_verified_at
     FROM certification_request_projects rp
     JOIN projects p ON p.id = rp.project_id
     JOIN needs n ON n.id = p.need_id
     LEFT JOIN communities c ON c.id = p.community_id
     WHERE rp.request_id IN (?)
     ORDER BY p.community_verified_at DESC, p.id DESC`,
    [requestIds],
  );
  const projectIds = [...new Set(projects.map((p) => p.id))];
  const testimonials = new Map();
  const deliveries = new Map();
  if (withEvidence && projectIds.length > 0) {
    const [tRows] = await pool.query(
      `SELECT t.project_id, t.text, u.name AS from_name FROM testimonials t JOIN users u ON u.id = t.from_user_id
       WHERE t.project_id IN (?) AND t.moderation_status <> 'REJECTED' ORDER BY t.id`,
      [projectIds],
    );
    tRows.forEach((t) => testimonials.set(t.project_id, { text: t.text, from_name: t.from_name }));
    const [dRows] = await pool.query(
      `SELECT project_id, link_url, file_name, delivered_at FROM project_deliveries WHERE project_id IN (?) ORDER BY delivered_at, id`,
      [projectIds],
    );
    // Kiriman hasil terakhir per proyek.
    dRows.forEach((d) => deliveries.set(d.project_id, { link_url: d.link_url, file_name: d.file_name, delivered_at: d.delivered_at }));
  }
  for (const p of projects) {
    byRequest.get(p.request_id)?.push({
      id: p.id, title: p.title, category: p.category, community_name: p.community_name, verified_at: p.community_verified_at,
      ...(withEvidence ? { testimonial: testimonials.get(p.id) ?? null, delivery: deliveries.get(p.id) ?? null } : {}),
    });
  }
  return byRequest;
}

// ===== Talenta =====

/** GET /certifications/eligibility — layak/tidak beserta alasan, proyek selesai, dan bidang yang tersedia. */
export const getEligibility = async (req, res, next) => {
  try {
    return success(res, await certificationEligibility(pool, req.user.id));
  } catch (err) {
    next(err);
  }
};

/** GET /certifications/mine — riwayat pengajuan (dengan proyek bukti & sertifikat) milik talenta. */
export const getMine = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.focus_area, r.pitch, r.status, r.review_note, r.reviewed_at, r.created_at,
              c.code, c.issued_at, c.revoked_at, c.revoke_reason
       FROM certification_requests r
       LEFT JOIN certificates c ON c.request_id = r.id
       WHERE r.talent_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 20`,
      [req.user.id],
    );
    const evidence = await evidenceFor(rows.map((r) => r.id), { withEvidence: false });
    return success(res, {
      items: rows.map((r) => ({
        id: r.id, focus_area: r.focus_area, focus_label: focusLabel(r.focus_area), pitch: r.pitch, status: r.status,
        review_note: r.review_note, reviewed_at: r.reviewed_at, created_at: r.created_at,
        projects: evidence.get(r.id), certificate: certificateOf(r),
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /certifications — `{ focus_area, pitch, project_ids[] }`. Proyek bukti wajib proyek COMPLETED
 * milik pemanggil, minimal CERT_MIN_PROJECTS. Satu pengajuan PENDING per talenta (baris users dikunci).
 */
export const createRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { focus_area: focusArea, pitch, project_ids: projectIds } = req.body;
    await conn.beginTransaction();
    const [[talent]] = await conn.query(`SELECT id, name FROM users WHERE id = ? FOR UPDATE`, [req.user.id]);
    const eligibility = await certificationEligibility(conn, req.user.id);
    if (eligibility.pending_request) throw new HttpError(409, 'Masih ada pengajuan sertifikasi yang sedang ditinjau. Tunggu keputusannya dulu.');
    if (!eligibility.eligible) throw new HttpError(400, eligibility.reasons.join(' '));
    if (!eligibility.available_focus_areas.some((a) => a.code === focusArea)) {
      throw new HttpError(409, `Anda sudah memiliki sertifikat aktif untuk bidang ${focusLabel(focusArea)}.`);
    }
    const own = new Set(eligibility.completed_projects.map((p) => Number(p.id)));
    if (projectIds.some((id) => !own.has(Number(id)))) {
      throw new HttpError(400, 'Proyek bukti harus proyek selesai milik Anda sendiri.');
    }
    if (projectIds.length < CERT_MIN_PROJECTS) {
      throw new HttpError(400, `Pilih minimal ${CERT_MIN_PROJECTS} proyek selesai sebagai bukti.`);
    }

    const [result] = await conn.query(
      `INSERT INTO certification_requests (talent_id, focus_area, pitch) VALUES (?, ?, ?)`,
      [req.user.id, focusArea, pitch],
    );
    const requestId = result.insertId;
    for (const projectId of projectIds) {
      await conn.query(`INSERT INTO certification_request_projects (request_id, project_id) VALUES (?, ?)`, [requestId, projectId]);
    }
    // Antrean moderasi admin yang sudah ada (item_type TALENTA).
    const title = `Sertifikasi ${focusLabel(focusArea)}: ${talent.name}`.slice(0, 200);
    await conn.query(
      `INSERT INTO moderation_items (item_type, ref_id, title, submitted_by, source, risk_level) VALUES ('TALENTA', ?, ?, ?, 'MANDIRI', 'RENDAH')`,
      [requestId, title, req.user.id],
    );
    // Peninjau: admin & AgenSUSI aktif.
    const [reviewers] = await conn.query(`SELECT id FROM users WHERE role IN ('admin', 'liaison') AND status = 'AKTIF'`);
    for (const { id } of reviewers) {
      await notify(conn, {
        userId: id, type: 'moderasi', title: 'Pengajuan sertifikasi baru',
        body: `${talent.name} mengajukan sertifikasi bidang ${focusLabel(focusArea)} dengan ${projectIds.length} proyek bukti.`,
        refType: 'certification', refId: requestId,
      });
    }
    await conn.commit();
    return created(res, {
      id: requestId, focus_area: focusArea, focus_label: focusLabel(focusArea), status: 'PENDING', project_ids: projectIds,
    }, 'Pengajuan sertifikasi terkirim');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ===== Peninjau (admin & AgenSUSI) =====

/** GET /admin/certifications?status=PENDING|APPROVED|REJECTED|all — pengajuan beserta bukti untuk ditinjau. */
export const listRequests = async (req, res, next) => {
  try {
    const statuses = STATUS_FILTERS[req.query.status ?? 'PENDING'];
    if (!statuses) throw new HttpError(400, `Status harus salah satu dari: ${Object.keys(STATUS_FILTERS).join(', ')}`);
    const pg = parsePagination(req.query);
    const [rows] = await pool.query(
      `SELECT r.*, u.name AS talent_name, tp.level, tp.reputation_points, rv.name AS reviewer_name,
              c.code, c.issued_at, c.revoked_at, c.revoke_reason,
              (SELECT COUNT(*) FROM projects p WHERE p.talent_id = r.talent_id AND p.status = 'COMPLETED') AS completed_projects
       FROM certification_requests r
       JOIN users u ON u.id = r.talent_id
       LEFT JOIN talent_profiles tp ON tp.user_id = r.talent_id
       LEFT JOIN users rv ON rv.id = r.reviewer_id
       LEFT JOIN certificates c ON c.request_id = r.id
       WHERE r.status IN (?)
       ORDER BY r.status = 'PENDING' DESC, IF(r.status = 'PENDING', r.created_at, NULL) ASC, r.reviewed_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [statuses, pg.limit, pg.offset],
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM certification_requests WHERE status IN (?)`, [statuses]);
    const [[counts]] = await pool.query(
      `SELECT COALESCE(SUM(status = 'PENDING'), 0) AS pending, COALESCE(SUM(status = 'APPROVED'), 0) AS approved,
              COALESCE(SUM(status = 'REJECTED'), 0) AS rejected
       FROM certification_requests`,
    );
    const talentIds = [...new Set(rows.map((r) => r.talent_id))];
    const skillsBy = new Map();
    if (talentIds.length > 0) {
      const [skills] = await pool.query(
        `SELECT ts.talent_id, s.name FROM talent_skills ts JOIN skills s ON s.id = ts.skill_id WHERE ts.talent_id IN (?) ORDER BY s.name`,
        [talentIds],
      );
      skills.forEach((s) => skillsBy.set(s.talent_id, [...(skillsBy.get(s.talent_id) ?? []), s.name]));
    }
    const evidence = await evidenceFor(rows.map((r) => r.id));
    const items = rows.map((r) => ({
      id: r.id,
      talent: {
        id: r.talent_id, name: r.talent_name, level: r.level ?? 'TALENTA_MUDA', reputation_points: Number(r.reputation_points ?? 0),
        completed_projects: Number(r.completed_projects), skills: skillsBy.get(r.talent_id) ?? [],
      },
      focus_area: r.focus_area,
      focus_label: focusLabel(r.focus_area),
      pitch: r.pitch,
      status: r.status,
      review_note: r.review_note,
      reviewer: r.reviewer_id ? { id: r.reviewer_id, name: r.reviewer_name } : null,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      projects: evidence.get(r.id),
      certificate: certificateOf(r),
    }));
    return success(res, {
      ...paged(items, total, pg),
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
      min_projects: CERT_MIN_PROJECTS,
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/certifications/:id — `{ decision: APPROVED|REJECTED, note }` (catatan wajib saat menolak). */
export const decideRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parseId(req.params.id);
    await conn.beginTransaction();
    const result = await decideCertificationRequest(conn, { requestId: id, decision: req.body.decision, note: req.body.note, reviewer: req.user });
    await conn.commit();
    if (result.status === 'APPROVED') invalidateRecommendations();
    return success(res, result, result.status === 'APPROVED' ? `Sertifikat terbit: ${result.code}` : 'Pengajuan ditolak');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** PATCH /admin/certifications/:id/revoke — admin mencabut sertifikat dari pengajuan ini. `{ reason }` */
export const revokeCertificate = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parseId(req.params.id);
    await conn.beginTransaction();
    const [[cert]] = await conn.query(
      `SELECT c.*, u.name AS talent_name FROM certificates c JOIN users u ON u.id = c.talent_id WHERE c.request_id = ? FOR UPDATE`,
      [id],
    );
    if (!cert) throw new HttpError(404, 'Pengajuan ini tidak memiliki sertifikat');
    if (cert.revoked_at) throw new HttpError(409, 'Sertifikat ini sudah dicabut');
    await conn.query(
      `UPDATE certificates SET revoked_at = NOW(), revoked_by = ?, revoke_reason = ? WHERE id = ?`,
      [req.user.id, req.body.reason, cert.id],
    );
    await audit(conn, {
      actorId: req.user.id, action: 'REVOKE_CERTIFICATE', entity: 'certificates', entityId: cert.id,
      title: `${cert.talent_name} · ${focusLabel(cert.focus_area)} · ${cert.code}`, meta: { reason: req.body.reason },
    });
    await notify(conn, {
      userId: cert.talent_id, type: 'verifikasi', title: 'Sertifikat SUSI dicabut',
      body: `Sertifikat ${cert.code} (bidang ${focusLabel(cert.focus_area)}) dicabut. Alasan: ${req.body.reason}`,
      refType: 'certificate', refId: id,
    });
    await conn.commit();
    invalidateRecommendations();
    return success(res, { code: cert.code, status: 'REVOKED' }, 'Sertifikat dicabut');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ===== Publik =====

const CODE_RE = /^SUSI-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** GET /public/certificates/:code — verifikasi tanpa login; tidak ada email, telepon, atau data pribadi lain. */
export const getPublicCertificate = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) throw new HttpError(404, 'Sertifikat tidak ditemukan');
    const [[cert]] = await pool.query(
      `SELECT c.code, c.focus_area, c.project_count, c.issued_at, c.revoked_at, u.name
       FROM certificates c JOIN users u ON u.id = c.talent_id WHERE c.code = ?`,
      [code],
    );
    if (!cert) throw new HttpError(404, 'Sertifikat tidak ditemukan');
    return success(res, {
      code: cert.code,
      name: cert.name,
      focus_area: cert.focus_area,
      focus_label: focusLabel(cert.focus_area),
      issued_at: cert.issued_at,
      project_count: cert.project_count,
      status: cert.revoked_at ? 'REVOKED' : 'VALID',
      revoked_at: cert.revoked_at,
      issuer: 'SUSI Community',
    });
  } catch (err) {
    next(err);
  }
};
