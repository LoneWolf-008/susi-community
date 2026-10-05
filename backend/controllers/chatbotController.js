// Tanya SUSI: endpoint chat (T11–T12). Pengguna anonim boleh bertanya. Isi chat tidak pernah
// dicatat ke console (hanya nama galat), dan PII sudah disamarkan sebelum disimpan (guard.js).
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { success } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import { getLLM } from '../services/llm/index.js';
import { answerMessage, streamAnswer } from '../services/chatbot/pipeline.js';
import { precheck } from '../services/chatbot/guard.js';
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

  // Riwayat diambil sebelum pesan baru disimpan agar tidak terkirim dua kali ke LLM.
  const history = await recentMessages(pool, session.id, env.chatbot.historyMessages);
  const guard = precheck(message);
  const userMessageId = await addMessage(pool, session.id, 'user', guard.text);
  return { session, history, guard, userMessageId };
}

/** Simpan jawaban + satu baris ask_logs (biaya, kualitas, umpan balik). */
async function recordAnswer({ session, guard, answer }, user) {
  const assistantMessageId = await addMessage(pool, session.id, 'assistant', answer.reply);
  await pool.query(
    `INSERT INTO ask_logs
       (user_id, session_id, message_id, question, matched, intent, kb_entry_id, model, prompt_version,
        tokens_in, tokens_out, latency_ms, llm_error, cost_usd, cache_hit, escalated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      user?.id ?? null, session.id, assistantMessageId, guard.text.slice(0, 500), answer.matched ? 1 : 0,
      answer.intent, answer.kbEntryId, answer.model, answer.promptVersion, answer.usage?.tokensIn ?? null,
      answer.usage?.tokensOut ?? null, answer.latencyMs, answer.llmError, answer.usage?.costUsd ?? null,
      answer.cacheHit ? 1 : 0,
    ],
  );
  logIssue(answer.llmError);
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
});

const pipelineContext = (req, turn, extra = {}) => ({
  db: pool,
  llm: getLLM(),
  user: req.user ?? null,
  message: turn.guard.text,
  guard: turn.guard,
  history: turn.history,
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
 * Event: start {session_id, user_message_id} · delta {content} · done {…seperti /message, replace}
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

  send('start', { session_id: turn.session.id, user_message_id: turn.userMessageId });
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
    return success(res, {
      session: { id: session.id, started_at: session.started_at, last_active_at: session.last_active_at },
      messages,
    });
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
