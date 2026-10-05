// Rekomendasi talenta ↔ kebutuhan (R1): memuat data profil dari DB, menilai dengan scoreMatch, dan
// menyimpan hasil 60 detik per pengguna. Semua keputusan tetap di tangan manusia; sistem hanya
// mengurutkan dan menjelaskan.
import { scoreMatch } from './score.js';

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 500;
export const DEFAULT_MIN_SCORE = 20;
export const INVITE_LIMIT = 5;
const CANDIDATE_LIMIT = 500;
const ACTIVE_PROJECT_STATUSES = ['AGREEMENT', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'REVISION', 'DISPUTED'];

// ===== Cache per pengguna =====
const cache = new Map();

export function cached(userId, key, compute) {
  const fullKey = `${userId}|${key}`;
  const hit = cache.get(fullKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = compute();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(fullKey, { value, expires: Date.now() + CACHE_TTL_MS });
  // Galat tidak di-cache.
  Promise.resolve(value).catch(() => cache.delete(fullKey));
  return value;
}

/** Buang cache pengguna tertentu (atau semua bila tanpa argumen), mis. setelah melamar/mengundang. */
export function invalidateRecommendations(...userIds) {
  if (userIds.length === 0) {
    cache.clear();
    return;
  }
  const prefixes = userIds.filter(Boolean).map((id) => `${id}|`);
  for (const key of cache.keys()) if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
}

// ===== Data profil talenta =====
const groupBy = (rows, key, pick) => {
  const map = new Map();
  for (const r of rows) {
    const k = Number(r[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(pick(r));
  }
  return map;
};

/** Talenta dengan sertifikat SUSI aktif (U5): bonus kecil di skor dan badge di kartu. */
async function certifiedIds(db, ids) {
  const [rows] = await db.query(
    `SELECT DISTINCT talent_id FROM certificates WHERE talent_id IN (?) AND revoked_at IS NULL`, [ids],
  );
  return new Set(rows.map((r) => Number(r.talent_id)));
}

/**
 * Profil talenta untuk penilaian & tampilan, sekali query per aspek untuk banyak talenta.
 * @returns {Promise<Map<number, object>>} id → { id, name, level, skills, completed_projects, certified, … }
 */
export async function loadTalents(db, talentIds) {
  const ids = [...new Set(talentIds.map(Number))];
  const result = new Map();
  if (ids.length === 0) return result;

  const [users] = await db.query(
    `SELECT u.id, u.name, u.avatar_url, u.status, COALESCE(tp.level, 'TALENTA_MUDA') AS level,
            COALESCE(tp.reputation_points, 0) AS reputation_points
     FROM users u LEFT JOIN talent_profiles tp ON tp.user_id = u.id
     WHERE u.id IN (?) AND u.role = 'talent'`,
    [ids],
  );
  const [skills] = await db.query(
    `SELECT ts.talent_id, s.name FROM talent_skills ts JOIN skills s ON s.id = ts.skill_id
     WHERE ts.talent_id IN (?) ORDER BY s.name`,
    [ids],
  );
  const [projects] = await db.query(
    `SELECT p.talent_id, p.status, n.category, n.sector FROM projects p JOIN needs n ON n.id = p.need_id
     WHERE p.talent_id IN (?)`,
    [ids],
  );
  const [applied] = await db.query(
    `SELECT DISTINCT a.talent_id, n.category FROM applications a JOIN needs n ON n.id = a.need_id
     WHERE a.talent_id IN (?)`,
    [ids],
  );
  const [memberships] = await db.query(
    `SELECT cm.user_id, cm.community_id, c.sector FROM community_members cm JOIN communities c ON c.id = cm.community_id
     WHERE cm.user_id IN (?) AND cm.status = 'ACTIVE'`,
    [ids],
  );
  const certified = await certifiedIds(db, ids);

  const skillsBy = groupBy(skills, 'talent_id', (r) => r.name);
  const projectsBy = groupBy(projects, 'talent_id', (r) => r);
  const appliedBy = groupBy(applied, 'talent_id', (r) => r.category);
  const membershipsBy = groupBy(memberships, 'user_id', (r) => r);

  for (const u of users) {
    const id = Number(u.id);
    const own = projectsBy.get(id) || [];
    const completed = own.filter((p) => p.status === 'COMPLETED');
    const comms = membershipsBy.get(id) || [];
    const sectors = new Set([...comms.map((c) => c.sector), ...completed.map((p) => p.sector)].filter(Boolean));
    result.set(id, {
      id,
      name: u.name,
      avatar_url: u.avatar_url,
      status: u.status,
      level: u.level,
      reputation_points: Number(u.reputation_points),
      skills: skillsBy.get(id) || [],
      completed_projects: completed.length,
      completedCategories: [...new Set(completed.map((p) => p.category))],
      appliedCategories: [...new Set(appliedBy.get(id) || [])],
      communityIds: comms.map((c) => Number(c.community_id)),
      sectors: [...sectors],
      activeProjects: own.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status)).length,
      certified: certified.has(id),
    });
  }
  return result;
}

/** Tempelkan daftar nama keahlian ke baris kebutuhan. */
export async function attachNeedSkills(db, needs) {
  if (needs.length === 0) return needs;
  const [rows] = await db.query(
    `SELECT ns.need_id, s.name FROM need_skills ns JOIN skills s ON s.id = ns.skill_id
     WHERE ns.need_id IN (?) ORDER BY s.name`,
    [needs.map((n) => n.id)],
  );
  const by = groupBy(rows, 'need_id', (r) => r.name);
  return needs.map((n) => ({ ...n, skills: by.get(Number(n.id)) || [] }));
}

const matchFields = (m) => ({
  score: m.score, matched_skills: m.matched_skills, missing_skills: m.missing_skills, reasons: m.reasons, confidence: m.confidence,
});

/**
 * Kebutuhan OPEN + APPROVED yang cocok untuk talenta: belum ia lamar, belum punya proyek aktif.
 * Kebutuhan yang mengundangnya selalu ikut (dengan badge) walau skornya di bawah ambang.
 */
export async function recommendNeeds(db, talentId, { minScore = DEFAULT_MIN_SCORE } = {}) {
  const talent = (await loadTalents(db, [talentId])).get(Number(talentId));
  if (!talent || talent.skills.length === 0) {
    return { items: [], hint: 'Lengkapi keahlian di profil agar sistem bisa mencocokkan Anda dengan kebutuhan komunitas.' };
  }
  const [rows] = await db.query(
    `SELECT n.id, n.title, n.category, n.summary, n.description, n.community_id, n.sector, n.source, n.created_at,
            c.name AS community_name,
            (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants,
            (SELECT i.status FROM need_invites i WHERE i.need_id = n.id AND i.talent_id = ?) AS invite_status
     FROM needs n
     LEFT JOIN communities c ON c.id = n.community_id
     WHERE n.moderation_status = 'APPROVED' AND n.status = 'OPEN'
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.need_id = n.id AND a.talent_id = ?)
       AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.need_id = n.id AND p.status NOT IN ('COMPLETED', 'CANCELLED'))
     ORDER BY n.created_at DESC
     LIMIT ${CANDIDATE_LIMIT}`,
    [talentId, talentId],
  );
  const needs = await attachNeedSkills(db, rows);
  const items = needs
    .map((n) => {
      const m = scoreMatch(talent, n);
      const { description: _description, ...need } = n;
      return { ...need, ...matchFields(m), invited: n.invite_status === 'SENT' };
    })
    // Minimal satu keahlian cocok: bonus komunitas/sektor/kategori saja tidak cukup untuk direkomendasikan.
    .filter((n) => n.invited || (n.matched_skills.length > 0 && n.score >= minScore))
    .sort((a, b) => Number(b.invited) - Number(a.invited) || b.score - a.score || new Date(b.created_at) - new Date(a.created_at));
  return { items };
}

/**
 * Talenta yang cocok untuk satu kebutuhan: semua pelamar (applied) dan talenta lain yang bersedia
 * tampil (`show_in_recommendations`), tanpa akun ditangguhkan. Hanya kolom yang memang boleh dilihat
 * pemilik kebutuhan pada pelamar: nama, level, keahlian, jumlah proyek selesai, sertifikasi.
 */
export async function recommendTalents(db, need, { minScore = DEFAULT_MIN_SCORE, limit = 10 } = {}) {
  const [withSkills] = await attachNeedSkills(db, [need]);
  const [applications] = await db.query(
    `SELECT a.talent_id, a.status FROM applications a WHERE a.need_id = ?`, [need.id],
  );
  const [invites] = await db.query(`SELECT talent_id, status FROM need_invites WHERE need_id = ?`, [need.id]);
  const [others] = await db.query(
    `SELECT u.id FROM users u JOIN user_settings us ON us.user_id = u.id
     WHERE u.role = 'talent' AND u.status = 'AKTIF' AND us.show_in_recommendations = 1
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.need_id = ? AND a.talent_id = u.id)
     LIMIT ${CANDIDATE_LIMIT}`,
    [need.id],
  );
  const applicationOf = new Map(applications.map((a) => [Number(a.talent_id), a.status]));
  const inviteOf = new Map(invites.map((i) => [Number(i.talent_id), i.status]));
  const profiles = await loadTalents(db, [...applicationOf.keys(), ...others.map((o) => o.id)]);

  const view = (t) => {
    const m = scoreMatch(t, withSkills);
    return {
      talent_id: t.id,
      name: t.name,
      avatar_url: t.avatar_url,
      level: t.level,
      skills: t.skills,
      completed_projects: t.completed_projects,
      certified: t.certified,
      applied: applicationOf.has(t.id),
      application_status: applicationOf.get(t.id) ?? null,
      invite_status: inviteOf.get(t.id) ?? null,
      ...matchFields(m),
    };
  };
  const byScore = (a, b) => b.score - a.score || b.completed_projects - a.completed_projects || a.talent_id - b.talent_id;

  const applicants = [...applicationOf.keys()]
    .map((id) => profiles.get(id))
    .filter((t) => t && t.status === 'AKTIF')
    .map(view)
    .sort(byScore);
  const suggested = others
    .map((o) => profiles.get(Number(o.id)))
    .filter((t) => t && t.skills.length > 0)
    .map(view)
    .filter((t) => t.invite_status || (t.matched_skills.length > 0 && t.score >= minScore))
    .sort(byScore)
    .slice(0, limit);

  return {
    need: { id: withSkills.id, title: withSkills.title, status: withSkills.status, skills: withSkills.skills },
    items: [...applicants, ...suggested],
    invites: { used: invites.length, limit: INVITE_LIMIT },
  };
}
