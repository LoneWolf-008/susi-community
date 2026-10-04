import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';

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
      where += ` AND EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = ?)`;
      params.push(req.user.id);
    }

    const [rows] = await pool.query(
      `SELECT c.*,
         EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = ?) AS is_member
       FROM communities c ${where}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, ...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM communities c ${where}`, params);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) AS members_count_real
       FROM communities c WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Komunitas tidak ditemukan', 404);

    const [members] = await pool.query(
      `SELECT cm.role_in, cm.joined_at, u.id, u.name, u.avatar_url
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = ?
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

export const join = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [communities] = await conn.query(`SELECT id FROM communities WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (!communities[0]) {
      await conn.rollback();
      return fail(res, 'Komunitas tidak ditemukan', 404);
    }

    const [existing] = await conn.query(
      `SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?`,
      [communities[0].id, req.user.id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return fail(res, 'Anda sudah menjadi anggota', 409);
    }

    await conn.query(
      `INSERT INTO community_members (community_id, user_id, role_in) VALUES (?, ?, 'ANGGOTA')`,
      [communities[0].id, req.user.id]
    );
    await conn.query(
      `UPDATE communities SET members_count = members_count + 1 WHERE id = ?`,
      [communities[0].id]
    );

    await conn.commit();
    return success(res, null, 'Berhasil bergabung');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Anda sudah menjadi anggota', 409);
    next(err);
  } finally {
    conn.release();
  }
};

export const leave = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `DELETE FROM community_members WHERE community_id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return fail(res, 'Anda bukan anggota', 404);
    }

    await conn.query(
      `UPDATE communities SET members_count = GREATEST(CAST(members_count AS SIGNED) - 1, 0) WHERE id = ?`,
      [req.params.id]
    );

    await conn.commit();
    return success(res, null, 'Berhasil keluar');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
