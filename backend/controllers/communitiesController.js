import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { notify } from '../utils/activity.js';
import { communityManagers, canManageCommunity } from '../utils/communityAccess.js';

// Keanggotaan (U1): talenta mengajukan gabung → PENDING → diputuskan pengurus komunitas (atau liaison
// pembuat/admin bila komunitas belum punya pengurus berakun). Hanya anggota ACTIVE yang dihitung,
// tampil sebagai anggota, dan boleh menulis atas nama komunitas.

export const list = async (req, res, next) => {
  try {
    const { sector, type, search, mine } = req.query;
    const pg = parsePagination(req.query);
    let where = `WHERE 1=1`;
    const params = [];

    if (sector) { where += ` AND c.sector = ?`; params.push(sector); }
    if (type) { where += ` AND c.type = ?`; params.push(type); }
    if (search) {
      where += ` AND (c.name LIKE ? OR c.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (mine === 'true') {
      where += ` AND EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = ? AND cm.status = 'ACTIVE')`;
      params.push(req.user.id);
    }

    const [rows] = await pool.query(
      `SELECT c.*, my.status AS membership_status, my.role_in AS membership_role,
         (my.status = 'ACTIVE') AS is_member
       FROM communities c
       LEFT JOIN community_members my ON my.community_id = c.id AND my.user_id = ?
       ${where}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, ...params, pg.limit, pg.offset]
    );
    const items = rows.map((r) => ({ ...r, is_member: Boolean(r.is_member) }));
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM communities c ${where}`, params);
    return success(res, paged(items, total, pg));
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') AS members_count_real
       FROM communities c WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Komunitas tidak ditemukan', 404);

    const [members] = await pool.query(
      `SELECT cm.role_in, cm.joined_at, u.id, u.name, u.avatar_url
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = ? AND cm.status = 'ACTIVE'
       ORDER BY cm.role_in DESC, cm.joined_at ASC`,
      [req.params.id]
    );

    return success(res, { ...rows[0], members });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Body sudah divalidasi zod (createCommunitySchema).
    const {
      name, type, description, leader_name, leader_role, established_at, whatsapp, address, lat, lng,
    } = req.body;
    // Komunitas yang dicatat liaison (jalur Assisted) tidak punya akun pengurus;
    // liaison tidak ikut menjadi anggotanya.
    const isAssisted = req.user.role === 'liaison' || req.user.role === 'admin';

    const [result] = await conn.query(
      `INSERT INTO communities
        (name, type, description, leader_name, leader_role, established_at, whatsapp, address, lat, lng,
         source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, type || 'LAINNYA', description || null,
        leader_name || null, leader_role || null, established_at || null, whatsapp || null,
        address || null, lat ?? null, lng ?? null,
        isAssisted ? 'AGENSUSI' : 'MANDIRI', req.user.id,
      ]
    );

    const communityId = result.insertId;

    if (!isAssisted) {
      // Creator otomatis jadi PENGURUS
      await conn.query(
        `INSERT INTO community_members (community_id, user_id, role_in) VALUES (?, ?, 'PENGURUS')`,
        [communityId, req.user.id]
      );
      await conn.query(
        `UPDATE communities SET members_count = 1 WHERE id = ?`,
        [communityId]
      );
    }

    await conn.commit();

    const [rows] = await pool.query(`SELECT * FROM communities WHERE id = ?`, [communityId]);
    return created(res, rows[0], 'Komunitas dibuat');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** Penerima notifikasi permintaan gabung: pengurus; bila belum ada, pembuat komunitas (liaison). */
async function joinRecipients(conn, community) {
  const managers = await communityManagers(conn, community.id);
  if (managers.length > 0) return managers;
  return community.created_by ? [Number(community.created_by)] : [];
}

