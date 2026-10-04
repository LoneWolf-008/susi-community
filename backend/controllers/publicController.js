// Endpoint publik tanpa login (T3.4): hanya agregat dan field terbatas, tanpa kontak/PII.
import { pool } from '../config/db.js';
import { success } from '../utils/response.js';
import { parsePagination, paged } from '../utils/pagination.js';

const SECTORS = ['BARAT–UTARA', 'TIMUR–UTARA', 'BARAT–SELATAN', 'TIMUR–SELATAN'];
const CACHE_SECONDS = 60;

const cacheable = (res) => res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);

export const getStats = async (req, res, next) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT projects_completed, projects_running, talents_total, communities_total, needs_queue AS needs_open
       FROM v_platform_stats`
    );
    const [[{ communities_helped }]] = await pool.query(
      `SELECT COUNT(DISTINCT community_id) AS communities_helped
       FROM projects WHERE status = 'COMPLETED' AND community_id IS NOT NULL`
    );
    const [[{ visits_total }]] = await pool.query(`SELECT COALESCE(SUM(visits), 0) AS visits_total FROM daily_stats`);

    const data = Object.fromEntries(
      Object.entries({ ...stats, communities_helped, visits_total }).map(([k, v]) => [k, Number(v)])
    );
    cacheable(res);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

// Katalog publik: tanpa deskripsi lengkap, alamat, koordinat, maupun nama komunitas.
export const getCatalog = async (req, res, next) => {
  try {
    const { category, sector, search } = req.query;
    const pg = parsePagination(req.query);
    let where = `WHERE n.moderation_status = 'APPROVED' AND n.status = 'OPEN'`;
    const params = [];
    if (category && category !== 'SEMUA') { where += ` AND n.category = ?`; params.push(category); }
    if (sector) { where += ` AND n.sector = ?`; params.push(sector); }
    if (search) {
      where += ` AND (n.title LIKE ? OR n.summary LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.category, n.source, n.sector, n.created_at,
              COALESCE(n.summary, LEFT(n.description, 140)) AS summary,
              c.type AS community_type,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants
       FROM needs n
       LEFT JOIN communities c ON c.id = n.community_id
       ${where}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM needs n ${where}`, params);

    let items = rows;
    if (rows.length > 0) {
      const [skills] = await pool.query(
        `SELECT ns.need_id, s.name FROM need_skills ns JOIN skills s ON s.id = ns.skill_id
         WHERE ns.need_id IN (?) ORDER BY s.name`,
        [rows.map((r) => r.id)]
      );
      items = rows.map((r) => ({ ...r, skills: skills.filter((s) => s.need_id === r.id).map((s) => s.name) }));
    }

    cacheable(res);
    return success(res, paged(items, total, pg));
  } catch (err) {
    next(err);
  }
};

// Titik peta komunitas: koordinat dibulatkan ±100 m, disembunyikan bila pembuatnya
// mematikan show_location; tanpa alamat, WhatsApp, maupun nama pengurus.
export const getCommunities = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query, { defaultLimit: 50 });
    const visible = `COALESCE(us.show_location, 1) = 1`;

    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.type, c.source, c.members_count,
              IF(${visible}, c.sector, NULL) AS sector,
              IF(${visible}, ROUND(c.lat, 3), NULL) AS lat,
              IF(${visible}, ROUND(c.lng, 3), NULL) AS lng,
              (SELECT COUNT(*) FROM needs n
                WHERE n.community_id = c.id AND n.moderation_status = 'APPROVED' AND n.status = 'OPEN') AS needs_open,
              (SELECT COUNT(*) FROM projects p WHERE p.community_id = c.id AND p.status = 'COMPLETED') AS projects_completed
       FROM communities c
       LEFT JOIN user_settings us ON us.user_id = c.created_by
       ORDER BY c.id ASC
       LIMIT ? OFFSET ?`,
      [pg.limit, pg.offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM communities`);

    const [sectorRows] = await pool.query(
      `SELECT c.sector, COUNT(*) AS communities,
              SUM((SELECT COUNT(*) FROM needs n
                    WHERE n.community_id = c.id AND n.moderation_status = 'APPROVED' AND n.status = 'OPEN')) AS needs_open
       FROM communities c
       LEFT JOIN user_settings us ON us.user_id = c.created_by
       WHERE c.sector IS NOT NULL AND ${visible}
       GROUP BY c.sector`
    );
    const sectors = SECTORS.map((sector) => {
      const row = sectorRows.find((r) => r.sector === sector);
      return { sector, communities: Number(row?.communities || 0), needs_open: Number(row?.needs_open || 0) };
    });

    const items = rows.map((r) => ({
      ...r,
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
    }));

    cacheable(res);
    return success(res, { ...paged(items, total, pg), sectors });
  } catch (err) {
    next(err);
  }
};

// Dipanggil frontend sekali per sesi; dibatasi visitLimiter per IP.
export const recordVisit = async (req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO daily_stats (stat_date, visits) VALUES (CURDATE(), 1)
       ON DUPLICATE KEY UPDATE visits = visits + 1`
    );
    return success(res, null, 'Kunjungan tercatat');
  } catch (err) {
    next(err);
  }
};
