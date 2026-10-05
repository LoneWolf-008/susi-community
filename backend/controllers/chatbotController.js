// Tanya SUSI: endpoint chat (T11–T13, privasi T15). Pengguna anonim boleh bertanya. Isi chat tidak
// pernah dicatat ke console (hanya nama galat), PII sudah disamarkan sebelum disimpan (guard.js), dan
// pilihan privasi pengguna (tanpa AI / tanpa penyimpanan riwayat) dihormati di setiap giliran.
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { success, created } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import { notify } from '../utils/activity.js';
import { getLLM } from '../services/llm/index.js';
import { answerMessage, streamAnswer } from '../services/chatbot/pipeline.js';
import { precheck } from '../services/chatbot/guard.js';
import {
  assessEscalation, openEscalation, sessionTurns, scoreConversation, priorityFor, ruleSummary,
  summarizeConversation, withinServiceHours,
} from '../services/chatbot/escalation.js';
import { escalationCreatedReply, handoffCancelledReply } from '../services/chatbot/replies.js';
import { suggestionsFor } from '../services/chatbot/suggestions.js';
import { chatPrivacy, deleteSessions, NOT_STORED } from '../services/chatbot/privacy.js';
import {
  createSession, findAccessibleSession, claimIfAnonymous, countMessages, addMessage,
  recentMessages, listMessages, MAX_MESSAGES_PER_SESSION,
} from '../services/chatbot/sessions.js';
import {
  ACTIVE_ESCALATION, latestTicket, sessionHandoff, toHandoff, handoffStatus, markReadByUser, closeResolvedForUser,
} from '../services/chatbot/handoff.js';

// Dicatat: kegagalan LLM & keluaran yang diblokir. Tidak dicatat: pembatalan oleh klien dan
// mode hemat (terjadi di setiap pesan setelah anggaran habis).
const QUIET_ERRORS = new Set(['ClientAborted', 'BudgetExceeded']);
const logIssue = (error) => {
  if (error && !QUIET_ERRORS.has(error) && env.nodeEnv !== 'test') console.warn(`[chatbot] ${error}`);
};

/** Sesi (baru/lanjut/klaim), batas panjang, riwayat, pra-pemeriksaan, simpan pesan pengguna. */
async function beginTurn(req) {
  const { session_id: sessionId, message } = req.body;
  const session = sessionId
    ? await claimIfAnonymous(pool, await findAccessibleSession(pool, sessionId, req.user), req.user)
    : await createSession(pool, req.user);

  if (await countMessages(pool, session.id) >= MAX_MESSAGES_PER_SESSION) {
    throw new HttpError(409, 'Percakapan ini sudah terlalu panjang. Mulai percakapan baru, ya.');
  }

  const privacy = await chatPrivacy(pool, req.user);
  const guard = precheck(message);
  const ticket = sessionId ? await latestTicket(pool, session.id) : null;
  // U6: tiket terbuka → AI dijeda. Pesan untuk AgenSUSI selalu disimpan (agen harus bisa membacanya,
  // juga bila riwayat chat dimatikan); PII tetap disamarkan. Tanpa LLM dan tanpa baris ask_logs.
  if (ACTIVE_ESCALATION.includes(ticket?.status)) {
    const userMessageId = await addMessage(pool, session.id, 'user', guard.text);
    return { session, guard, userMessageId, privacy, ticket, handoff: true };
  }
  // Tiket selesai yang belum ditutup pengguna: bertanya lagi berarti kembali ke AI.
  if (handoffStatus(ticket) === 'resolved') await closeResolvedForUser(pool, ticket.id);

  // Riwayat diambil sebelum pesan baru disimpan agar tidak terkirim dua kali ke LLM. Tanpa penyimpanan
  // riwayat, tiap pesan dijawab berdiri sendiri.
  const history = privacy.storeHistory ? await recentMessages(pool, session.id, env.chatbot.historyMessages) : [];
  const userMessageId = await addMessage(pool, session.id, 'user', privacy.storeHistory ? guard.text : NOT_STORED);
  return { session, history, guard, userMessageId, privacy, handoff: false };
}

