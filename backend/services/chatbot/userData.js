// Data pribadi untuk intent status_data (T12.2.5). Setiap query memakai id pengguna dari token
// (req.user), tidak pernah id kiriman klien. Yang diambil hanya judul & status milik penanya —
// tanpa nama, kontak, atau isi pesan pihak lain — agar aman disuntikkan ke konteks LLM.

const PROJECT_STATUS = {
  AGREEMENT: 'DITERIMA (menunggu talenta menyetujui kesepakatan)',
  IN_PROGRESS: 'DIKERJAKAN',
  REVISION: 'REVISI (komunitas minta perbaikan)',
  AWAITING_VERIFICATION: 'MENUNGGU VERIFIKASI',
  COMPLETED: 'TERVERIFIKASI',
  DISPUTED: 'SENGKETA (dimediasi admin)',
  CANCELLED: 'DIBATALKAN',
};
const NEED_STATUS = { OPEN: 'TERBUKA', IN_PROGRESS: 'DIKERJAKAN', COMPLETED: 'SELESAI', CLOSED: 'DITUTUP' };
const MODERATION = { PENDING: 'MENUNGGU MODERASI', APPROVED: 'TAYANG', REJECTED: 'DITOLAK' };
const LEVEL = { TALENTA_MUDA: 'Talenta Muda', TALENTA_TERPERCAYA: 'Talenta Terpercaya', TALENTA_AHLI: 'Talenta Ahli' };

// Topik yang masuk akal per peran, dan ringkasan bawaan bila pertanyaannya umum ("status saya").
const ROLE_TOPICS = {
  talent: ['projects', 'applications', 'reputation', 'notifications'],
  requester: ['needs', 'projects', 'notifications'],
  liaison: ['needs', 'projects', 'notifications'],
  admin: ['notifications'],
};
const DEFAULT_TOPICS = {
  talent: ['projects', 'applications', 'reputation'],
  requester: ['needs', 'projects'],
  liaison: ['needs', 'projects'],
  admin: ['notifications'],
};

const LIMIT = 5;

/** Topik yang diminta → topik yang berlaku untuk peran ini (lamaran ⇄ kebutuhan dipetakan silang). */
export function resolveTopics(role, asked = []) {
  const allowed = ROLE_TOPICS[role] || ['notifications'];
  const mapped = asked.flatMap((topic) => {
    if (allowed.includes(topic)) return [topic];
    if (topic === 'applications' && allowed.includes('needs')) return ['needs']; // pemilik: pelamar di kebutuhannya
    if (topic === 'needs' && allowed.includes('applications')) return ['applications'];
    return [];
  });
  const topics = [...new Set(mapped)];
  return topics.length > 0 ? topics : DEFAULT_TOPICS[role] || ['notifications'];
}

