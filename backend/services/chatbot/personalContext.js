// Konteks pribadi Tanya SUSI (R3): ringkasan profil & rekomendasi milik pengguna yang bertanya,
// dibangun di server dari req.user.id (tidak pernah dari id kiriman klien), ringkas (< 400 token),
// tanpa email/telepon. Disuntikkan ke prompt sebagai <user_profile> dan <recommendations>, dan dipakai
// template jawaban tanpa LLM. Tidak pernah disimpan ke chat_messages/ask_logs. Cache 60 detik.
import {
  cached, loadTalents, recommendNeeds, recommendTalents,
} from '../recommendation/index.js';

export const CERT_MIN_PROJECTS = 3;
const LEVEL = { TALENTA_MUDA: 'Talenta Muda', TALENTA_TERPERCAYA: 'Talenta Terpercaya', TALENTA_AHLI: 'Talenta Ahli' };
const CATEGORY = { PENCATATAN: 'Pencatatan & Data', WEBSITE: 'Website', APLIKASI: 'Aplikasi', LAINNYA: 'Lainnya' };
const NEED_STATUS = { OPEN: 'terbuka', IN_PROGRESS: 'sedang dikerjakan', COMPLETED: 'selesai', CLOSED: 'ditutup' };
const TOP_NEEDS = 3;
const TOP_TALENTS_PER_NEED = 2;
const OWNER_NEEDS = 3;