/**
 * Giliran selama handoff (U6): pesan sudah tersimpan untuk AgenSUSI. AgenSUSI yang menangani diberi
 * notifikasi hanya untuk pesan pertama yang belum ia baca, agar tidak banjir notifikasi.
 */
async function handoffTurn(turn) {
  const { session, ticket, userMessageId, guard } = turn;
  if (ticket.status === 'assigned' && ticket.assigned_to) {
    const [[{ n }]] = await pool.query(
      `SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ? AND role = 'user' AND id > ? AND id < ?`,
      [session.id, Math.max(Number(ticket.agent_read_id), Number(ticket.handoff_message_id ?? 0)), userMessageId],
    );
    if (Number(n) === 0) {
      await notify(pool, {
        userId: ticket.assigned_to, type: 'eskalasi', title: `Pesan baru di tiket #${ticket.id}`, body: guard.text,
        refType: 'escalation', refId: ticket.id,
      });
    }
  }
  return {
    session_id: session.id,
    user_message_id: userMessageId,
    message: null, // AI dijeda: tidak ada jawaban asisten; balasan AgenSUSI datang lewat polling sesi.
    intent: 'handoff',
    source: 'handoff',
    sources: [],
    escalation_suggested: false,
    stored: turn.privacy.storeHistory,
    cards: [],
    handoff: await sessionHandoff(pool, session.id, ticket),
  };
}

