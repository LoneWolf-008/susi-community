import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';

export const getVisits = async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = `WHERE lv.liaison_id = ?`;
    const params = [req.user.id];

    if (status && status !== 'SEMUA') {
      where += ` AND lv.status = ?`;
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT lv.*, c.name AS community_real_name
       FROM liaison_visits lv
       LEFT JOIN communities c ON c.id = lv.community_id
       ${where}
       ORDER BY lv.scheduled_date DESC, lv.scheduled_time DESC`,
      params
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getVisitById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT lv.*, c.name AS community_real_name, n.title AS need_title
       FROM liaison_visits lv
       LEFT JOIN communities c ON c.id = lv.community_id
       LEFT JOIN needs n ON n.id = lv.need_id
       WHERE lv.id = ? AND lv.liaison_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return fail(res, 'Kunjungan tidak ditemukan', 404);
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
};

export const createVisit = async (req, res, next) => {
  try {
    const { community_id, community_name, scheduled_date, scheduled_time, address, lat, lng, note, contact_person } = req.body;
    if (!community_name || !scheduled_date) {
      return fail(res, 'Nama komunitas dan tanggal wajib diisi', 400);
    }

    const [result] = await pool.query(
      `INSERT INTO liaison_visits
        (liaison_id, community_id, community_name, scheduled_date, scheduled_time,
         address, lat, lng, note, contact_person)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, community_id || null, community_name.trim(),
        scheduled_date, scheduled_time || null, address || null,
        lat || null, lng || null, note || null, contact_person || null,
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM liaison_visits WHERE id = ?`, [result.insertId]);
    return created(res, rows[0], 'Kunjungan dijadwalkan');
  } catch (err) {
    next(err);
  }
};

export const updateVisit = async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      `SELECT * FROM liaison_visits WHERE id = ? AND liaison_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return fail(res, 'Kunjungan tidak ditemukan', 404);

    const { community_name, scheduled_date, scheduled_time, address, lat, lng, note, contact_person, status } = req.body;

    await pool.query(
      `UPDATE liaison_visits SET
        community_name = COALESCE(?, community_name),
        scheduled_date = COALESCE(?, scheduled_date),
        scheduled_time = COALESCE(?, scheduled_time),
        address = COALESCE(?, address),
        lat = COALESCE(?, lat), lng = COALESCE(?, lng),
        note = COALESCE(?, note),
        contact_person = COALESCE(?, contact_person),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [
        community_name, scheduled_date, scheduled_time, address, lat, lng,
        note, contact_person, status, req.params.id,
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM liaison_visits WHERE id = ?`, [req.params.id]);
    return success(res, rows[0], 'Kunjungan diperbarui');
  } catch (err) {
    next(err);
  }
};

export const startVisit = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE liaison_visits SET status = 'BERLANGSUNG', started_at = NOW()
       WHERE id = ? AND liaison_id = ? AND status = 'DIRENCANAKAN'`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return fail(res, 'Kunjungan tidak bisa dimulai', 400);
    return success(res, null, 'Kunjungan dimulai');
  } catch (err) {
    next(err);
  }
};

export const finishVisit = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM liaison_visits WHERE id = ? AND liaison_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return fail(res, 'Kunjungan tidak ditemukan', 404);
    }

    const visit = rows[0];
    const { note, need_id, community_name, address, lat, lng } = req.body;

    await conn.query(
      `UPDATE liaison_visits SET status = 'TERDATA', finished_at = NOW(),
        note = COALESCE(?, note), need_id = COALESCE(?, need_id),
        address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng)
       WHERE id = ?`,
      [note, need_id, address, lat, lng, visit.id]
    );

    // Jika ada need_id, update status need
    if (need_id) {
      await conn.query(
        `UPDATE needs SET status = 'OPEN' WHERE id = ? AND moderation_status = 'APPROVED'`,
        [need_id]
      );
    }

    await conn.commit();
    return success(res, null, 'Kunjungan selesai, data tercatat');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};