import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { isNeedOwner } from '../utils/ownership.js';
import { assertCommunityAccess } from '../utils/communityAccess.js';
import { audit } from '../utils/activity.js';
import { closeNeed } from '../services/needService.js';

const CATEGORIES = ['PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'];
// Kebutuhan hanya boleh diubah sebelum tayang di katalog.
const EDITABLE_MODERATION = ['PENDING', 'REJECTED'];

const optionalText = (value, field, max) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${field} harus berupa teks`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${field} maksimal ${max} karakter`);
  return text;
};

const optionalCoordinate = (value, field, min, max) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} tidak valid`);
  return n;
};

// Validasi field kebutuhan; `partial` untuk PATCH (field boleh tidak dikirim).
function readNeedFields(body, { partial }) {
  const title = optionalText(body.title, 'Judul', 200);
  const description = optionalText(body.description, 'Deskripsi', 5000);
  if (!partial && (!title || !description)) throw new HttpError(400, 'Judul dan deskripsi wajib diisi');
  if (partial && (title === '' || description === '')) throw new HttpError(400, 'Judul dan deskripsi tidak boleh kosong');

  let category;
  if (body.category !== undefined && body.category !== null && body.category !== '') {
    if (!CATEGORIES.includes(body.category)) {
      throw new HttpError(400, `Kategori harus salah satu dari: ${CATEGORIES.join(', ')}`);
    }
    category = body.category;
  }

  return {
    title,
    description,
    category,
    summary: optionalText(body.summary, 'Ringkasan', 300),
    address: optionalText(body.address, 'Alamat', 255),
    lat: optionalCoordinate(body.lat, 'Latitude', -90, 90),
    lng: optionalCoordinate(body.lng, 'Longitude', -180, 180),
  };
}

export const getCatalog = async (req, res, next) => {
  try {
    const { category, sector, search } = req.query;
    const pg = parsePagination(req.query);

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
              n.lat, n.lng, n.sector, n.source, n.created_at,
              c.name AS community_name, c.leader_name, c.members_count,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       ${where}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM needs n ${where}`,
      params
    );

    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

export const getMyNeeds = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const [rows] = await pool.query(
      `SELECT n.*, c.name AS community_name,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants,
              (SELECT p.id FROM projects p WHERE p.need_id = n.id ORDER BY p.id DESC LIMIT 1) AS project_id,
              (SELECT p.status FROM projects p WHERE p.need_id = n.id ORDER BY p.id DESC LIMIT 1) AS project_status
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       WHERE n.requester_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM needs WHERE requester_id = ?`,
      [req.user.id]
    );
    return success(res, paged(rows, total, pg));
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
    const need = rows[0];
    if (!need) return fail(res, 'Kebutuhan tidak ditemukan', 404);

    // Kebutuhan yang belum lolos moderasi hanya terlihat oleh pemilik dan admin.
    if (need.moderation_status !== 'APPROVED' && req.user.role !== 'admin' && !isNeedOwner(need, req.user.id)) {
      return fail(res, 'Kebutuhan tidak ditemukan', 404);
    }

    // Ambil skill yang dibutuhkan
    const [skills] = await pool.query(
      `SELECT s.id, s.name FROM need_skills ns
       JOIN skills s ON s.id = ns.skill_id
       WHERE ns.need_id = ?`,
      [req.params.id]
    );

    return success(res, { ...need, skills });
  } catch (err) {
    next(err);
  }
};

