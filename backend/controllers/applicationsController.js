import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { getNeedOwnerId, isNeedOwner } from '../utils/ownership.js';
import { notify, addProjectEvent } from '../utils/activity.js';

const APPLICATION_STATUSES = ['MENUNGGU', 'DITERIMA', 'DITOLAK'];

export const getMyApplications = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const { status } = req.query;
    if (status !== undefined && !APPLICATION_STATUSES.includes(status)) {
      return fail(res, `status harus salah satu dari: ${APPLICATION_STATUSES.join(', ')}`, 400);
    }
    const where = status ? `WHERE a.talent_id = ? AND a.status = ?` : `WHERE a.talent_id = ?`;
    const params = status ? [req.user.id, status] : [req.user.id];

    // project_id: proyek yang lahir dari lamaran ini (bila diterima), untuk tautan langsung.
    const [rows] = await pool.query(
      `SELECT a.*, n.title, n.category, n.status AS need_status, c.name AS community_name,
              (SELECT p.id FROM projects p WHERE p.application_id = a.id ORDER BY p.id DESC LIMIT 1) AS project_id
       FROM applications a
       JOIN needs n ON n.id = a.need_id
       LEFT JOIN communities c ON c.id = n.community_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM applications a ${where}`, params);
    return success(res, paged(rows, total, pg));
  } catch (err) {
    next(err);
  }
};

// Rekam jejak pelamar (PRD P0-3 & P0-6): proyek selesai, keahlian, 3 testimoni publik terbaru.
async function attachTrackRecord(rows) {
  if (rows.length === 0) return rows;
  const talentIds = [...new Set(rows.map((r) => r.talent_id))];

  const [skills] = await pool.query(
    `SELECT ts.talent_id, s.id, s.name FROM talent_skills ts JOIN skills s ON s.id = ts.skill_id
     WHERE ts.talent_id IN (?) ORDER BY s.name`,
    [talentIds]
  );
  const [testimonials] = await pool.query(
    `SELECT id, to_user_id, text, created_at, project_title, from_name FROM (
       SELECT t.id, t.to_user_id, t.text, t.created_at, n.title AS project_title, u.name AS from_name,
              ROW_NUMBER() OVER (PARTITION BY t.to_user_id ORDER BY t.created_at DESC, t.id DESC) AS rn
       FROM testimonials t
       JOIN projects p ON p.id = t.project_id
       JOIN needs n ON n.id = p.need_id
       JOIN users u ON u.id = t.from_user_id
       WHERE t.to_user_id IN (?) AND t.moderation_status = 'APPROVED' AND t.is_public = 1
     ) ranked WHERE rn <= 3`,
    [talentIds]
  );

  const group = (list, key) => list.reduce((map, item) => {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    const { [key]: _omit, ...rest } = item;
    map.get(k).push(rest);
    return map;
  }, new Map());
  const skillsBy = group(skills, 'talent_id');
  const testimonialsBy = group(testimonials, 'to_user_id');

  return rows.map((r) => ({
    ...r,
    skills: skillsBy.get(r.talent_id) || [],
    recent_testimonials: testimonialsBy.get(r.talent_id) || [],
  }));
}

export const getApplicationsForNeed = async (req, res, next) => {
  try {
    const [need] = await pool.query(`SELECT * FROM needs WHERE id = ?`, [req.params.needId]);
    if (!need[0] || !isNeedOwner(need[0], req.user.id)) return fail(res, 'Kebutuhan tidak ditemukan', 404);

    const pg = parsePagination(req.query);
    // Email/telepon pelamar tidak dibuka di sini; kontak muncul di detail proyek setelah dipilih.
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS talent_name, u.bio, u.extra_info, u.avatar_url,
              tp.reputation_points, tp.level,
              (SELECT COUNT(*) FROM projects p WHERE p.talent_id = a.talent_id AND p.status = 'COMPLETED') AS projects_completed
       FROM applications a
       JOIN users u ON u.id = a.talent_id
       LEFT JOIN talent_profiles tp ON tp.user_id = u.id
       WHERE a.need_id = ?
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [req.params.needId, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM applications WHERE need_id = ?`,
      [req.params.needId]
    );
    return success(res, paged(await attachTrackRecord(rows), total, pg));
  } catch (err) {
    next(err);
  }
};

export const apply = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Kunci baris kebutuhan agar cek duplikasi & status tidak balapan dengan decide().
    const [needs] = await conn.query(
      `SELECT * FROM needs WHERE id = ? AND moderation_status = 'APPROVED' AND status = 'OPEN' FOR UPDATE`,
      [req.params.needId]
    );
    if (!needs[0]) {
      await conn.rollback();
      return fail(res, 'Kebutuhan tidak tersedia', 404);
    }

    const need = needs[0];

    // Cek duplikasi
    const [existing] = await conn.query(
      `SELECT id FROM applications WHERE need_id = ? AND talent_id = ?`,
      [need.id, req.user.id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return fail(res, 'Anda sudah melamar kebutuhan ini', 409);
    }

    // Cek apakah sudah ada proyek aktif untuk need ini
    const [project] = await conn.query(
      `SELECT id FROM projects WHERE need_id = ? AND status NOT IN ('COMPLETED','CANCELLED')`,
      [need.id]
    );
    if (project.length > 0) {
      await conn.rollback();
      return fail(res, 'Kebutuhan ini sudah memiliki talenta', 409);
    }

    const { message } = req.body;
    const text = typeof message === 'string' ? message.trim().slice(0, 2000) : '';

    const [result] = await conn.query(
      `INSERT INTO applications (need_id, talent_id, message) VALUES (?, ?, ?)`,
      [need.id, req.user.id, text || null]
    );

    // Pemilik efektif: requester, atau liaison untuk kebutuhan jalur Assisted.
    await notify(conn, {
      userId: getNeedOwnerId(need),
      type: 'talenta',
      title: 'Lamaran baru',
      body: `Ada talenta yang melamar "${need.title}"`,
      refType: 'need',
      refId: need.id,
    });

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT * FROM applications WHERE id = ?`,
      [result.insertId]
    );
    return created(res, rows[0], 'Lamaran terkirim');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Anda sudah melamar kebutuhan ini', 409);
    next(err);
  } finally {
    conn.release();
  }
};

