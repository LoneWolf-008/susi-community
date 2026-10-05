// Admin Tanya SUSI (T14): manajer basis pengetahuan, pertanyaan tak terjawab, dan statistik.
// Setiap perubahan KB menyinkronkan indeks FULLTEXT dan mengosongkan cache jawaban, sehingga
// entri yang baru diaktifkan langsung dipakai chatbot.
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { success, created } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import { audit } from '../utils/activity.js';
import { parsePagination, paged } from '../utils/pagination.js';
import { getLLM } from '../services/llm/index.js';
import { syncKbIndex } from '../services/chatbot/kb.js';
import { answerCache } from '../services/chatbot/cache.js';
import { canonicalText } from '../services/chatbot/text.js';
import { displayQuestion } from '../services/chatbot/guard.js';
import { spentTodayUsd, isBudgetExceeded } from '../services/chatbot/budget.js';

const KB_STATUSES = ['active', 'draft', 'archived'];
const KB_FIELDS = ['title', 'category', 'keywords', 'reply', 'audience', 'status', 'source'];
// Pertanyaan yang semestinya bisa dijawab KB (bukan basa-basi, di luar topik, atau ditolak).
const ANSWERABLE_INTENTS = ['faq', 'howto', 'complaint'];

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== String(raw)) throw new HttpError(404, 'Entri KB tidak ditemukan');
  return id;
};

const toKbItem = (r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  category: r.category,
  keywords: r.keywords,
  reply: r.reply,
  audience: r.audience,
  status: r.status,
  source: r.source,
  sort_order: r.sort_order,
  updated_at: r.updated_at,
  // Draft hasil penyelesaian eskalasi (jalur peningkatan AI dari jawaban AgenSUSI).
  escalation_id: r.escalation_id ?? null,
});

/** Aturan isi KB: entri aktif wajib bersumber (dokumen, atau eskalasi yang dijawab AgenSUSI). */
function assertSourced(status, source) {
  if (status === 'active' && !String(source ?? '').trim()) {
    throw new HttpError(400, 'Entri aktif wajib mencantumkan sumber (dokumen atau tiket eskalasi). Simpan sebagai draft bila sumbernya belum ada.');
  }
}

async function afterKbChange() {
  await syncKbIndex(pool);
  answerCache.clear();
}

export const listKb = async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    if (status !== 'all' && !KB_STATUSES.includes(status)) {
      throw new HttpError(400, `Status harus salah satu dari: all, ${KB_STATUSES.join(', ')}`);
    }
    const where = [];
    const params = [];
    if (status !== 'all') {
      where.push('k.status = ?');
      params.push(status);
    }
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      where.push('(k.title LIKE ? OR k.keywords LIKE ? OR k.reply LIKE ?)');
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const pg = parsePagination(req.query);
    // Draft dulu (perlu ditinjau), lalu aktif, lalu arsip.
    const [rows] = await pool.query(
      `SELECT k.*, (SELECT e.id FROM escalations e WHERE e.kb_entry_id = k.id ORDER BY e.id DESC LIMIT 1) AS escalation_id
       FROM kb_entries k ${whereSql}
       ORDER BY FIELD(k.status, 'draft', 'active', 'archived'), k.sort_order, k.id
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset],
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM kb_entries k ${whereSql}`, params);
    const [countRows] = await pool.query(`SELECT status, COUNT(*) AS n FROM kb_entries GROUP BY status`);
    const counts = Object.fromEntries(KB_STATUSES.map((s) => [s, 0]));
    for (const r of countRows) counts[r.status] = Number(r.n);
    return success(res, { ...paged(rows.map(toKbItem), total, pg), counts });
  } catch (err) {
    next(err);
  }
};