export const createNeed = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const fields = readNeedFields(req.body, { partial: false });

    await conn.beginTransaction();

    const communityId = await assertCommunityAccess(conn, req.user, req.body.community_id);
    const source = req.user.role === 'liaison' ? 'AGENSUSI' : 'MANDIRI';

    const [result] = await conn.query(
      `INSERT INTO needs
        (community_id, requester_id, created_by, title, category, summary, description,
         address, lat, lng, source, moderation_status, risk_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'RENDAH')`,
      [
        communityId,
        req.user.role === 'requester' ? req.user.id : null,
        req.user.id,
        fields.title,
        fields.category || 'LAINNYA',
        fields.summary || null,
        fields.description,
        fields.address || null,
        fields.lat ?? null,
        fields.lng ?? null,
        source,
      ]
    );

    const needId = result.insertId;

    // Catat ke moderation_items otomatis
    await conn.query(
      `INSERT INTO moderation_items
        (item_type, ref_id, title, submitted_by, source, risk_level, decision)
       VALUES ('KEBUTUHAN', ?, ?, ?, ?, 'RENDAH', 'PENDING')`,
      [needId, fields.title, req.user.id, source]
    );

    await audit(conn, { actorId: req.user.id, action: 'CREATE', entity: 'needs', entityId: needId, title: fields.title });

    await conn.commit();

    const [rows] = await pool.query(`SELECT * FROM needs WHERE id = ?`, [needId]);
    return created(res, rows[0], 'Kebutuhan berhasil diajukan, menunggu moderasi');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const updateNeed = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const fields = readNeedFields(req.body, { partial: true });

    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [req.params.id]);
    const need = existing[0];
    if (!need || !isNeedOwner(need, req.user.id)) throw new HttpError(404, 'Kebutuhan tidak ditemukan');

    if (!EDITABLE_MODERATION.includes(need.moderation_status)) {
      throw new HttpError(409, 'Kebutuhan yang sudah disetujui tidak bisa diubah');
    }

    const communityId = req.body.community_id === undefined
      ? undefined
      : await assertCommunityAccess(conn, req.user, req.body.community_id);

    await conn.query(
      `UPDATE needs SET title = COALESCE(?, title), category = COALESCE(?, category),
        description = COALESCE(?, description), summary = COALESCE(?, summary),
        address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
        community_id = IF(?, ?, community_id)
       WHERE id = ?`,
      [fields.title, fields.category, fields.description, fields.summary, fields.address,
        fields.lat, fields.lng, communityId !== undefined, communityId ?? null, need.id]
    );

    const title = fields.title || need.title;
    if (need.moderation_status === 'REJECTED') {
      // Diperbaiki setelah ditolak → masuk antrean moderasi lagi.
      await conn.query(
        `UPDATE needs SET moderation_status = 'PENDING', reject_reason = NULL WHERE id = ?`,
        [need.id]
      );
      await conn.query(
        `INSERT INTO moderation_items (item_type, ref_id, title, submitted_by, source, risk_level, decision)
         VALUES ('KEBUTUHAN', ?, ?, ?, ?, ?, 'PENDING')`,
        [need.id, title, req.user.id, need.source, need.risk_level]
      );
    } else {
      await conn.query(
        `UPDATE moderation_items SET title = ?
         WHERE item_type = 'KEBUTUHAN' AND ref_id = ? AND decision = 'PENDING'`,
        [title, need.id]
      );
    }

    await audit(conn, { actorId: req.user.id, action: 'UPDATE', entity: 'needs', entityId: need.id, title });
    await conn.commit();

    const [rows] = await pool.query(`SELECT * FROM needs WHERE id = ?`, [need.id]);
    return success(res, rows[0], need.moderation_status === 'REJECTED'
      ? 'Kebutuhan diperbarui dan dikirim ulang ke moderasi'
      : 'Kebutuhan diperbarui');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// "Hapus" = tutup lunak. Kebutuhan yang sudah punya proyek ditolak (409) agar riwayat
// proyek, pengiriman, dan reputasi tidak ikut hilang.
export const deleteNeed = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (!existing[0] || !isNeedOwner(existing[0], req.user.id)) throw new HttpError(404, 'Kebutuhan tidak ditemukan');

    await closeNeed(conn, { needId: existing[0].id, actorId: req.user.id, reason: 'Dihapus oleh pemilik' });
    await conn.commit();
    return success(res, { id: existing[0].id, status: 'CLOSED' }, 'Kebutuhan ditutup');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