/** Talenta mengajukan gabung (PENDING). Yang pernah ditolak boleh mengajukan lagi. */
export const join = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [communities] = await conn.query(`SELECT id, name, created_by FROM communities WHERE id = ? FOR UPDATE`, [req.params.id]);
    const community = communities[0];
    if (!community) throw new HttpError(404, 'Komunitas tidak ditemukan');

    const message = req.body?.message?.trim() || null;
    const [existing] = await conn.query(
      `SELECT status FROM community_members WHERE community_id = ? AND user_id = ?`,
      [community.id, req.user.id]
    );
    const current = existing[0]?.status;
    if (current === 'ACTIVE') throw new HttpError(409, 'Anda sudah menjadi anggota komunitas ini');
    if (current === 'PENDING') throw new HttpError(409, 'Permintaan Anda masih menunggu persetujuan pengurus');

    if (current === 'REJECTED') {
      await conn.query(
        `UPDATE community_members
         SET status = 'PENDING', message = ?, decided_by = NULL, decided_at = NULL, joined_at = NOW()
         WHERE community_id = ? AND user_id = ?`,
        [message, community.id, req.user.id]
      );
    } else {
      await conn.query(
        `INSERT INTO community_members (community_id, user_id, role_in, status, message) VALUES (?, ?, 'ANGGOTA', 'PENDING', ?)`,
        [community.id, req.user.id, message]
      );
    }

    const [[talent]] = await conn.query(`SELECT name FROM users WHERE id = ?`, [req.user.id]);
    for (const userId of await joinRecipients(conn, community)) {
      await notify(conn, {
        userId,
        type: 'komunitas',
        title: 'Permintaan bergabung',
        body: `${talent.name} ingin bergabung dengan ${community.name}${message ? `: "${message}"` : ''}`,
        refType: 'community',
        refId: community.id,
      });
    }

    await conn.commit();
    return created(res, { community_id: community.id, status: 'PENDING' }, 'Permintaan bergabung terkirim ke pengurus');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Permintaan Anda sudah tercatat', 409);
    next(err);
  } finally {
    conn.release();
  }
};

