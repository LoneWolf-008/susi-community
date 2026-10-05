// Sertifikasi talenta (U5): kelayakan, kode sertifikat, dan keputusan peninjau. Keputusan dipakai bersama
// oleh PATCH /admin/certifications/:id dan antrean moderasi admin (moderation_items 'TALENTA'), agar
// keduanya menerbitkan sertifikat, memberi notifikasi, dan mencatat audit dengan cara yang sama.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { notify, audit } from '../utils/activity.js';

export const CERT_MIN_PROJECTS = env.certification.minProjects;
export const CERT_MAX_EVIDENCE = 10;

// Bidang sertifikasi. Kode disimpan di DB; label tampil di sertifikat & halaman verifikasi.
export const FOCUS_AREAS = Object.freeze({
  PENCATATAN: 'Pencatatan & Data',
  WEBSITE: 'Website',
  APLIKASI: 'Aplikasi',
  DESAIN: 'Desain & Konten Digital',
  UMUM: 'Pendampingan Digital Umum',
});
export const focusLabel = (code) => FOCUS_AREAS[code] ?? code;

// Tanpa huruf/angka yang mudah tertukar (0/O, 1/I/L). 8 karakter acak ≈ 2^39 kemungkinan.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function generateCertificateCode() {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `SUSI-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * Kelayakan talenta mengajukan sertifikasi (dipakai endpoint talenta dan chatbot R3).
 * Layak = proyek COMPLETED ≥ CERT_MIN_PROJECTS, tidak ada pengajuan PENDING, dan masih ada bidang yang
 * belum punya sertifikat aktif. `reasons` menjelaskan bila belum layak.
 */
export async function certificationEligibility(db, talentId) {
  const [projects] = await db.query(
    `SELECT p.id, n.title, n.category, c.name AS community_name, p.community_verified_at
     FROM projects p
     JOIN needs n ON n.id = p.need_id
     LEFT JOIN communities c ON c.id = p.community_id
     WHERE p.talent_id = ? AND p.status = 'COMPLETED'
     ORDER BY p.community_verified_at DESC, p.id DESC`,
    [talentId],
  );
  const [[pending]] = await db.query(
    `SELECT id, focus_area, created_at FROM certification_requests WHERE talent_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1`,
    [talentId],
  );
  const [certificates] = await db.query(
    `SELECT code, focus_area, issued_at FROM certificates WHERE talent_id = ? AND revoked_at IS NULL ORDER BY issued_at DESC`,
    [talentId],
  );
  const certifiedAreas = new Set(certificates.map((c) => c.focus_area));
  const availableAreas = Object.keys(FOCUS_AREAS).filter((code) => !certifiedAreas.has(code));

  const completed = projects.length;
  const reasons = [];
  if (completed < CERT_MIN_PROJECTS) {
    reasons.push(`Baru ${completed} dari ${CERT_MIN_PROJECTS} proyek selesai; selesaikan ${CERT_MIN_PROJECTS - completed} proyek lagi.`);
  }
  if (pending) reasons.push('Masih ada pengajuan sertifikasi yang sedang ditinjau.');
  if (availableAreas.length === 0) reasons.push('Anda sudah tersertifikasi di semua bidang.');

  return {
    eligible: reasons.length === 0,
    reasons,
    completed,
    min_projects: CERT_MIN_PROJECTS,
    pending_request: pending ? { id: pending.id, focus_area: pending.focus_area, focus_label: focusLabel(pending.focus_area), created_at: pending.created_at } : null,
    certificates: certificates.map((c) => ({ code: c.code, focus_area: c.focus_area, focus_label: focusLabel(c.focus_area), issued_at: c.issued_at })),
    available_focus_areas: availableAreas.map((code) => ({ code, label: FOCUS_AREAS[code] })),
    completed_projects: projects,
  };
}

/** Terbitkan sertifikat untuk pengajuan yang disetujui; kode diulang bila (sangat jarang) bentrok. */
async function issueCertificate(conn, request, projectCount) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCertificateCode();
    try {
      await conn.query(
        `INSERT INTO certificates (talent_id, request_id, code, focus_area, project_count) VALUES (?, ?, ?, ?, ?)`,
        [request.talent_id, request.id, code, request.focus_area, projectCount],
      );
      return code;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY' || !String(err.message).includes('uq_cert_code')) throw err;
    }
  }
  throw new Error('Gagal membuat kode sertifikat unik');
}

/**
 * Putuskan pengajuan (dalam transaksi `conn`). `decision` APPROVED → sertifikat terbit; REJECTED →
 * catatan wajib di pemanggil. Item moderasi 'TALENTA' ikut diperbarui. Sudah diputus → 409.
 * @returns {Promise<{ id: number, status: string, code: string|null }>}
 */
export async function decideCertificationRequest(conn, { requestId, decision, note, reviewer }) {
  const [[request]] = await conn.query(
    `SELECT r.*, u.name AS talent_name FROM certification_requests r JOIN users u ON u.id = r.talent_id WHERE r.id = ? FOR UPDATE`,
    [requestId],
  );
  if (!request) throw new HttpError(404, 'Pengajuan sertifikasi tidak ditemukan');
  if (request.status !== 'PENDING') throw new HttpError(409, `Pengajuan sudah diputus (${request.status})`);

  await conn.query(
    `UPDATE certification_requests SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?`,
    [decision, reviewer.id, note || null, request.id],
  );
  await conn.query(
    `UPDATE moderation_items SET decision = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE item_type = 'TALENTA' AND ref_id = ? AND decision = 'PENDING'`,
    [decision, decision === 'REJECTED' ? 'TIDAK LAYAK' : null, reviewer.id, request.id],
  );

  let code = null;
  const area = focusLabel(request.focus_area);
  if (decision === 'APPROVED') {
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM certification_request_projects WHERE request_id = ?`, [request.id]);
    code = await issueCertificate(conn, request, Number(n));
    await notify(conn, {
      userId: request.talent_id, type: 'verifikasi', title: 'Selamat, Anda Tersertifikasi SUSI',
      body: `Sertifikasi bidang ${area} disetujui. Kode sertifikat: ${code}.`, refType: 'certificate', refId: request.id,
    });
  } else {
    await notify(conn, {
      userId: request.talent_id, type: 'verifikasi', title: 'Pengajuan sertifikasi belum disetujui',
      body: note ? `Bidang ${area}: ${note}` : `Bidang ${area} belum disetujui. Anda bisa mengajukan lagi.`,
      refType: 'certificate', refId: request.id,
    });
  }
  await audit(conn, {
    actorId: reviewer.id,
    action: decision === 'APPROVED' ? 'APPROVE_CERTIFICATION' : 'REJECT_CERTIFICATION',
    entity: 'certification_requests',
    entityId: request.id,
    title: `${request.talent_name} · ${area}`,
    meta: { note: note || null, code },
  });
  return { id: request.id, status: decision, code };
}
