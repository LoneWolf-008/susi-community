// Tanya SUSI: endpoint chat dasar (T11). Pengguna anonim boleh bertanya; isi chat tidak pernah
// dicatat ke console (hanya nama galat LLM tanpa isi pesan).
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { success, fail } from '../utils/response.js';
import { getLLM } from '../services/llm/index.js';
import { answerMessage } from '../services/chatbot/pipeline.js';
import {
  createSession, findAccessibleSession, claimIfAnonymous, countMessages, addMessage,
  recentMessages, listMessages, MAX_MESSAGES_PER_SESSION,
} from '../services/chatbot/sessions.js';

const logLlmFallback = (error) => {
  if (error && env.nodeEnv !== 'test') console.warn(`[chatbot] LLM gagal (${error}), menjawab dari KB`);
};

export const postMessage = async (req, res, next) => {
  try {
    const { session_id: sessionId, message } = req.body;
    const session = sessionId
      ? await claimIfAnonymous(pool, await findAccessibleSession(pool, sessionId, req.user), req.user)
      : await createSession(pool, req.user);

    if (await countMessages(pool, session.id) >= MAX_MESSAGES_PER_SESSION) {
      return fail(res, 'Percakapan ini sudah terlalu panjang. Mulai percakapan baru, ya.', 409);
    }

    // Riwayat diambil sebelum pesan baru disimpan agar tidak terkirim dua kali ke LLM.
    const history = await recentMessages(pool, session.id, env.chatbot.historyMessages);
    const userMessageId = await addMessage(pool, session.id, 'user', message);
    const answer = await answerMessage({ db: pool, llm: getLLM(), user: req.user, message, history });
    logLlmFallback(answer.llmError);
    const assistantMessageId = await addMessage(pool, session.id, 'assistant', answer.reply);

    await pool.query(
      `INSERT INTO ask_logs
         (user_id, session_id, message_id, question, matched, intent, kb_entry_id, model, prompt_version,
          tokens_in, tokens_out, latency_ms, llm_error, cost_usd, cache_hit, escalated)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        req.user?.id ?? null, session.id, assistantMessageId, message, answer.matched ? 1 : 0, answer.kbEntryId,
        answer.model, answer.promptVersion, answer.usage?.tokensIn ?? null, answer.usage?.tokensOut ?? null,
        answer.latencyMs, answer.llmError, answer.usage?.costUsd ?? null,
      ],
    );

    return success(res, {
      session_id: session.id,
      user_message_id: userMessageId,
      message: { id: assistantMessageId, role: 'assistant', content: answer.reply },
      source: answer.source,
      sources: answer.sources,
    });
  } catch (err) {
    next(err);
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
