// Satu-satunya jalur menuju status COMPLETED (sign-off dua arah, PRD §7 & §11).
// Menggantikan stored procedure sp_verify_project yang tidak memeriksa kepemilikan dan
// membuka transaksi sendiri (memutus transaksi pemanggil).
import { HttpError } from '../utils/httpError.js';
import { getNeedOwnerId } from '../utils/ownership.js';
import { recomputeReputation } from '../utils/reputation.js';
import { notify, addProjectEvent, audit } from '../utils/activity.js';

const MAX_TESTIMONIAL_LENGTH = 1000;

/**
 * Menyelesaikan proyek di dalam transaksi milik pemanggil (tidak commit/rollback sendiri).
 *
 * @param {import('mysql2/promise').PoolConnection} conn  koneksi yang sudah beginTransaction()
 * @param {object} params
 * @param {number} params.projectId
 * @param {{ id: number, role: string }} params.actor  pemilik efektif kebutuhan atau admin
 * @param {string|null} [params.testimonial]  testimoni pemilik untuk talenta (auto-approve)
 * @param {string[]} [params.allowedFrom]  status asal yang diizinkan
 * @returns {Promise<object>} baris proyek setelah diperbarui
 */
export async function completeProject(conn, { projectId, actor, testimonial = null, allowedFrom = ['AWAITING_VERIFICATION'] }) {
  const [rows] = await conn.query(
    `SELECT p.*, n.title AS need_title, n.requester_id AS need_requester_id, n.created_by AS need_created_by
     FROM projects p
     JOIN needs n ON n.id = p.need_id
     WHERE p.id = ?
     FOR UPDATE`,
    [projectId],
  );
  const project = rows[0];
  if (!project) throw new HttpError(404, 'Proyek tidak ditemukan');

  const ownerId = getNeedOwnerId({ requester_id: project.need_requester_id, created_by: project.need_created_by });
  const isAdmin = actor.role === 'admin';
  if (!isAdmin && Number(actor.id) !== Number(ownerId)) {
    throw new HttpError(403, 'Hanya pemilik kebutuhan yang dapat memverifikasi proyek ini');
  }

  if (!allowedFrom.includes(project.status)) {
    throw new HttpError(409, `Proyek tidak dapat diselesaikan dari status ${project.status}`);
  }
  // Sign-off dua arah: talenta harus sudah menandai selesai.
  if (!project.talent_marked_done_at) {
    throw new HttpError(409, 'Talenta belum menandai proyek selesai');
  }

  const testimonialText = typeof testimonial === 'string' ? testimonial.trim() : '';
  if (testimonialText.length > MAX_TESTIMONIAL_LENGTH) {
    throw new HttpError(400, `Testimoni maksimal ${MAX_TESTIMONIAL_LENGTH} karakter`);
  }

  await conn.query(
    `UPDATE projects SET status = 'COMPLETED', progress_pct = 100, community_verified_at = NOW() WHERE id = ?`,
    [project.id],
  );
  await conn.query(`UPDATE needs SET status = 'COMPLETED' WHERE id = ?`, [project.need_id]);

  // uq_rep_project menjamin satu proyek hanya menyumbang satu poin.
  await conn.query(
    `INSERT IGNORE INTO reputation_events (talent_id, project_id, delta) VALUES (?, ?, 1)`,
    [project.talent_id, project.id],
  );
  await recomputeReputation(conn, [project.talent_id]);

  if (testimonialText) {
    // Testimoni dari alur verifikasi langsung tayang; admin tetap bisa menurunkannya.
    await conn.query(
      `INSERT INTO testimonials (project_id, from_user_id, to_user_id, text, is_public, moderation_status)
       VALUES (?, ?, ?, ?, 1, 'APPROVED')`,
      [project.id, actor.id, project.talent_id, testimonialText],
    );
  }

  await addProjectEvent(conn, {
    projectId: project.id,
    actorId: actor.id,
    eventType: 'VERIFIED',
    label: isAdmin && Number(actor.id) !== Number(ownerId)
      ? 'Admin menyelesaikan proyek setelah mediasi'
      : 'Komunitas telah memverifikasi',
  });
  await notify(conn, {
    userId: project.talent_id,
    type: 'verifikasi',
    title: 'Proyek diverifikasi, reputasi +1',
    body: `"${project.need_title}" dikonfirmasi selesai`,
    refType: 'project',
    refId: project.id,
  });
  await audit(conn, {
    actorId: actor.id, action: 'COMPLETE', entity: 'projects', entityId: project.id, title: project.need_title,
  });

  const [updated] = await conn.query(`SELECT * FROM projects WHERE id = ?`, [project.id]);
  return updated[0];
}