export const decide = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { decision, scope, done_definition, deadline } = req.body;
    if (!['DITERIMA', 'DITOLAK'].includes(decision)) {
      return fail(res, 'Keputusan tidak valid', 400);
    }
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(String(deadline))) {
      return fail(res, 'Format tenggat harus YYYY-MM-DD', 400);
    }

    await conn.beginTransaction();

    const [found] = await conn.query(`SELECT need_id FROM applications WHERE id = ?`, [req.params.id]);
    if (!found[0]) {
      await conn.rollback();
      return fail(res, 'Lamaran tidak ditemukan', 404);
    }

    // Urutan kunci tetap: kebutuhan dulu, baru lamaran. Dua penerimaan serentak untuk
    // kebutuhan yang sama akan antre di sini, dan yang kedua melihat status terbaru.
    const [needs] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [found[0].need_id]);
    const need = needs[0];
    const [apps] = await conn.query(`SELECT * FROM applications WHERE id = ? FOR UPDATE`, [req.params.id]);
    const app = apps[0];

    if (!isNeedOwner(need, req.user.id)) {
      await conn.rollback();
      return fail(res, 'Akses ditolak', 403);
    }

    if (app.status !== 'MENUNGGU') {
      await conn.rollback();
      return fail(res, `Lamaran sudah diputus (${app.status})`, 409);
    }

    if (decision === 'DITERIMA' && (need.status !== 'OPEN' || need.moderation_status !== 'APPROVED')) {
      await conn.rollback();
      return fail(res, 'Kebutuhan tidak lagi terbuka untuk memilih talenta', 409);
    }

    await conn.query(
      `UPDATE applications SET status = ?, decided_at = NOW() WHERE id = ?`,
      [decision, app.id]
    );

    if (decision === 'DITERIMA') {
      // Tolak lamaran lain untuk need yang sama
      const [others] = await conn.query(
        `SELECT id, talent_id FROM applications WHERE need_id = ? AND id <> ? AND status = 'MENUNGGU'`,
        [need.id, app.id]
      );
      await conn.query(
        `UPDATE applications SET status = 'DITOLAK', decided_at = NOW()
         WHERE need_id = ? AND id <> ? AND status = 'MENUNGGU'`,
        [need.id, app.id]
      );

      // Buat proyek
      const [projRes] = await conn.query(
        `INSERT INTO projects
          (need_id, community_id, requester_id, talent_id, application_id,
           scope, done_definition, deadline, status, progress_pct, agreed_by_community_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AGREEMENT', 5, NOW())`,
        [
          need.id,
          need.community_id,
          getNeedOwnerId(need),
          app.talent_id,
          app.id,
          (typeof scope === 'string' && scope.trim()) || need.description,
          (typeof done_definition === 'string' && done_definition.trim()) || null,
          deadline || null,
        ]
      );

      // Update status need
      await conn.query(
        `UPDATE needs SET status = 'IN_PROGRESS' WHERE id = ?`,
        [need.id]
      );

      await addProjectEvent(conn, {
        projectId: projRes.insertId, actorId: req.user.id, eventType: 'CREATED',
        label: 'Proyek dibuat dari lamaran yang diterima',
      });

      await notify(conn, {
        userId: app.talent_id, type: 'talenta', title: 'Lamaran diterima',
        body: 'Lamaran Anda diterima, silakan tinjau kesepakatan', refType: 'project', refId: projRes.insertId,
      });
      for (const other of others) {
        await notify(conn, {
          userId: other.talent_id, type: 'talenta', title: 'Lamaran ditolak',
          body: 'Lamaran Anda belum diterima kali ini', refType: 'application', refId: other.id,
        });
      }
    } else {
      await notify(conn, {
        userId: app.talent_id, type: 'talenta', title: 'Lamaran ditolak',
        body: 'Lamaran Anda belum diterima kali ini', refType: 'application', refId: app.id,
      });
    }

    await conn.commit();
    return success(res, null, `Lamaran ${decision.toLowerCase()}`);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Kebutuhan ini sudah memiliki proyek', 409);
    next(err);
  } finally {
    conn.release();
  }
};
