import { HttpError } from './httpError.js';

/**
 * Memastikan pengguna boleh bertindak atas nama komunitas: anggota ACTIVE-nya, atau liaison/admin.
 * Permintaan gabung yang masih PENDING (atau ditolak) belum memberi hak ini (U1).
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
    `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'ACTIVE' LIMIT 1`,
    [id, user.id],
  );
  if (members.length === 0) throw new HttpError(403, 'Anda bukan anggota komunitas ini');
  return id;
}

/** Id pengguna yang menjadi pengurus ACTIVE komunitas. */
export async function communityManagers(conn, communityId) {
  const [rows] = await conn.query(
    `SELECT user_id FROM community_members WHERE community_id = ? AND role_in = 'PENGURUS' AND status = 'ACTIVE'`,
    [communityId],
  );
  return rows.map((r) => Number(r.user_id));
}

/**
 * Boleh memutuskan permintaan gabung (dan mengelola mading) komunitas ini? Pengurus ACTIVE-nya;
 * bila komunitas belum punya pengurus berakun (dicatat liaison), liaison pembuatnya atau admin.
 * @param {{ id: number, created_by: number|null }} community
 */
export async function canManageCommunity(conn, user, community) {
  const managers = await communityManagers(conn, community.id);
  if (managers.length > 0) return managers.includes(Number(user.id));
  return user.role === 'admin' || (user.role === 'liaison' && Number(community.created_by) === Number(user.id));
}
