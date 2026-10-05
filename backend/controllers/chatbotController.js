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
import { escalationCreatedReply } from '../services/chatbot/replies.js';
import { suggestionsFor } from '../services/chatbot/suggestions.js';
import { chatPrivacy, deleteSessions, NOT_STORED } from '../services/chatbot/privacy.js';
import {
  createSession, findAccessibleSession, claimIfAnonymous, countMessages, addMessage,
  recentMessages, listMessages, MAX_MESSAGES_PER_SESSION,
} from '../services/chatbot/sessions.js';

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
  // Riwayat diambil sebelum pesan baru disimpan agar tidak terkirim dua kali ke LLM. Tanpa penyimpanan
  // riwayat, tiap pesan dijawab berdiri sendiri.
  const history = privacy.storeHistory ? await recentMessages(pool, session.id, env.chatbot.historyMessages) : [];
  const guard = precheck(message);
  const userMessageId = await addMessage(pool, session.id, 'user', privacy.storeHistory ? guard.text : NOT_STORED);
  return { session, history, guard, userMessageId, privacy };
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
});

const pipelineContext = (req, turn, extra = {}) => ({
  db: pool,
  llm: getLLM(),
  user: req.user ?? null,
  message: turn.guard.text,
  guard: turn.guard,
  history: turn.history,
  aiAllowed: turn.privacy.aiAllowed,
  ...extra,
});

export const postMessage = async (req, res, next) => {
  try {
    const turn = await beginTurn(req);
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
    // Status tiket terakhir agar FE bisa menampilkan "menunggu AgenSUSI" sambil mem-polling balasan.
    const [escalations] = await pool.query(
      `SELECT id, status, created_at FROM escalations WHERE session_id = ? ORDER BY id DESC LIMIT 1`,
      [session.id],
    );
    return success(res, {
      session: { id: session.id, started_at: session.started_at, last_active_at: session.last_active_at },
      messages,
      escalation: escalations[0] ?? null,
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
    if (existing) return success(res, { escalation: existing, already_open: true, available, message: null });

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

    if (!isNew) return success(res, { escalation, already_open: true, available, message: null });
    const content = escalationCreatedReply({ id: escalation.id, available, anonymous: !req.user });
    const messageId = await addMessage(pool, session.id, 'assistant', content);
    return created(res, {
      escalation,
      already_open: false,
      available,
      message: { id: messageId, role: 'assistant', content },
    }, 'Permintaan bantuan diteruskan ke AgenSUSI');
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
