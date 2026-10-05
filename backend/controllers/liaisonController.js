import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { STALE_HOURS } from '../services/chatbot/escalation.js';

const VISIT_STATUSES = ['DIRENCANAKAN', 'BERLANGSUNG', 'TERDATA'];
const DEFAULT_TARGETS = { target_visits_month: 30, target_intake_month: 25 };
const OWN_NEED = `n.requester_id IS NULL AND n.created_by = ?`;

// Ringkasan kinerja liaison untuk beranda & laporan: target bulanan, capaian bulan ini,
// status kebutuhan yang ia catat, kunjungan selesai per minggu (4 minggu terakhir), dan
// antrean eskalasi chatbot.
export const getSummary = async (req, res, next) => {
  try {
    const id = req.user.id;
    const [[profile]] = await pool.query(
      `SELECT target_visits_month, target_intake_month FROM liaison_profiles WHERE user_id = ?`, [id]
    );
    const [[month]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM liaison_visits WHERE liaison_id = ? AND status = 'TERDATA'
            AND finished_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS visits,
         (SELECT COUNT(*) FROM needs n WHERE ${OWN_NEED}
            AND n.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS intake`,
      [id, id]
    );
    const [[needs]] = await pool.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(n.moderation_status = 'PENDING'), 0) AS pending,
              COALESCE(SUM(n.moderation_status = 'APPROVED' AND n.status = 'OPEN'), 0) AS open,
              COALESCE(SUM(n.status = 'IN_PROGRESS'), 0) AS in_progress,
              COALESCE(SUM(n.status = 'COMPLETED'), 0) AS completed
       FROM needs n WHERE ${OWN_NEED}`,
      [id]
    );
    const [weekRows] = await pool.query(
      `SELECT FLOOR(DATEDIFF(CURDATE(), DATE(finished_at)) / 7) AS weeks_ago, COUNT(*) AS visits
       FROM liaison_visits
       WHERE liaison_id = ? AND status = 'TERDATA' AND finished_at >= CURDATE() - INTERVAL 27 DAY
       GROUP BY weeks_ago`,
      [id]
    );
    const byWeek = new Map(weekRows.map((r) => [Number(r.weeks_ago), Number(r.visits)]));
    // Antrean eskalasi chatbot (T13): tiket pending dibagi bersama, basi = pending > 24 jam.
    const [[escalations]] = await pool.query(
      `SELECT COALESCE(SUM(status = 'pending'), 0) AS pending,
              COALESCE(SUM(status = 'assigned' AND assigned_to = ?), 0) AS mine,
              COALESCE(SUM(status = 'pending' AND created_at < NOW() - INTERVAL ${STALE_HOURS} HOUR), 0) AS stale
       FROM escalations`,
      [id]
    );

    return success(res, {
      targets: {
        visits_month: Number((profile || DEFAULT_TARGETS).target_visits_month),
        intake_month: Number((profile || DEFAULT_TARGETS).target_intake_month),
      },
      month: { visits: Number(month.visits), intake: Number(month.intake) },
      needs: Object.fromEntries(Object.entries(needs).map(([k, v]) => [k, Number(v)])),
      // Urut dari yang terlama: indeks 3 = minggu ini.
      weekly_visits: [3, 2, 1, 0].map((weeksAgo) => byWeek.get(weeksAgo) || 0),
      escalations: Object.fromEntries(Object.entries(escalations).map(([k, v]) => [k, Number(v)])),
    });
  } catch (err) {
    next(err);
  }
};

export const getVisits = async (req, res, next) => {
  try {
    const { status, date } = req.query;
    const pg = parsePagination(req.query);
    let where = `WHERE lv.liaison_id = ?`;
    const params = [req.user.id];

    if (status && status !== 'SEMUA') {
      if (!VISIT_STATUSES.includes(status)) return fail(res, 'Status kunjungan tidak valid', 400);
      where += ` AND lv.status = ?`;
      params.push(status);
    }
    // ?date=YYYY-MM-DD → agenda satu hari (mis. "hari ini" menurut zona waktu pengguna).
    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return fail(res, 'Format tanggal harus YYYY-MM-DD', 400);
      where += ` AND lv.scheduled_date = ?`;
      params.push(date);
    }

    const [rows] = await pool.query(
      `SELECT lv.*, c.name AS community_real_name, n.title AS need_title
       FROM liaison_visits lv
       LEFT JOIN communities c ON c.id = lv.community_id
       LEFT JOIN needs n ON n.id = lv.need_id
       ${where}
       ORDER BY lv.scheduled_date DESC, lv.scheduled_time DESC, lv.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM liaison_visits lv ${where}`, params);
    return success(res, paged(rows, total, pg));
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
    if (typeof community_name !== 'string' || !community_name.trim() || !scheduled_date) {
      return fail(res, 'Nama komunitas dan tanggal wajib diisi', 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(scheduled_date))) {
      return fail(res, 'Format tanggal harus YYYY-MM-DD', 400);
    }
    if (community_id) {
      const [communities] = await pool.query(`SELECT id FROM communities WHERE id = ?`, [community_id]);
      if (!communities[0]) return fail(res, 'Komunitas tidak ditemukan', 404);
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

// Status kunjungan hanya berubah lewat /start dan /finish, bukan lewat PATCH umum.
export const updateVisit = async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      `SELECT * FROM liaison_visits WHERE id = ? AND liaison_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return fail(res, 'Kunjungan tidak ditemukan', 404);
    if (req.body.status !== undefined) {
      return fail(res, 'Status kunjungan diubah lewat aksi mulai/selesai', 400);
    }

    const { community_name, scheduled_date, scheduled_time, address, lat, lng, note, contact_person } = req.body;
    if (scheduled_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(scheduled_date))) {
      return fail(res, 'Format tanggal harus YYYY-MM-DD', 400);
    }

    await pool.query(
      `UPDATE liaison_visits SET
        community_name = COALESCE(?, community_name),
        scheduled_date = COALESCE(?, scheduled_date),
        scheduled_time = COALESCE(?, scheduled_time),
        address = COALESCE(?, address),
        lat = COALESCE(?, lat), lng = COALESCE(?, lng),
        note = COALESCE(?, note),
        contact_person = COALESCE(?, contact_person)
       WHERE id = ?`,
      [
        community_name, scheduled_date, scheduled_time, address, lat, lng,
        note, contact_person, req.params.id,
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
    if (result.affectedRows === 0) return fail(res, 'Kunjungan tidak bisa dimulai', 409);
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
      `SELECT * FROM liaison_visits WHERE id = ? AND liaison_id = ? FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Kunjungan tidak ditemukan');

    const visit = rows[0];
    if (visit.status === 'TERDATA') throw new HttpError(409, 'Kunjungan sudah selesai');

    const { note, need_id, address, lat, lng } = req.body;

    // Kebutuhan yang ditautkan harus dicatat oleh liaison yang sama.
    if (need_id !== undefined && need_id !== null && need_id !== '') {
      const [needs] = await conn.query(
        `SELECT id FROM needs WHERE id = ? AND created_by = ?`,
        [need_id, req.user.id]
      );
      if (!needs[0]) throw new HttpError(400, 'Kebutuhan tidak ditemukan atau bukan catatan Anda');
    }

    // Status kebutuhan tidak disentuh: tayang/tidaknya ditentukan moderasi admin.
    await conn.query(
      `UPDATE liaison_visits SET status = 'TERDATA', finished_at = NOW(),
        started_at = COALESCE(started_at, NOW()),
        note = COALESCE(?, note), need_id = COALESCE(?, need_id),
        address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng)
       WHERE id = ?`,
      [note ?? null, need_id || null, address ?? null, lat ?? null, lng ?? null, visit.id]
    );

    await conn.commit();
    return success(res, null, 'Kunjungan selesai, data tercatat');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