/** Simpan jawaban + satu baris ask_logs (biaya, kualitas, umpan balik). */
async function recordAnswer({ session, guard, answer, privacy }, user) {
  const stored = privacy.storeHistory;
  const assistantMessageId = await addMessage(pool, session.id, 'assistant', stored ? answer.reply : NOT_STORED);
  await pool.query(
    `INSERT INTO ask_logs
       (user_id, session_id, message_id, question, matched, intent, kb_entry_id, model, prompt_version,
        tokens_in, tokens_out, latency_ms, llm_error, cost_usd, cache_hit, escalated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      user?.id ?? null, session.id, assistantMessageId, stored ? guard.text.slice(0, 500) : '', answer.matched ? 1 : 0,
      answer.intent, answer.kbEntryId, answer.model, answer.promptVersion, answer.usage?.tokensIn ?? null,
      answer.usage?.tokensOut ?? null, answer.latencyMs, answer.llmError, answer.usage?.costUsd ?? null,
      answer.cacheHit ? 1 : 0,
    ],
  );
  logIssue(answer.llmError);
  // T13: saran eskalasi = saran pipeline ATAU skor sinyal percakapan ≥ ambang (tidak bila sudah ada tiket).
  // Giliran ini dinilai dari teks di memori, jadi sinyal tetap terbaca walau riwayat tidak disimpan.
  const assessment = await assessEscalation(pool, {
    sessionId: session.id, pipelineSuggested: answer.escalationSuggested, currentQuestion: guard.text,
  });
  answer.escalationSuggested = assessment.suggested;
  return assistantMessageId;
}

const responseBody = (turn, assistantMessageId, answer) => ({
  session_id: turn.session.id,
  user_message_id: turn.userMessageId,
  message: { id: assistantMessageId, role: 'assistant', content: answer.reply },
  intent: answer.intent,
  source: answer.source,
  sources: answer.sources,
  escalation_suggested: answer.escalationSuggested,
  // false = riwayat tidak disimpan (pilihan pengguna): FE tidak mengingat id sesi untuk dipulihkan.
  stored: turn.privacy.storeHistory,
  // R3: kartu kebutuhan/talenta dari rekomendasi (tidak disimpan; hanya untuk giliran ini).
  cards: answer.cards ?? [],
  // U6: giliran AI selalu berarti tidak ada handoff aktif (tiket terbuka dialihkan ke handoffTurn).
  handoff: toHandoff(null),
});

const pipelineContext = (req, turn, extra = {}) => ({
  db: pool,
  llm: getLLM(),
  user: req.user ?? null,
  message: turn.guard.text,
  guard: turn.guard,
  history: turn.history,
  aiAllowed: turn.privacy.aiAllowed,
  personalize: turn.privacy.personalize,
  ...extra,
});

export const postMessage = async (req, res, next) => {
  try {
    const turn = await beginTurn(req);
    if (turn.handoff) return success(res, await handoffTurn(turn));
    const answer = await answerMessage(pipelineContext(req, turn));
    const assistantMessageId = await recordAnswer({ ...turn, answer }, req.user);
    return success(res, responseBody(turn, assistantMessageId, answer));
  } catch (err) {
    next(err);
  }
};

/**
 * SSE lewat POST (EventSource hanya mendukung GET; FE memakai fetch + ReadableStream).
 * Event: start {session_id, user_message_id, stored} · delta {content} · done {…seperti /message, replace}
 * · error {message, session_id}. Galat sebelum stream dimulai (validasi, sesi, 409) tetap JSON biasa.
 */
export const streamMessage = async (req, res, next) => {
  let turn;
  try {
    turn = await beginTurn(req);
  } catch (err) {
    return next(err);
  }

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no', // nginx/proxy: jangan menahan stream
  });
  res.flushHeaders();

  // Klien menutup koneksi → hentikan LLM (dan penagihannya); jawaban sebagian tetap dicatat.
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });
  const send = (event, data) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('start', { session_id: turn.session.id, user_message_id: turn.userMessageId, stored: turn.privacy.storeHistory });
  try {
    if (turn.handoff) {
      send('done', await handoffTurn(turn));
      return;
    }
    let answer = null;
    for await (const event of streamAnswer(pipelineContext(req, turn, { signal: abort.signal }))) {
      if (event.type === 'delta') send('delta', { content: event.content });
      else answer = event.answer;
    }
    const assistantMessageId = await recordAnswer({ ...turn, answer }, req.user);
    send('done', { ...responseBody(turn, assistantMessageId, answer), replace: answer.replace });
  } catch (err) {
    if (env.nodeEnv !== 'test') console.error(`[chatbot] stream gagal: ${err.name}${err.code ? ` (${err.code})` : ''}`);
    send('error', { message: 'Maaf, terjadi kesalahan saat menjawab. Coba lagi sebentar lagi.', session_id: turn.session.id });
  } finally {
    if (!res.writableEnded) res.end();
  }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await findAccessibleSession(pool, req.params.id, req.user);
    const afterId = Number.parseInt(req.query.after, 10);
    const messages = await listMessages(pool, session.id, { afterId: Number.isFinite(afterId) && afterId > 0 ? afterId : 0 });
    // Tiket terakhir agar FE bisa menampilkan Ruang AgenSUSI sambil mem-polling balasan (U6: `handoff`).
    const ticket = await latestTicket(pool, session.id);
    return success(res, {
      session: { id: session.id, started_at: session.started_at, last_active_at: session.last_active_at },
      messages,
      escalation: ticket ? { id: ticket.id, status: ticket.status, created_at: ticket.created_at } : null,
      handoff: await sessionHandoff(pool, session.id, ticket),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Pengguna menekan "Hubungi AgenSUSI" (T13): buat tiket + ringkasan, beri tahu semua liaison aktif.
 * Hanya atas tindakan pengguna (server sekadar menyarankan). Satu tiket terbuka per sesi:
 * permintaan berikutnya mengembalikan tiket yang sama.
 */
export const escalate = async (req, res, next) => {
  try {
    const { session_id: sessionId, contact } = req.body;
    if (!req.user && !contact) {
      throw new HttpError(400, 'Isi email atau nomor WhatsApp agar AgenSUSI bisa menghubungi Anda kembali.');
    }
    const session = await claimIfAnonymous(pool, await findAccessibleSession(pool, sessionId, req.user), req.user);
    const [liaisons] = await pool.query(`SELECT id FROM users WHERE role = 'liaison' AND status = 'AKTIF'`);
    const available = liaisons.length > 0 && withinServiceHours();

    const existing = await openEscalation(pool, session.id);
    if (existing) {
      return success(res, { escalation: existing, already_open: true, available, message: null, handoff: await sessionHandoff(pool, session.id) });
    }

    const turns = await sessionTurns(pool, session.id);
    if (turns.length === 0) throw new HttpError(400, 'Tuliskan dulu pertanyaan Anda sebelum meminta bantuan AgenSUSI.');
    const { score, reasons } = scoreConversation(turns);
    const signals = reasons.length > 0 ? reasons : ['user_request'];
    const priority = priorityFor(reasons);
    // Tanpa izin AI atau tanpa riwayat tersimpan: ringkasan aturan saja, tanpa mengirim isi chat ke LLM.
    const privacy = await chatPrivacy(pool, req.user);
    const useLlm = privacy.aiAllowed && privacy.storeHistory;
    // Ringkasan dibuat di luar transaksi: pemanggilan LLM bisa memakan beberapa detik.
    const summary = await summarizeConversation({
      db: pool,
      llm: useLlm ? getLLM() : null,
      transcript: useLlm ? (await recentMessages(pool, session.id, 12)).filter((m) => m.content !== NOT_STORED) : [],
      fallback: ruleSummary({
        role: req.user?.role ?? 'public', questions: turns.map((t) => t.question), reasons, historyStored: privacy.storeHistory,
      }),
    });
    logIssue(summary.llmError);

    const conn = await pool.getConnection();
    let escalation;
    let isNew = false;
    try {
      await conn.beginTransaction();
      // Kunci baris sesi: dua klik bersamaan tidak membuat dua tiket.
      await conn.query(`SELECT id FROM chat_sessions WHERE id = ? FOR UPDATE`, [session.id]);
      escalation = await openEscalation(conn, session.id);
      if (!escalation) {
        const [result] = await conn.query(
          `INSERT INTO escalations (session_id, user_id, contact, reason, score, priority, summary, summary_source,
                                    summary_model, summary_cost_usd)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [session.id, req.user?.id ?? null, contact || null, signals.join(','), Math.min(score, 65535), priority,
            summary.text, summary.source, summary.model ?? null, summary.costUsd ?? null],
        );
        isNew = true;
        // Tiket selesai sebelumnya di sesi ini tidak lagi menunggu penilaian (U6).
        await conn.query(
          `UPDATE escalations SET user_done_at = NOW() WHERE session_id = ? AND status = 'resolved' AND user_done_at IS NULL`,
          [session.id],
        );
        // Jawaban terakhir sebelum eskalasi, untuk analisis "jawaban mana yang berujung eskalasi".
        await conn.query(`UPDATE ask_logs SET escalated = 1 WHERE session_id = ? ORDER BY id DESC LIMIT 1`, [session.id]);
        for (const { id } of liaisons) {
          await notify(conn, {
            userId: id,
            type: 'eskalasi',
            title: priority === 'high' ? 'Eskalasi chat baru (prioritas tinggi)' : 'Eskalasi chat baru',
            body: summary.text,
            refType: 'escalation',
            refId: result.insertId,
          });
        }
        const [[row]] = await conn.query(`SELECT id, status, priority, created_at FROM escalations WHERE id = ?`, [result.insertId]);
        escalation = row;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    if (!isNew) {
      return success(res, { escalation, already_open: true, available, message: null, handoff: await sessionHandoff(pool, session.id) });
    }
    const content = escalationCreatedReply({ id: escalation.id, available, anonymous: !req.user });
    const messageId = await addMessage(pool, session.id, 'assistant', content);
    // U6: bagian AgenSUSI di transkrip dimulai dari pesan konfirmasi ini; pengguna sudah melihat semuanya.
    await pool.query(
      `UPDATE escalations SET handoff_message_id = ?, user_read_id = ? WHERE id = ?`,
      [messageId, messageId, escalation.id],
    );
    return created(res, {
      escalation,
      already_open: false,
      available,
      message: { id: messageId, role: 'assistant', content },
      handoff: await sessionHandoff(pool, session.id),
    }, 'Permintaan bantuan diteruskan ke AgenSUSI');
  } catch (err) {
    next(err);
  }
};

