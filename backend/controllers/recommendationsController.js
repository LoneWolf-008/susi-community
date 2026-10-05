// Rekomendasi (R1): kebutuhan yang cocok untuk talenta, talenta yang cocok untuk kebutuhan, dan
// undangan melamar. Skornya deterministik (services/recommendation/score.js); keputusan memilih tetap
// pada pemilik kebutuhan, dan talenta tetap memutuskan sendiri apakah melamar.
import { pool } from '../config/db.js';
import { success, created } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { HttpError } from '../utils/httpError.js';
import { isNeedOwner } from '../utils/ownership.js';
import { notify } from '../utils/activity.js';
import {
  cached, invalidateRecommendations, recommendNeeds, recommendTalents, DEFAULT_MIN_SCORE, INVITE_LIMIT,
} from '../services/recommendation/index.js';

function parseMinScore(value) {
  if (value === undefined || value === '') return DEFAULT_MIN_SCORE;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) throw new HttpError(400, 'min_score harus bilangan bulat 0–100');
  return n;
}

/** GET /recommendations/needs (talenta): kebutuhan terbuka yang paling cocok, dengan alasannya. */
export const needsForTalent = async (req, res, next) => {
  try {
    const minScore = parseMinScore(req.query.min_score);
    const pg = parsePagination(req.query);
    const result = await cached(req.user.id, `needs:${minScore}`, () => recommendNeeds(pool, req.user.id, { minScore }));
    const page = result.items.slice(pg.offset, pg.offset + pg.limit);
    return success(res, { ...paged(page, result.items.length, pg), min_score: minScore, hint: result.hint ?? null });
  } catch (err) {
    next(err);
  }
};

async function findNeed(id) {
  const needId = Number(id);
  if (!Number.isInteger(needId) || needId <= 0) throw new HttpError(400, 'need_id wajib berupa id kebutuhan');
  const [rows] = await pool.query(`SELECT * FROM needs WHERE id = ?`, [needId]);
  if (!rows[0]) throw new HttpError(404, 'Kebutuhan tidak ditemukan');
  return rows[0];
}

/** GET /recommendations/talents?need_id= (pemilik efektif kebutuhan, atau admin). */
export const talentsForNeed = async (req, res, next) => {
  try {
    const need = await findNeed(req.query.need_id);
    if (!isNeedOwner(need, req.user.id) && req.user.role !== 'admin') {
      throw new HttpError(403, 'Rekomendasi talenta hanya untuk pemilik kebutuhan ini');
    }
    const minScore = parseMinScore(req.query.min_score);
    const result = await cached(req.user.id, `talents:${need.id}:${minScore}`, () => recommendTalents(pool, need, { minScore }));
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /needs/:id/invite {talent_id}: pemilik efektif mengundang talenta yang bersedia tampil di
 * rekomendasi untuk melamar. Kebutuhan masih OPEN, maksimal 5 undangan per kebutuhan.
 */
export const inviteTalent = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [needs] = await conn.query(`SELECT * FROM needs WHERE id = ? FOR UPDATE`, [req.params.id]);
    const need = needs[0];
    if (!need) throw new HttpError(404, 'Kebutuhan tidak ditemukan');
    if (!isNeedOwner(need, req.user.id)) throw new HttpError(403, 'Hanya pemilik kebutuhan yang bisa mengundang talenta');
    if (need.moderation_status !== 'APPROVED' || need.status !== 'OPEN') {
      throw new HttpError(409, 'Undangan hanya untuk kebutuhan yang masih terbuka di katalog');
    }

    const talentId = req.body.talent_id;
    const [talents] = await conn.query(
      `SELECT u.id, u.status, us.show_in_recommendations FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id WHERE u.id = ? AND u.role = 'talent'`,
      [talentId],
    );
    const talent = talents[0];
    if (!talent || talent.status !== 'AKTIF') throw new HttpError(404, 'Talenta tidak ditemukan');
    if (talent.show_in_recommendations === 0) throw new HttpError(409, 'Talenta ini memilih tidak tampil di rekomendasi');

    const [[{ applied }]] = await conn.query(
      `SELECT COUNT(*) AS applied FROM applications WHERE need_id = ? AND talent_id = ?`, [need.id, talentId],
    );
    if (applied > 0) throw new HttpError(409, 'Talenta ini sudah melamar kebutuhan Anda');
    const [invites] = await conn.query(`SELECT talent_id FROM need_invites WHERE need_id = ?`, [need.id]);
    if (invites.some((i) => Number(i.talent_id) === Number(talentId))) throw new HttpError(409, 'Talenta ini sudah diundang');
    if (invites.length >= INVITE_LIMIT) throw new HttpError(409, `Kuota undangan untuk kebutuhan ini sudah habis (${INVITE_LIMIT})`);

    const [result] = await conn.query(
      `INSERT INTO need_invites (need_id, talent_id, invited_by) VALUES (?, ?, ?)`, [need.id, talentId, req.user.id],
    );
    await notify(conn, {
      userId: talentId,
      type: 'talenta',
      title: 'Undangan melamar',
      body: `Anda diundang melamar "${need.title}". Lamar bila Anda tertarik.`,
      refType: 'need',
      refId: need.id,
    });
    await conn.commit();
    invalidateRecommendations(req.user.id, talentId);
    return created(res, {
      invite: { id: result.insertId, need_id: need.id, talent_id: talentId, status: 'SENT' },
      invites: { used: invites.length + 1, limit: INVITE_LIMIT },
    }, 'Undangan terkirim');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return next(new HttpError(409, 'Talenta ini sudah diundang'));
    next(err);
  } finally {
    conn.release();
  }
};
