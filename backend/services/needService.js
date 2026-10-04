import { HttpError } from '../utils/httpError.js';
import { notify, audit } from '../utils/activity.js';

/**
 * Menutup kebutuhan secara lunak (status CLOSED) di dalam transaksi pemanggil.
 * Ditolak bila kebutuhan sudah punya proyek yang belum dibatalkan.
 * Lamaran yang masih MENUNGGU ditolak dan talentanya diberi tahu.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {{ needId: number, actorId: number, reason?: string }} params
 */
export async function closeNeed(conn, { needId, actorId, reason = 'Kebutuhan ditutup oleh pemiliknya' }) {
  const [needs] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [needId]);
  const need = needs[0];
  if (!need) throw new HttpError(404, 'Kebutuhan tidak ditemukan');
  if (need.status === 'CLOSED') throw new HttpError(409, 'Kebutuhan sudah ditutup');

  const [projects] = await conn.query(
    `SELECT id FROM projects WHERE need_id = ? AND status <> 'CANCELLED' LIMIT 1`,
    [needId],
  );
  if (projects.length > 0) {
    throw new HttpError(409, 'Kebutuhan sudah memiliki proyek dan tidak bisa dihapus atau ditarik');
  }

  const [pending] = await conn.query(
    `SELECT id, talent_id FROM applications WHERE need_id = ? AND status = 'MENUNGGU' FOR UPDATE`,
    [needId],
  );
  await conn.query(
    `UPDATE applications SET status = 'DITOLAK', decided_at = NOW() WHERE need_id = ? AND status = 'MENUNGGU'`,
    [needId],
  );
  await conn.query(`UPDATE needs SET status = 'CLOSED' WHERE id = ?`, [needId]);

  for (const app of pending) {
    await notify(conn, {
      userId: app.talent_id,
      type: 'talenta',
      title: 'Kebutuhan ditutup',
      body: `"${need.title}" ditutup oleh pemiliknya, lamaran Anda tidak dilanjutkan`,
      refType: 'application',
      refId: app.id,
    });
  }
  await audit(conn, { actorId, action: 'CLOSE', entity: 'needs', entityId: needId, title: need.title, meta: { reason } });

  return { ...need, status: 'CLOSED' };
}