/** Batalkan permintaan, hapus status ditolak, atau keluar dari komunitas. */
export const leave = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT status FROM community_members WHERE community_id = ? AND user_id = ? FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Anda bukan anggota', 404);
    }

    await conn.query(`DELETE FROM community_members WHERE community_id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    // members_count hanya menghitung anggota yang sudah disetujui.
    if (rows[0].status === 'ACTIVE') {
      await conn.query(
        `UPDATE communities SET members_count = GREATEST(CAST(members_count AS SIGNED) - 1, 0) WHERE id = ?`,
        [req.params.id]
      );
    }

    await conn.commit();
    return success(res, null, rows[0].status === 'PENDING' ? 'Permintaan dibatalkan' : 'Berhasil keluar');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const JOIN_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED'];

/** Kolom permintaan gabung yang boleh dilihat pengurus (selaras dengan data pelamar: tanpa kontak). */
const JOIN_REQUEST_COLUMNS = `
  cm.community_id, c.name AS community_name, cm.user_id, u.name, u.avatar_url, cm.status, cm.message,
  cm.joined_at AS requested_at, cm.decided_at, tp.level,
  (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ')
     FROM talent_skills ts JOIN skills s ON s.id = ts.skill_id WHERE ts.talent_id = cm.user_id) AS skills,
  (SELECT COUNT(*) FROM projects p WHERE p.talent_id = cm.user_id AND p.status = 'COMPLETED') AS completed_projects`;

const findCommunity = async (conn, id) => {
  const [rows] = await conn.query(`SELECT id, name, created_by FROM communities WHERE id = ?`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Komunitas tidak ditemukan');
  return rows[0];
};

/** Permintaan gabung satu komunitas (`?status=PENDING|ACTIVE|REJECTED`, bawaan PENDING). */
export const listJoinRequests = async (req, res, next) => {
  try {
    const community = await findCommunity(pool, req.params.id);
    if (!(await canManageCommunity(pool, req.user, community))) {
      throw new HttpError(403, 'Hanya pengurus komunitas ini yang bisa melihat permintaan bergabung');
    }
    const status = String(req.query.status || 'PENDING').toUpperCase();
    if (!JOIN_STATUSES.includes(status)) throw new HttpError(400, `Status harus salah satu dari: ${JOIN_STATUSES.join(', ')}`);
    const [items] = await pool.query(
      `SELECT ${JOIN_REQUEST_COLUMNS}
       FROM community_members cm
       JOIN communities c ON c.id = cm.community_id
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN talent_profiles tp ON tp.user_id = cm.user_id
       WHERE cm.community_id = ? AND cm.status = ? AND cm.role_in = 'ANGGOTA'
       ORDER BY cm.joined_at ASC`,
      [community.id, status]
    );
    return success(res, { community: { id: community.id, name: community.name }, items });
  } catch (err) {
    next(err);
  }
};

/**
 * Semua permintaan PENDING di komunitas yang dikelola pemanggil (panel "Permintaan bergabung"):
 * komunitas tempat ia pengurus ACTIVE; untuk liaison/admin juga komunitas tanpa pengurus berakun
 * (liaison: yang ia catat).
 */
export const listMyJoinRequests = async (req, res, next) => {
  try {
    const noManager = `NOT EXISTS (SELECT 1 FROM community_members pm
                         WHERE pm.community_id = c.id AND pm.role_in = 'PENGURUS' AND pm.status = 'ACTIVE')`;
    const managed = [
      `EXISTS (SELECT 1 FROM community_members pm WHERE pm.community_id = c.id AND pm.user_id = ?
                 AND pm.role_in = 'PENGURUS' AND pm.status = 'ACTIVE')`,
    ];
    const params = [req.user.id];
    if (req.user.role === 'admin') managed.push(noManager);
    if (req.user.role === 'liaison') {
      managed.push(`(${noManager} AND c.created_by = ?)`);
      params.push(req.user.id);
    }
    const [items] = await pool.query(
      `SELECT ${JOIN_REQUEST_COLUMNS}
       FROM community_members cm
       JOIN communities c ON c.id = cm.community_id
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN talent_profiles tp ON tp.user_id = cm.user_id
       WHERE cm.status = 'PENDING' AND (${managed.join(' OR ')})
       ORDER BY cm.joined_at ASC
       LIMIT 100`,
      params
    );
    return success(res, { items });
  } catch (err) {
    next(err);
  }
};

/** Setujui (ACTIVE) atau tolak (REJECTED) permintaan gabung yang masih PENDING. */
export const decideJoinRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [communities] = await conn.query(`SELECT id, name, created_by FROM communities WHERE id = ? FOR UPDATE`, [req.params.id]);
    const community = communities[0];
    if (!community) throw new HttpError(404, 'Komunitas tidak ditemukan');
    if (!(await canManageCommunity(conn, req.user, community))) {
      throw new HttpError(403, 'Hanya pengurus komunitas ini yang bisa memutuskan permintaan bergabung');
    }

    const userId = Number(req.params.userId);
    const [rows] = await conn.query(
      `SELECT status FROM community_members WHERE community_id = ? AND user_id = ? FOR UPDATE`,
      [community.id, userId]
    );
    if (!rows[0]) throw new HttpError(404, 'Permintaan bergabung tidak ditemukan');
    if (rows[0].status !== 'PENDING') throw new HttpError(409, 'Permintaan ini sudah diputuskan');

    const { decision } = req.body;
    await conn.query(
      `UPDATE community_members
       SET status = ?, decided_by = ?, decided_at = NOW(), joined_at = IF(? = 'ACTIVE', NOW(), joined_at)
       WHERE community_id = ? AND user_id = ?`,
      [decision, req.user.id, decision, community.id, userId]
    );
    if (decision === 'ACTIVE') {
      await conn.query(`UPDATE communities SET members_count = members_count + 1 WHERE id = ?`, [community.id]);
    }
    await notify(conn, {
      userId,
      type: 'komunitas',
      title: decision === 'ACTIVE' ? 'Permintaan bergabung disetujui' : 'Permintaan bergabung ditolak',
      body: decision === 'ACTIVE'
        ? `Anda kini anggota ${community.name} dan bisa menulis di mading atas nama komunitas ini`
        : `Pengurus ${community.name} belum menerima permintaan Anda kali ini`,
      refType: 'community',
      refId: community.id,
    });

    await conn.commit();
    return success(res, { community_id: community.id, user_id: userId, status: decision },
      decision === 'ACTIVE' ? 'Permintaan disetujui' : 'Permintaan ditolak');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