const clip = (text, max = 70) => {
  const s = String(text ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** Keahlian yang paling banyak diminta kebutuhan terbuka (data platform, bukan klaim pasar kerja). */
export async function skillDemand(db, limit = 8) {
  const [rows] = await db.query(
    `SELECT s.name, COUNT(*) AS demand FROM need_skills ns
     JOIN skills s ON s.id = ns.skill_id JOIN needs n ON n.id = ns.need_id
     WHERE n.status = 'OPEN' AND n.moderation_status = 'APPROVED'
     GROUP BY s.id, s.name ORDER BY demand DESC, s.name LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({ name: r.name, demand: Number(r.demand) }));
}

/** Status sertifikasi (tabel `certificates` datang di U5; sebelum itu belum ada sertifikat). */
async function certificationStatus(db, talentId, completed) {
  const [[{ present }]] = await db.query(
    `SELECT COUNT(*) AS present FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'certificates'`,
  );
  let certified = false;
  let pending = false;
  if (present) {
    const [[cert]] = await db.query(
      `SELECT COUNT(*) AS n FROM certificates WHERE talent_id = ? AND revoked_at IS NULL`, [talentId],
    );
    certified = Number(cert.n) > 0;
    const [[req]] = await db.query(
      `SELECT COUNT(*) AS n FROM certification_requests WHERE talent_id = ? AND status = 'PENDING'`, [talentId],
    );
    pending = Number(req.n) > 0;
  }
  return { certified, pending, completed, minProjects: CERT_MIN_PROJECTS, eligible: completed >= CERT_MIN_PROJECTS && !certified && !pending };
}

async function talentContext(db, user) {
  const talent = (await loadTalents(db, [user.id])).get(Number(user.id));
  const [apps] = await db.query(
    `SELECT n.title FROM applications a JOIN needs n ON n.id = a.need_id
     WHERE a.talent_id = ? AND a.status = 'MENUNGGU' ORDER BY a.created_at DESC LIMIT 3`,
    [user.id],
  );
  const [[profileRow]] = await db.query(`SELECT bio FROM users WHERE id = ?`, [user.id]);
  const recs = talent && talent.skills.length > 0 ? (await recommendNeeds(db, user.id)).items.slice(0, TOP_NEEDS) : [];
  const demand = await skillDemand(db);
  const owned = new Set((talent?.skills ?? []).map((s) => s.toLowerCase()));
  const gaps = demand.filter((d) => !owned.has(d.name.toLowerCase())).slice(0, 3);
  const cert = await certificationStatus(db, user.id, talent?.completed_projects ?? 0);

  return {
    role: 'talent',
    skills: talent?.skills ?? [],
    level: talent?.level ?? 'TALENTA_MUDA',
    points: talent?.reputation_points ?? 0,
    completed: talent?.completed_projects ?? 0,
    categories: talent?.completedCategories ?? [],
    activeProjects: talent?.activeProjects ?? 0,
    pendingApplications: apps.map((a) => clip(a.title)),
    hasBio: Boolean(profileRow?.bio && profileRow.bio.trim()),
    recommendations: recs.map((n) => ({
      id: n.id, title: clip(n.title), score: n.score, reason: n.reasons[0] ?? null,
      matched: n.matched_skills, missing: n.missing_skills, invited: n.invited,
    })),
    skillGaps: gaps,
    certification: cert,
  };
}

async function ownerContext(db, user) {
  const [communities] = await db.query(
    `SELECT c.name FROM community_members cm JOIN communities c ON c.id = cm.community_id
     WHERE cm.user_id = ? AND cm.role_in = 'PENGURUS' AND cm.status = 'ACTIVE' LIMIT 3`,
    [user.id],
  );
  const [needs] = await db.query(
    `SELECT n.*, (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id AND a.status = 'MENUNGGU') AS waiting
     FROM needs n
     WHERE (n.requester_id = ? OR (n.requester_id IS NULL AND n.created_by = ?))
       AND n.moderation_status = 'APPROVED' AND n.status IN ('OPEN', 'IN_PROGRESS')
     ORDER BY n.status = 'OPEN' DESC, n.created_at DESC LIMIT ?`,
    [user.id, user.id, OWNER_NEEDS],
  );
  const items = [];
  for (const n of needs) {
    let talents = [];
    if (n.status === 'OPEN') {
      // Hanya kolom yang memang boleh dilihat pemilik pada pelamar (lihat recommendTalents).
      talents = (await recommendTalents(db, n)).items.slice(0, TOP_TALENTS_PER_NEED).map((t) => ({
        id: t.talent_id, name: clip(t.name, 40), level: t.level, score: t.score, matched: t.matched_skills,
        applied: t.applied, invited: t.invite_status === 'SENT',
      }));
    }
    items.push({ id: n.id, title: clip(n.title), status: n.status, waiting: Number(n.waiting) || 0, talents });
  }
  return { role: user.role, communities: communities.map((c) => clip(c.name, 60)), needs: items };
}

/**
 * @returns {Promise<object>} konteks pribadi (lihat talentContext/ownerContext); admin → { role: 'admin' }.
 */
export function personalContext(db, user) {
  return cached(user.id, 'personal-context', async () => {
    if (user.role === 'talent') return talentContext(db, user);
    if (user.role === 'requester' || user.role === 'liaison') return ownerContext(db, user);
    return { role: user.role };
  });
}

// ===== Format untuk prompt =====

/** Blok <user_profile>: siapa penanya, tanpa kontak; ringkas. */
export function formatProfile(ctx) {
  if (ctx.role === 'talent') {
    const c = ctx.certification;
    return [
      'Peran: Talenta',
      `Keahlian: ${ctx.skills.length > 0 ? ctx.skills.join(', ') : '(belum diisi)'}`,
      `Level: ${LEVEL[ctx.level] || ctx.level} (${ctx.points} poin)`,
      `Proyek selesai: ${ctx.completed}${ctx.categories.length ? ` (kategori: ${ctx.categories.map((k) => CATEGORY[k] || k).join(', ')})` : ''}`,
      `Proyek aktif: ${ctx.activeProjects}`,
      `Lamaran menunggu keputusan: ${ctx.pendingApplications.length ? ctx.pendingApplications.map((t) => `"${t}"`).join(', ') : 'tidak ada'}`,
      `Bio profil: ${ctx.hasBio ? 'sudah diisi' : 'belum diisi'}`,
      `Keahlian yang paling banyak diminta kebutuhan terbuka di SUSI dan belum dimiliki: ${ctx.skillGaps.length ? ctx.skillGaps.map((g) => `${g.name} (${g.demand} kebutuhan)`).join(', ') : 'tidak ada'}`,
      `Sertifikasi SUSI: ${c.certified ? 'sudah tersertifikasi' : c.pending ? 'pengajuan sedang ditinjau' : 'belum'}; syarat minimal ${c.minProjects} proyek selesai (punya ${c.completed})`,
    ].join('\n');
  }
  if (ctx.role === 'requester' || ctx.role === 'liaison') {
    return [
      `Peran: ${ctx.role === 'liaison' ? 'AgenSUSI (pemilik proksi kebutuhan)' : 'Komunitas'}`,
      `Komunitas yang dikelola: ${ctx.communities.length ? ctx.communities.join(', ') : '-'}`,
      `Kebutuhan aktif: ${ctx.needs.length ? ctx.needs.map((n) => `"${n.title}" (${NEED_STATUS[n.status] || n.status}, ${n.waiting} pelamar menunggu)`).join('; ') : 'tidak ada'}`,
    ].join('\n');
  }
  return `Peran: ${ctx.role}`;
}

/** Blok <recommendations>: satu-satunya proyek/talenta yang boleh disebut LLM. */
export function formatRecommendations(ctx) {
  if (ctx.role === 'talent') {
    if (ctx.recommendations.length === 0) return '(tidak ada rekomendasi)';
    return ctx.recommendations.map((n, i) => `${i + 1}. [kebutuhan] "${n.title}" — ${n.score}% cocok${n.invited ? ', mengundang Anda' : ''}. ${n.reason ?? ''}${n.missing.length ? ` Keahlian belum dimiliki: ${n.missing.join(', ')}.` : ''}`).join('\n');
  }
  if (ctx.role === 'requester' || ctx.role === 'liaison') {
    const lines = ctx.needs.filter((n) => n.talents.length > 0).flatMap((n) => [
      `Untuk "${n.title}":`,
      ...n.talents.map((t) => `- [talenta] ${t.name}, ${LEVEL[t.level] || t.level} — ${t.score}% cocok${t.matched.length ? ` (${t.matched.join(', ')})` : ''}${t.applied ? ', sudah melamar' : ''}`),
    ]);
    return lines.length ? lines.join('\n') : '(tidak ada rekomendasi)';
  }
  return '(tidak ada rekomendasi)';
}

export const levelLabel = (level) => LEVEL[level] || level;
