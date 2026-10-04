import { HttpError } from './httpError.js';

/**
 * Memastikan pengguna boleh bertindak atas nama komunitas: anggotanya, atau liaison/admin.
 * Nilai kosong berarti "tanpa komunitas" dan selalu diizinkan.
 *
 * @returns {Promise<number|null>} id komunitas yang tervalidasi, atau null
 */
export async function assertCommunityAccess(conn, user, communityId) {
  if (communityId === undefined || communityId === null || communityId === '') return null;

  const id = Number(communityId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'community_id tidak valid');

  const [rows] = await conn.query(`SELECT id FROM communities WHERE id = ?`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Komunitas tidak ditemukan');

  if (user.role === 'liaison' || user.role === 'admin') return id;

  const [members] = await conn.query(
    `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? LIMIT 1`,
    [id, user.id],
  );
  if (members.length === 0) throw new HttpError(403, 'Anda bukan anggota komunitas ini');
  return id;
}
