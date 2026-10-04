// Body sudah divalidasi zod (validators/schemas.js) sebelum masuk controller.
import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { isNeedOwner } from '../utils/ownership.js';
import { assertCommunityAccess } from '../utils/communityAccess.js';
import { audit } from '../utils/activity.js';
import { closeNeed } from '../services/needService.js';

// Kebutuhan hanya boleh diubah sebelum tayang di katalog.
const EDITABLE_MODERATION = ['PENDING', 'REJECTED'];
// Pemilik efektif = requester, atau liaison untuk kebutuhan jalur Assisted.
const OWNER_CONDITION = `(n.requester_id = ? OR (n.requester_id IS NULL AND n.created_by = ?))`;

async function assertSkillsExist(conn, skillIds) {
  if (!skillIds || skillIds.length === 0) return;
  const [rows] = await conn.query(`SELECT id FROM skills WHERE id IN (?)`, [skillIds]);
  if (rows.length !== skillIds.length) throw new HttpError(400, 'Ada keahlian yang tidak dikenal');
}

async function replaceNeedSkills(conn, needId, skillIds) {
  await conn.query(`DELETE FROM need_skills WHERE need_id = ?`, [needId]);
  if (skillIds.length > 0) {
    await conn.query(`INSERT INTO need_skills (need_id, skill_id) VALUES ?`, [skillIds.map((s) => [needId, s])]);
  }
}

/** Menempelkan daftar skills ke setiap baris kebutuhan (satu query untuk satu halaman). */
async function attachSkills(rows) {
  if (rows.length === 0) return rows;
  const [skills] = await pool.query(
    `SELECT ns.need_id, s.id, s.name FROM need_skills ns JOIN skills s ON s.id = ns.skill_id
     WHERE ns.need_id IN (?) ORDER BY s.name`,
    [rows.map((r) => r.id)]
  );
  const byNeed = new Map();
  for (const s of skills) {
    if (!byNeed.has(s.need_id)) byNeed.set(s.need_id, []);
    byNeed.get(s.need_id).push({ id: s.id, name: s.name });
  }
  return rows.map((r) => ({ ...r, skills: byNeed.get(r.id) || [] }));
}

