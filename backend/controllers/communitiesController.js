import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const list = async (req, res, next) => {
  try {
    const { sector, type, search } = req.query;
    let where = `WHERE 1=1`;
    const params = [];

    if (sector) { where += ` AND sector = ?`; params.push(sector); }
    if (type) { where += ` AND type = ?`; params.push(type); }
    if (search) {
      where += ` AND (name LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `SELECT * FROM communities ${where} ORDER BY created_at DESC`,
      params
    );
    return success(res, rows);
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

    const { name, type, description, leader_name, leader_role, whatsapp, address, lat, lng } = req.body;
    if (!name) {
      await conn.rollback();
      return fail(res, 'Nama komunitas wajib diisi', 400);
    }

    const [result] = await conn.query(
      `INSERT INTO communities
        (name, type, description, leader_name, leader_role, whatsapp, address, lat, lng, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(), type || 'LAINNYA', description || null,
        leader_name || null, leader_role || null, whatsapp || null,
        address || null, lat || null, lng || null, req.user.id,
      ]
    );

    const communityId = result.insertId;

    // Creator otomatis jadi PENGURUS
    await conn.query(
      `INSERT INTO community_members (community_id, user_id, role_in) VALUES (?, ?, 'PENGURUS')`,
      [communityId, req.user.id]
    );

    await conn.query(
      `UPDATE communities SET members_count = 1 WHERE id = ?`,
      [communityId]
    );

    await conn.commit();

    const [rows] = await conn.query(`SELECT * FROM communities WHERE id = ?`, [communityId]);
    return created(res, rows[0], 'Komunitas dibuat');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const join = async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      `SELECT * FROM community_members WHERE community_id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (existing.length > 0) return fail(res, 'Anda sudah menjadi anggota', 409);

    await pool.query(
      `INSERT INTO community_members (community_id, user_id, role_in) VALUES (?, ?, 'ANGGOTA')`,
      [req.params.id, req.user.id]
    );
    await pool.query(
      `UPDATE communities SET members_count = members_count + 1 WHERE id = ?`,
      [req.params.id]
    );

    return success(res, null, 'Berhasil bergabung');
  } catch (err) {
    next(err);
  }
};

export const leave = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM community_members WHERE community_id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return fail(res, 'Anda bukan anggota', 404);

    await pool.query(
      `UPDATE communities SET members_count = GREATEST(members_count - 1, 0) WHERE id = ?`,
      [req.params.id]
    );

    return success(res, null, 'Berhasil keluar');
  } catch (err) {
    next(err);
  }
};