const clip = (text, max = 80) => {
  const s = String(text ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};
const pad = (n) => String(n).padStart(2, '0');
// Kolom DATE dari mysql2 = Date tengah malam waktu lokal; getter lokal agar tanggal tidak bergeser.
const ymd = (value) => {
  if (!value) return null;
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return String(value).slice(0, 10);
};

/**
 * @returns {Promise<{ role: string, topics: string[], projects?: object, applications?: object,
 *   needs?: object, reputation?: object|null, notifications?: object }>}
 *   Setiap daftar berbentuk `{ items, more }` (paling banyak 5 item terbaru).
 */
export async function fetchUserData(db, user, askedTopics = []) {
  const topics = resolveTopics(user.role, askedTopics);
  const data = { role: user.role, topics };
  const page = (rows) => ({ items: rows.slice(0, LIMIT), more: rows.length > LIMIT });

  if (topics.includes('projects')) {
    // Pemilik proyek = requester_id (pemilik efektif kebutuhan, termasuk liaison sebagai pemilik proksi).
    const owner = user.role === 'talent' ? 'p.talent_id = ?' : 'p.requester_id = ?';
    const [rows] = await db.query(
      `SELECT n.title, p.status, p.deadline FROM projects p JOIN needs n ON n.id = p.need_id
       WHERE ${owner} ORDER BY p.updated_at DESC, p.id DESC LIMIT ?`,
      [user.id, LIMIT + 1],
    );
    data.projects = page(rows.map((r) => ({ title: clip(r.title), status: PROJECT_STATUS[r.status] || r.status, deadline: ymd(r.deadline) })));
  }

  if (topics.includes('applications')) {
    const [rows] = await db.query(
      `SELECT n.title, a.status FROM applications a JOIN needs n ON n.id = a.need_id
       WHERE a.talent_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
      [user.id, LIMIT + 1],
    );
    data.applications = page(rows.map((r) => ({ title: clip(r.title), status: r.status })));
  }

  if (topics.includes('needs')) {
    const [rows] = await db.query(
      `SELECT n.title, n.moderation_status, n.reject_reason, n.status,
              (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id AND a.status = 'MENUNGGU') AS waiting
       FROM needs n
       WHERE n.requester_id = ? OR (n.requester_id IS NULL AND n.created_by = ?)
       ORDER BY n.created_at DESC, n.id DESC LIMIT ?`,
      [user.id, user.id, LIMIT + 1],
    );
    data.needs = page(rows.map((r) => ({
      title: clip(r.title),
      moderation: MODERATION[r.moderation_status] || r.moderation_status,
      rejectReason: r.moderation_status === 'REJECTED' ? r.reject_reason : null,
      status: r.moderation_status === 'APPROVED' ? NEED_STATUS[r.status] || r.status : null,
      waiting: Number(r.waiting) || 0,
    })));
  }

  if (topics.includes('reputation')) {
    const [rows] = await db.query(
      `SELECT reputation_points, level, next_level_target FROM talent_profiles WHERE user_id = ?`,
      [user.id],
    );
    data.reputation = rows[0]
      ? { points: Number(rows[0].reputation_points), level: LEVEL[rows[0].level] || rows[0].level, nextTarget: Number(rows[0].next_level_target) }
      : null;
  }

  if (topics.includes('notifications')) {
    const [[{ unread }]] = await db.query(
      `SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0`,
      [user.id],
    );
    const [rows] = await db.query(
      `SELECT title FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC, id DESC LIMIT 3`,
      [user.id],
    );
    data.notifications = { unread: Number(unread), latest: rows.map((r) => clip(r.title, 60)) };
  }
  return data;
}

// ===== Format =====

const projectLine = (p) => `"${p.title}" — ${p.status}${p.deadline ? `, tenggat ${p.deadline}` : ''}`;
const needLine = (n) => {
  if (n.moderation !== 'TAYANG') return `"${n.title}" — ${n.moderation}${n.rejectReason ? ` (alasan: ${n.rejectReason})` : ''}`;
  return `"${n.title}" — ${n.status}${n.status === 'TERBUKA' ? `, ${n.waiting} pelamar menunggu keputusan` : ''}`;
};
const applicationLine = (a) => `"${a.title}" — ${a.status}`;

function sections(data) {
  const out = [];
  const list = (label, value, line, empty) => {
    if (!value) return;
    if (value.items.length === 0) {
      out.push({ label, lines: [], empty });
      return;
    }
    out.push({ label, lines: value.items.map(line), more: value.more });
  };
  list('Kebutuhan', data.needs, needLine, 'belum ada kebutuhan yang Anda ajukan.');
  list('Proyek', data.projects, projectLine, 'belum ada proyek.');
  list('Lamaran', data.applications, applicationLine, 'belum ada lamaran.');
  if ('reputation' in data) {
    const r = data.reputation;
    out.push({
      label: 'Reputasi',
      text: r
        ? `${r.points} poin, level ${r.level}${r.nextTarget > r.points ? `, target level berikutnya ${r.nextTarget} poin` : ''}.`
        : 'belum tercatat.',
    });
  }
  if (data.notifications) {
    const n = data.notifications;
    out.push({
      label: 'Notifikasi belum dibaca',
      text: n.unread > 0 ? `${n.unread} (terbaru: ${n.latest.map((t) => `"${t}"`).join(', ')}).` : 'tidak ada.',
    });
  }
  return out;
}

/** Ringkasan untuk blok <user_data> di prompt. */
export function formatUserDataForPrompt(data) {
  return sections(data).map((s) => {
    if (s.text) return `${s.label}: ${s.text}`;
    if (s.lines.length === 0) return `${s.label}: ${s.empty}`;
    return `${s.label} (terbaru dulu${s.more ? ', masih ada yang lebih lama' : ''}):\n${s.lines.map((l) => `- ${l}`).join('\n')}`;
  }).join('\n');
}

/** Jawaban langsung tanpa LLM (LLM mati, gagal, atau anggaran habis). */
export function formatUserDataReply(data) {
  const parts = sections(data);
  const nothing = parts.every((s) => (s.lines ? s.lines.length === 0 : s.text === 'belum tercatat.' || s.text === 'tidak ada.'));
  if (nothing) return 'Belum ada kebutuhan, proyek, atau lamaran yang tercatat di akun Anda. Detailnya bisa dipantau di dasbor.';
  const body = parts.map((s) => {
    if (s.text) return `${s.label}: ${s.text}`;
    if (s.lines.length === 0) return `${s.label}: ${s.empty}`;
    return `${s.label}:\n${s.lines.map((l) => `• ${l}`).join('\n')}${s.more ? '\n• …dan yang lebih lama di dasbor' : ''}`;
  });
  return ['Berikut ringkasan akun Anda:', ...body, 'Detail lengkap ada di dasbor.'].join('\n');
}