/**
 * "Kembali ke asisten AI" (U6): batalkan permintaan AgenSUSI yang masih terbuka. Idempoten: tanpa tiket
 * terbuka → 200 `cancelled: false`. AgenSUSI yang sudah menangani diberi tahu.
 */
export const cancelHandoff = async (req, res, next) => {
  try {
    const session = await findAccessibleSession(pool, req.body.session_id, req.user);
    const conn = await pool.getConnection();
    let ticket;
    let message = null;
    try {
      await conn.beginTransaction();
      // Kunci baris sesi seperti /escalate: pembatalan tidak balapan dengan tiket baru.
      await conn.query(`SELECT id FROM chat_sessions WHERE id = ? FOR UPDATE`, [session.id]);
      [[ticket]] = await conn.query(
        `SELECT id, status, assigned_to FROM escalations WHERE session_id = ? AND status IN (?) ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [session.id, ACTIVE_ESCALATION],
      );
      if (ticket) {
        await conn.query(
          `UPDATE escalations SET status = 'cancelled', resolved_at = NOW(), user_done_at = NOW() WHERE id = ?`,
          [ticket.id],
        );
        const content = handoffCancelledReply(ticket.id);
        message = { id: await addMessage(conn, session.id, 'assistant', content), role: 'assistant', content };
        await notify(conn, {
          userId: ticket.assigned_to, type: 'eskalasi', title: `Pengguna kembali ke asisten AI (tiket #${ticket.id})`,
          refType: 'escalation', refId: ticket.id,
        });
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return success(
      res,
      { cancelled: Boolean(ticket), message, handoff: await sessionHandoff(pool, session.id) },
      ticket ? 'Anda kembali ke asisten AI' : 'Tidak ada permintaan AgenSUSI yang terbuka',
    );
  } catch (err) {
    next(err);
  }
};

/** Penilaian setelah AgenSUSI selesai (U6): `rating` 1–5, atau tanpa nilai = tutup bagian AgenSUSI saja. */
export const rateHandoff = async (req, res, next) => {
  try {
    const session = await findAccessibleSession(pool, req.body.session_id, req.user);
    const ticket = await latestTicket(pool, session.id);
    if (ticket?.status !== 'resolved') throw new HttpError(409, 'Belum ada bantuan AgenSUSI yang selesai di percakapan ini');
    const rating = req.body.rating ?? null;
    await closeResolvedForUser(pool, ticket.id, rating);
    return success(
      res,
      { ticket_id: ticket.id, rating: ticket.rating ?? rating, handoff: await sessionHandoff(pool, session.id) },
      rating ? 'Terima kasih atas penilaian Anda' : 'Kembali ke asisten AI',
    );
  } catch (err) {
    next(err);
  }
};

/** Pengguna sedang melihat percakapan: balasan AgenSUSI di sesi ini tidak lagi berlencana (U6). */
export const readHandoff = async (req, res, next) => {
  try {
    const session = await findAccessibleSession(pool, req.body.session_id, req.user);
    await markReadByUser(pool, session.id);
    return success(res, { unread: 0 });
  } catch (err) {
    next(err);
  }
};

const preview = (text) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 120 ? `${s.slice(0, 119).trimEnd()}…` : s;
};