export const createKb = async (req, res, next) => {
  try {
    const body = req.body;
    const status = body.status ?? 'draft';
    assertSourced(status, body.source);
    const [[{ last }]] = await pool.query(`SELECT COALESCE(MAX(sort_order), 0) AS last FROM kb_entries`);
    const [result] = await pool.query(
      `INSERT INTO kb_entries (title, category, keywords, reply, audience, status, source, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.title, body.category ?? null, body.keywords, body.reply, body.audience ?? 'all', status, body.source ?? null,
        Number(last) + 10],
    );
    await audit(pool, { actorId: req.user.id, action: 'CREATE_KB', entity: 'kb_entries', entityId: result.insertId, title: body.title, meta: { status } });
    await afterKbChange();
    const [[row]] = await pool.query(`SELECT * FROM kb_entries WHERE id = ?`, [result.insertId]);
    return created(res, toKbItem(row), status === 'active' ? 'Entri KB aktif dan langsung dipakai Tanya SUSI' : 'Entri KB disimpan');
  } catch (err) {
    next(err);
  }
};

/** Ubah isi/status. Menyetujui draft = PATCH { status: 'active' } (sumber wajib ada). */
export const updateKb = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const [[current]] = await pool.query(`SELECT * FROM kb_entries WHERE id = ?`, [id]);
    if (!current) throw new HttpError(404, 'Entri KB tidak ditemukan');
    const changes = Object.fromEntries(KB_FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]));
    const merged = { ...current, ...changes };
    assertSourced(merged.status, merged.source);
    const fields = Object.keys(changes);
    await pool.query(
      `UPDATE kb_entries SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map((f) => changes[f]), id],
    );
    const action = changes.status && changes.status !== current.status
      ? { active: 'APPROVE_KB', archived: 'ARCHIVE_KB', draft: 'UNPUBLISH_KB' }[changes.status]
      : 'UPDATE_KB';
    await audit(pool, { actorId: req.user.id, action, entity: 'kb_entries', entityId: id, title: merged.title, meta: { fields } });
    await afterKbChange();
    const [[row]] = await pool.query(
      `SELECT k.*, (SELECT e.id FROM escalations e WHERE e.kb_entry_id = k.id ORDER BY e.id DESC LIMIT 1) AS escalation_id
       FROM kb_entries k WHERE k.id = ?`,
      [id],
    );
    return success(res, toKbItem(row), 'Entri KB diperbarui');
  } catch (err) {
    next(err);
  }
};

/**
 * Pertanyaan yang belum terjawab KB atau dinilai 👎, dikelompokkan per pertanyaan baku, terbanyak
 * dulu. Bahan untuk menulis entri KB baru.
 */
export const listUnanswered = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 365);
    const [rows] = await pool.query(
      `SELECT question, matched, feedback, created_at FROM ask_logs
       WHERE created_at >= NOW() - INTERVAL ? DAY
         AND ((matched = 0 AND intent IN (?)) OR feedback = -1)
       ORDER BY id DESC
       LIMIT 2000`,
      [days, ANSWERABLE_INTENTS],
    );
    const groups = new Map();
    for (const r of rows) {
      const text = displayQuestion(r.question);
      const key = canonicalText(text);
      if (!key) continue;
      const g = groups.get(key) ?? { question: text, count: 0, unanswered: 0, thumbs_down: 0, last_at: r.created_at };
      g.count += 1;
      if (!Number(r.matched)) g.unanswered += 1;
      if (Number(r.feedback) === -1) g.thumbs_down += 1;
      groups.set(key, g);
    }
    const items = [...groups.values()]
      .sort((a, b) => b.count - a.count || new Date(b.last_at) - new Date(a.last_at))
      .slice(0, 50);
    return success(res, { days, items });
  } catch (err) {
    next(err);
  }
};

/** Ringkasan hari ini: jawaban, porsi LLM/cache, belum terjawab, umpan balik, biaya vs anggaran. */
export const chatbotStats = async (req, res, next) => {
  try {
    const [[today]] = await pool.query(
      `SELECT COUNT(*) AS answers,
              COALESCE(SUM(model IS NOT NULL), 0) AS llm,
              COALESCE(SUM(cache_hit = 1), 0) AS cache,
              COALESCE(SUM(matched = 0 AND intent IN (?)), 0) AS unanswered,
              COALESCE(SUM(feedback = 1), 0) AS thumbs_up,
              COALESCE(SUM(feedback = -1), 0) AS thumbs_down,
              COALESCE(ROUND(AVG(latency_ms)), 0) AS avg_latency_ms
       FROM ask_logs WHERE created_at >= CURDATE()`,
      [ANSWERABLE_INTENTS],
    );
    const [[esc]] = await pool.query(
      `SELECT COALESCE(SUM(status = 'pending'), 0) AS pending, COALESCE(SUM(status = 'assigned'), 0) AS assigned FROM escalations`,
    );
    const [kbRows] = await pool.query(`SELECT status, COUNT(*) AS n FROM kb_entries GROUP BY status`);
    const spent = await spentTodayUsd(pool);
    const llm = getLLM();
    return success(res, {
      today: Object.fromEntries(Object.entries(today).map(([k, v]) => [k, Number(v)])),
      cost_today_usd: spent,
      budget_usd: env.chatbot.dailyBudgetUsd,
      budget_exceeded: isBudgetExceeded(spent, env.chatbot.dailyBudgetUsd),
      llm: { provider: llm.name, model: llm.model, configured: llm.isConfigured() },
      escalations: { pending: Number(esc.pending), assigned: Number(esc.assigned) },
      kb: Object.fromEntries(KB_STATUSES.map((s) => [s, Number(kbRows.find((r) => r.status === s)?.n ?? 0)])),
    });
  } catch (err) {
    next(err);
  }
};
