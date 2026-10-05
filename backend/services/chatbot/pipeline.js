// Alur jawaban Tanya SUSI (fondasi T11): cari KB → minta LLM menjawab dengan konteks KB →
// bila LLM tidak tersedia/gagal, jawab dari entri KB teratas (bukan error).
// T12 menambah pra-pemeriksaan, intent, cache, data pribadi, anggaran, dan streaming.
import { env } from '../../config/env.js';
import { LLMError } from '../llm/errors.js';
import { searchKb, audiencesFor, kbTitle } from './kb.js';
import { buildSystemPrompt, PROMPT_VERSION } from './prompts.js';

export const FALLBACK_REPLY = 'Maaf, saya belum menemukan jawabannya di panduan SUSI. Coba tanyakan dengan kata lain, atau minta bantuan AgenSUSI agar dibantu langsung.';

/** Riwayat chat → pesan LLM (balasan AgenSUSI dikirim sebagai giliran asisten). */
const toLlmMessages = (history) => history.map((m) => ({
  role: m.role === 'user' ? 'user' : 'assistant',
  content: m.role === 'agent' ? `[Balasan AgenSUSI] ${m.content}` : m.content,
}));

/**
 * @returns {Promise<{reply: string, source: 'llm'|'kb'|'fallback', sources: {id:number, title:string}[],
 *   kbEntryId: number|null, matched: boolean, model: string|null, promptVersion: string|null,
 *   usage: object|null, latencyMs: number, llmError: string|null}>}
 */
export async function answerMessage({ db, llm, user, message, history = [] }) {
  const started = Date.now();
  const kbEntries = await searchKb(db, message, { audiences: audiencesFor(user), limit: 3 });
  const top = kbEntries[0] || null;
  const base = {
    sources: kbEntries.map((e) => ({ id: e.id, title: kbTitle(e) })),
    kbEntryId: top?.id ?? null,
    matched: Boolean(top),
  };
  const fromKb = (llmError) => ({
    ...base,
    reply: top ? top.reply : FALLBACK_REPLY,
    source: top ? 'kb' : 'fallback',
    model: null,
    promptVersion: null,
    usage: null,
    latencyMs: Date.now() - started,
    llmError,
  });

  if (!llm.isConfigured()) return fromKb(null);

  try {
    const result = await llm.complete({
      messages: [
        { role: 'system', content: buildSystemPrompt({ kbEntries }) },
        ...toLlmMessages(history),
        { role: 'user', content: message },
      ],
      maxTokens: env.chatbot.maxTokens,
    });
    return {
      ...base,
      reply: result.content,
      source: 'llm',
      model: result.model,
      promptVersion: PROMPT_VERSION,
      usage: result.usage,
      latencyMs: Date.now() - started,
      llmError: null,
    };
  } catch (err) {
    if (!(err instanceof LLMError)) throw err; // bug di kode kita → biarkan jadi 500
    return fromKb(err.name);
  }
}