/**
 * Ruang AgenSUSI (U6): semua tiket di percakapan milik pengguna, yang masih terbuka dulu. Lencana
 * belum dibaca hanya untuk tiket terakhir tiap sesi (tiket lama sudah selesai).
 */
export const listHandoffs = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id, e.session_id, e.status, e.summary, e.handed_back, e.rating, e.user_done_at, e.user_read_id,
              e.handoff_message_id, e.created_at, e.assigned_at, e.resolved_at, s.last_active_at,
              a.name AS agent_name, a.avatar_url AS agent_avatar,
              e.id = (SELECT MAX(e2.id) FROM escalations e2 WHERE e2.session_id = e.session_id) AS latest,
              (SELECT COUNT(*) FROM chat_messages m
                WHERE m.session_id = e.session_id AND m.role = 'agent' AND m.id > e.user_read_id) AS unread,
              (SELECT m.content FROM chat_messages m WHERE m.session_id = e.session_id ORDER BY m.id DESC LIMIT 1) AS last_content,
              (SELECT m.role FROM chat_messages m WHERE m.session_id = e.session_id ORDER BY m.id DESC LIMIT 1) AS last_role
       FROM escalations e
       JOIN chat_sessions s ON s.id = e.session_id
       LEFT JOIN users a ON a.id = e.assigned_to
       WHERE s.user_id = ?
       ORDER BY e.status IN ('pending', 'assigned') DESC, s.last_active_at DESC, e.id DESC
       LIMIT 50`,
      [req.user.id],
    );
    const [liaisons] = await pool.query(`SELECT id FROM users WHERE role = 'liaison' AND status = 'AKTIF'`);
    const hasLiaison = liaisons.length > 0;
    const available = hasLiaison && withinServiceHours();
    const items = rows.map((r) => {
      const unread = Number(r.latest) ? Number(r.unread) : 0;
      return {
        id: r.id,
        session_id: r.session_id,
        status: r.status,
        handoff: toHandoff(r, { available, hasLiaison, unread }),
        agent: r.agent_name ? { name: r.agent_name, avatar: r.agent_avatar ?? null } : null,
        summary: r.summary,
        handed_back: Boolean(Number(r.handed_back)),
        rating: r.rating ?? null,
        unread,
        last_message: r.last_role ? { role: r.last_role, preview: preview(r.last_content) } : null,
        // Awal bagian AgenSUSI di transkrip (pesan sebelumnya = bagian AI), juga untuk tiket yang sudah ditutup.
        since_message_id: r.handoff_message_id ?? null,
        created_at: r.created_at,
        resolved_at: r.resolved_at,
        last_active_at: r.last_active_at,
      };
    });
    return success(res, { items, unread_total: items.reduce((sum, i) => sum + i.unread, 0) });
  } catch (err) {
    next(err);
  }
};

/** 👍/👎 per jawaban → ask_logs.feedback. Hanya untuk jawaban di sesi yang boleh diakses pemanggil. */
export const postFeedback = async (req, res, next) => {
  try {
    const { session_id: sessionId, message_id: messageId, value } = req.body;
    const session = await findAccessibleSession(pool, sessionId, req.user);
    const [result] = await pool.query(
      `UPDATE ask_logs SET feedback = ? WHERE message_id = ? AND session_id = ?`,
      [value, messageId, session.id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Pesan tidak ditemukan');
    return success(res, { message_id: messageId, feedback: value }, 'Terima kasih atas umpan baliknya');
  } catch (err) {
    next(err);
  }
};

/**
 * Hapus satu percakapan (T15): pemiliknya, atau pemegang id untuk sesi anonim. Tiket eskalasinya ikut
 * terhapus (permintaan bantuan yang masih terbuka dibatalkan); ask_logs dianonimkan.
 */
export const deleteSession = async (req, res, next) => {
  try {
    const session = await findAccessibleSession(pool, req.params.id, req.user);
    const deleted = await deleteSessions(pool, [session.id]);
    return success(res, { deleted }, 'Percakapan dihapus');
  } catch (err) {
    next(err);
  }
};

/** Hapus seluruh riwayat Tanya SUSI milik pengguna yang masuk (T15). */
export const deleteHistory = async (req, res, next) => {
  try {
    const [sessions] = await pool.query(`SELECT id FROM chat_sessions WHERE user_id = ?`, [req.user.id]);
    const deleted = await deleteSessions(pool, sessions.map((s) => s.id));
    // Baris ask_logs yang sesinya sudah tidak ada (terhapus lebih dulu) juga dilepas dari akun.
    await pool.query(`UPDATE ask_logs SET question = '', user_id = NULL WHERE user_id = ?`, [req.user.id]);
    return success(res, { deleted }, 'Riwayat Tanya SUSI dihapus');
  } catch (err) {
    next(err);
  }
};

/** Saran pertanyaan cepat sesuai peran (anonim → saran publik). */
export const getSuggestions = (req, res) => success(res, { suggestions: suggestionsFor(req.user) });

/** Admin: cek konfigurasi & key OpenRouter (kuota) tanpa memanggil model dan tanpa membocorkan key. */
export const health = async (req, res, next) => {
  try {
    const llm = getLLM();
    const base = { provider: llm.name, model: llm.model, fallback_models: llm.fallbackModels, configured: llm.isConfigured() };
    if (!base.configured) return success(res, { ...base, status: 'not_configured' });
    const started = Date.now();
    try {
      const credits = await llm.keyInfo();
      return success(res, { ...base, status: 'ok', latency_ms: Date.now() - started, credits });
    } catch (err) {
      return success(res, { ...base, status: 'error', latency_ms: Date.now() - started, error: err.name, http_status: err.status ?? null });
    }
  } catch (err) {
    next(err);
  }
};