export const getCatalog = async (req, res, next) => {
  try {
    const { category, sector, search, skill, source } = req.query;
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
    if (source) {
      where += ` AND n.source = ?`;
      params.push(source);
    }
    if (skill) {
      // ?skill=3 (id) atau ?skill=Google%20Sheets (nama)
      const bySkillId = /^\d+$/.test(String(skill));
      where += ` AND EXISTS (SELECT 1 FROM need_skills ns JOIN skills s ON s.id = ns.skill_id
                             WHERE ns.need_id = n.id AND ${bySkillId ? 's.id' : 's.name'} = ?)`;
      params.push(bySkillId ? Number(skill) : skill);
    }
    if (search) {
      where += ` AND (n.title LIKE ? OR n.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.category, n.summary, n.description, n.address,
              n.lat, n.lng, n.sector, n.source, n.created_at,
              c.name AS community_name, c.type AS community_type, c.leader_name, c.members_count,
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

    return success(res, paged(await attachSkills(rows), total, pg));
  } catch (err) {
    next(err);
  }
};

// Requester: kebutuhannya sendiri. Liaison: kebutuhan jalur Assisted yang ia catat (pemilik proksi).
export const getMyNeeds = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const [rows] = await pool.query(
      `SELECT n.*, c.name AS community_name,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id AND a.status = 'MENUNGGU') AS applicants_waiting,
              (SELECT p.id FROM projects p WHERE p.need_id = n.id ORDER BY p.id DESC LIMIT 1) AS project_id,
              (SELECT p.status FROM projects p WHERE p.need_id = n.id ORDER BY p.id DESC LIMIT 1) AS project_status
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       WHERE ${OWNER_CONDITION}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, req.user.id, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM needs n WHERE ${OWNER_CONDITION}`,
      [req.user.id, req.user.id]
    );
    return success(res, paged(await attachSkills(rows), total, pg));
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

    const [withSkills] = await attachSkills([need]);
    return success(res, withSkills);
  } catch (err) {
    next(err);
  }
};

export const createNeed = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = req.body;
    await conn.beginTransaction();

    const communityId = await assertCommunityAccess(conn, req.user, body.community_id);
    await assertSkillsExist(conn, body.skill_ids);
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
        body.title,
        body.category || 'LAINNYA',
        body.summary || null,
        body.description,
        body.address || null,
        body.lat ?? null,
        body.lng ?? null,
        source,
      ]
    );

    const needId = result.insertId;
    if (body.skill_ids) await replaceNeedSkills(conn, needId, body.skill_ids);

    // Catat ke moderation_items otomatis
    await conn.query(
      `INSERT INTO moderation_items
        (item_type, ref_id, title, submitted_by, source, risk_level, decision)
       VALUES ('KEBUTUHAN', ?, ?, ?, ?, 'RENDAH', 'PENDING')`,
      [needId, body.title, req.user.id, source]
    );

    await audit(conn, { actorId: req.user.id, action: 'CREATE', entity: 'needs', entityId: needId, title: body.title });

    await conn.commit();

    const [rows] = await pool.query(`SELECT * FROM needs WHERE id = ?`, [needId]);
    const [withSkills] = await attachSkills(rows);
    return created(res, withSkills, 'Kebutuhan berhasil diajukan, menunggu moderasi');
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
    const body = req.body;
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [req.params.id]);
    const need = existing[0];
    if (!need || !isNeedOwner(need, req.user.id)) throw new HttpError(404, 'Kebutuhan tidak ditemukan');

    if (!EDITABLE_MODERATION.includes(need.moderation_status)) {
      throw new HttpError(409, 'Kebutuhan yang sudah disetujui tidak bisa diubah');
    }

    const communityId = body.community_id === undefined
      ? undefined
      : await assertCommunityAccess(conn, req.user, body.community_id);
    await assertSkillsExist(conn, body.skill_ids);

    await conn.query(
      `UPDATE needs SET title = COALESCE(?, title), category = COALESCE(?, category),
        description = COALESCE(?, description), summary = COALESCE(?, summary),
        address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
        community_id = IF(?, ?, community_id)
       WHERE id = ?`,
      [body.title ?? null, body.category ?? null, body.description ?? null, body.summary ?? null,
        body.address ?? null, body.lat ?? null, body.lng ?? null,
        communityId !== undefined, communityId ?? null, need.id]
    );
    if (body.skill_ids) await replaceNeedSkills(conn, need.id, body.skill_ids);

    const title = body.title || need.title;
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
    const [withSkills] = await attachSkills(rows);
    return success(res, withSkills, need.moderation_status === 'REJECTED'
      ? 'Kebutuhan diperbarui dan dikirim ulang ke moderasi'
      : 'Kebutuhan diperbarui');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Tarik kebutuhan (PRD §7: TERBUKA → DIBATALKAN). Ditolak bila sudah ada proyek aktif.
async function closeOwnNeed(req, res, next, { reason, message }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (!existing[0] || !isNeedOwner(existing[0], req.user.id)) throw new HttpError(404, 'Kebutuhan tidak ditemukan');

    await closeNeed(conn, { needId: existing[0].id, actorId: req.user.id, reason });
    await conn.commit();
    return success(res, { id: existing[0].id, status: 'CLOSED' }, message);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export const withdrawNeed = (req, res, next) =>
  closeOwnNeed(req, res, next, {
    reason: req.body?.reason || 'Ditarik oleh pemilik',
    message: 'Kebutuhan ditarik',
  });

// "Hapus" = tutup lunak, sama dengan tarik. Riwayat proyek & reputasi tidak pernah hilang.
export const deleteNeed = (req, res, next) =>
  closeOwnNeed(req, res, next, { reason: 'Dihapus oleh pemilik', message: 'Kebutuhan ditutup' });
