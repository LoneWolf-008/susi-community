import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const getCatalog = async (req, res, next) => {
  try {
    const { category, sector, search, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, +page) - 1) * +limit;

    let where = `WHERE n.moderation_status = 'APPROVED' AND n.status = 'OPEN'`;
    const params = [];

    if (category && category !== 'SEMUA') {
      where += ` AND n.category = ?`;
      params.push(category);
    }
    if (sector) {
      where += ` AND n.sector = ?`;
      params.push(sector);
    }
    if (search) {
      where += ` AND (n.title LIKE ? OR n.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.category, n.summary, n.description, n.address,
              n.lat, n.lng, n.sector, n.created_at,
              c.name AS community_name, c.leader_name, c.members_count,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, +limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM needs n ${where}`,
      params
    );

    return success(res, { items: rows, total, page: +page, limit: +limit });
  } catch (err) {
    next(err);
  }
};

export const getMyNeeds = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.*, c.name AS community_name
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       WHERE n.requester_id = ?
       ORDER BY n.created_at DESC`,
      [req.user.id]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getNeedById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.*, c.name AS community_name, c.leader_name, c.members_count,
              u.name AS requester_name
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       LEFT JOIN users u ON u.id = n.requester_id
       WHERE n.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Kebutuhan tidak ditemukan', 404);

    // Ambil skill yang dibutuhkan
    const [skills] = await pool.query(
      `SELECT s.id, s.name FROM need_skills ns
       JOIN skills s ON s.id = ns.skill_id
       WHERE ns.need_id = ?`,
      [req.params.id]
    );

    return success(res, { ...rows[0], skills });
  } catch (err) {
    next(err);
  }
};

export const createNeed = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { title, category, description, summary, address, lat, lng, community_id } = req.body;

    if (!title || !description) {
      await conn.rollback();
      return fail(res, 'Judul dan deskripsi wajib diisi', 400);
    }

    const source = req.user.role === 'liaison' ? 'AGENSUSI' : 'MANDIRI';

    const [result] = await conn.query(
      `INSERT INTO needs
        (community_id, requester_id, created_by, title, category, summary, description,
         address, lat, lng, source, moderation_status, risk_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'RENDAH')`,
      [
        community_id || null,
        req.user.role === 'requester' ? req.user.id : null,
        req.user.id,
        title.trim(),
        category || 'LAINNYA',
        summary || null,
        description.trim(),
        address || null,
        lat || null,
        lng || null,
        source,
      ]
    );

    const needId = result.insertId;

    // Catat ke moderation_items otomatis
    await conn.query(
      `INSERT INTO moderation_items
        (item_type, ref_id, title, submitted_by, source, risk_level, decision)
       VALUES ('KEBUTUHAN', ?, ?, ?, ?, 'RENDAH', 'PENDING')`,
      [needId, title.trim(), req.user.id, source]
    );

    // Catat ke audit log
    await conn.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title)
       VALUES (?, 'CREATE', 'needs', ?, ?)`,
      [req.user.id, needId, title.trim()]
    );

    await conn.commit();

    const [rows] = await conn.query(`SELECT * FROM needs WHERE id = ?`, [needId]);
    return created(res, rows[0], 'Kebutuhan berhasil diajukan, menunggu moderasi');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const updateNeed = async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      `SELECT * FROM needs WHERE id = ? AND requester_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return fail(res, 'Kebutuhan tidak ditemukan', 404);

    const { title, category, description, summary, address, lat, lng } = req.body;
    await pool.query(
      `UPDATE needs SET title = COALESCE(?, title), category = COALESCE(?, category),
        description = COALESCE(?, description), summary = COALESCE(?, summary),
        address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng)
       WHERE id = ?`,
      [title, category, description, summary, address, lat, lng, req.params.id]
    );

    const [rows] = await pool.query(`SELECT * FROM needs WHERE id = ?`, [req.params.id]);
    return success(res, rows[0], 'Kebutuhan diperbarui');
  } catch (err) {
    next(err);
  }
};

export const deleteNeed = async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      `SELECT * FROM needs WHERE id = ? AND requester_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return fail(res, 'Kebutuhan tidak ditemukan', 404);

    await pool.query(`DELETE FROM needs WHERE id = ?`, [req.params.id]);
    return success(res, null, 'Kebutuhan dihapus');
  } catch (err) {
    next(err);
  }
};