// Klien OpenRouter Chat Completions memakai fetch bawaan Node (tanpa SDK).
// Rujukan (diperiksa Okt 2026): https://openrouter.ai/docs/api-reference/chat-completion
//  - fallback model: `models` = daftar berurutan [utama, ...cadangan]; `model` respons = model yang melayani
//  - usage (token & `cost`) selalu dikirim; `usage: {include: true}` sudah usang
//  - atribusi: `HTTP-Referer` + `X-OpenRouter-Title`
//  - SSE: komentar ": OPENROUTER PROCESSING", chunk usage sebelum "data: [DONE]",
//    galat di tengah stream = event `{ error, choices: [{ finish_reason: 'error' }] }`
//  - reasoning ikut memakan max_tokens (bisa membuat content kosong)
//
// API key hanya dipakai di header permintaan; tidak pernah masuk pesan galat atau log.
import {
  LLMNotConfigured, LLMTimeout, LLMRateLimited, LLMUnavailable, LLMEmptyResponse,
} from './errors.js';
import { estimateCostUsd } from './pricing.js';

const BASE_URL = 'https://openrouter.ai/api/v1';
// Model yang berpikir dulu memakai token dari max_tokens; beri ruang agar jawaban tidak kosong.
const REASONING_HEADROOM_TOKENS = 1024;
const RETRYABLE = (status) => status === 429 || status >= 500;

/** Status HTTP → galat bertipe (tanpa isi pesan provider, yang bisa memuat potongan prompt). */
function errorFromStatus(status, code) {
  const meta = { status, code };
  if (status === 429) return new LLMRateLimited('OpenRouter membatasi permintaan (429)', meta);
  if (status === 408) return new LLMTimeout('Provider melewati batas waktu (408)', meta);
  if (status === 401) return new LLMUnavailable('Key OpenRouter ditolak (401)', meta);
  if (status === 402) return new LLMUnavailable('Kredit OpenRouter tidak cukup (402)', meta);
  if (status === 403) return new LLMUnavailable('Permintaan diblokir OpenRouter/moderasi (403)', meta);
  return new LLMUnavailable(`OpenRouter galat ${status}`, meta);
}

const readErrorCode = async (res) => {
  try {
    const body = await res.json();
    return body?.error?.code ?? null;
  } catch {
    return null;
  }
};

function toUsage(raw, servedModel) {
  const tokensIn = Number(raw?.prompt_tokens) || 0;
  const tokensOut = Number(raw?.completion_tokens) || 0;
  const reported = typeof raw?.cost === 'number' && Number.isFinite(raw.cost);
  return {
    tokensIn,
    tokensOut,
    costUsd: reported ? raw.cost : estimateCostUsd(servedModel, tokensIn, tokensOut),
    costEstimated: !reported,
  };
}

/**
 * @param {object} options
 * @param {string|null} options.apiKey
 * @param {string} options.model                model utama (mis. anthropic/claude-haiku-4.5)
 * @param {string[]} [options.fallbackModels]   cadangan berurutan
 * @param {number} [options.timeoutMs]          batas waktu per percobaan (stream: per jeda antar-chunk)
 * @param {string|null} [options.referer]       HTTP-Referer (atribusi)
 * @param {string} [options.title]              X-OpenRouter-Title (atribusi)
 * @param {'allow'|'deny'} [options.dataCollection]
 * @param {string|null} [options.reasoningEffort]
 * @param {typeof fetch} [options.fetchImpl]    disuntik saat test
 */
export function createOpenRouterClient({
  apiKey,
  model,
  fallbackModels = [],
  timeoutMs = 12000,
  referer = null,
  title = 'SUSI Community',
  dataCollection = 'deny',
  reasoningEffort = null,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
}) {
  const headers = () => {
    const h = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    if (referer) h['HTTP-Referer'] = referer;
    if (title) h['X-OpenRouter-Title'] = title;
    return h;
  };

  const buildBody = ({ messages, maxTokens, stream }) => {
    const body = { model, messages, max_tokens: maxTokens, stream };
    if (fallbackModels.length > 0) body.models = [model, ...fallbackModels];
    body.provider = { data_collection: dataCollection };
    if (reasoningEffort === 'none') {
      body.reasoning = { effort: 'none' };
    } else if (reasoningEffort) {
      body.reasoning = { effort: reasoningEffort, exclude: true };
      body.max_tokens += REASONING_HEADROOM_TOKENS;
    }
    return body;
  };

  /**
   * Satu permintaan HTTP dengan batas waktu. Timer & controller dikembalikan agar pemanggil bisa
   * terus memakainya selama membaca badan respons (termasuk stream).
   */
  async function send(path, { method = 'POST', body, signal }) {
    if (!apiKey) throw new LLMNotConfigured('OPENROUTER_API_KEY belum diisi');
    const controller = new AbortController();
    let timedOut = false;
    let timer = null;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    };
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener('abort', onCallerAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    };
    const translate = (err) => {
      if (timedOut) return new LLMTimeout(`OpenRouter tidak merespons dalam ${timeoutMs} ms`);
      if (signal?.aborted) return err; // dibatalkan pemanggil (mis. klien SSE terputus)
      if (err instanceof Error && err.name.startsWith('LLM')) return err;
      return new LLMUnavailable('Gagal terhubung ke OpenRouter', { code: err?.cause?.code ?? null });
    };

    arm();
    try {
      const res = await fetchImpl(`${BASE_URL}${path}`, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return { res, arm, cleanup, controller, translate };
    } catch (err) {
      cleanup();
      throw translate(err);
    }
  }

  /** Jalankan `attemptFn` dan ulangi SATU kali dengan jitter bila 429/5xx/jaringan (bukan timeout). */
  async function withRetry(attemptFn) {
    try {
      return await attemptFn();
    } catch (err) {
      const retryable = err instanceof LLMRateLimited
        || (err instanceof LLMUnavailable && (err.status === null || RETRYABLE(err.status)));
      if (!retryable) throw err;
      await sleep(250 + Math.floor(random() * 500));
      return attemptFn();
    }
  }

  /** Kirim & pastikan status 2xx; galat HTTP dipetakan ke tipe yang sesuai. */
  async function sendOk(path, opts) {
    const handle = await send(path, opts);
    if (!handle.res.ok) {
      const code = await readErrorCode(handle.res);
      handle.cleanup();
      throw errorFromStatus(handle.res.status, code);
    }
    return handle;
  }

  return {
    name: 'openrouter',
    model,
    fallbackModels,
    isConfigured: () => Boolean(apiKey),

    /**
     * Jawaban utuh (non-stream).
     * @returns {Promise<{content: string, model: string, finishReason: string|null,
     *   usage: {tokensIn: number, tokensOut: number, costUsd: number, costEstimated: boolean}, latencyMs: number}>}
     */
    async complete({ messages, maxTokens, signal }) {
      const started = Date.now();
      return withRetry(async () => {
        const handle = await sendOk('/chat/completions', { body: buildBody({ messages, maxTokens, stream: false }), signal });
        let data;
        try {
          data = await handle.res.json();
        } catch (err) {
          throw handle.translate(err);
        } finally {
          handle.cleanup();
        }
        if (data?.error) throw new LLMUnavailable('OpenRouter mengembalikan galat', { code: data.error.code ?? null });
        const choice = data?.choices?.[0];
        const finishReason = choice?.finish_reason ?? null;
        if (finishReason === 'error') throw new LLMUnavailable('Provider gagal menyelesaikan jawaban', { code: 'finish_error' });
        const content = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
        if (!content || choice?.message?.refusal) {
          throw new LLMEmptyResponse(`Model tidak mengembalikan teks (finish_reason=${finishReason})`, { code: finishReason });
        }
        const servedModel = data.model || model;
        return { content, model: servedModel, finishReason, usage: toUsage(data.usage, servedModel), latencyMs: Date.now() - started };
      });
    },

    /**
     * Jawaban bertahap (SSE). Menghasilkan `{ type: 'delta', content }` lalu satu
     * `{ type: 'done', content, model, finishReason, usage, latencyMs }`.
     * Retry hanya sebelum stream dimulai. Menghentikan iterasi membatalkan permintaan (dan penagihan).
     */
    async* stream({ messages, maxTokens, signal }) {
      const started = Date.now();
      const handle = await withRetry(() => sendOk('/chat/completions', { body: buildBody({ messages, maxTokens, stream: true }), signal }));
      const reader = handle.res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let servedModel = model;
      let finishReason = null;
      let usage = null;
      let finished = false;
      try {
        while (!finished) {
          handle.arm(); // batas waktu = jeda maksimal antar-chunk
          let chunk;
          try {
            chunk = await reader.read();
          } catch (err) {
            throw handle.translate(err);
          }
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let newline;
          while (!finished && (newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).replace(/\r$/, '');
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith('data:')) continue; // baris kosong & komentar ": OPENROUTER PROCESSING"
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              finished = true;
              break;
            }
            let event;
            try {
              event = JSON.parse(data);
            } catch {
              continue;
            }
            if (event.error) throw new LLMUnavailable('Galat provider di tengah stream', { code: event.error.code ?? null });
            if (event.model) servedModel = event.model;
            if (event.usage) usage = event.usage;
            const choice = event.choices?.[0];
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            const delta = choice?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              content += delta;
              yield { type: 'delta', content: delta };
            }
          }
        }
        if (!content.trim()) {
          throw new LLMEmptyResponse(`Model tidak mengembalikan teks (finish_reason=${finishReason})`, { code: finishReason });
        }
        yield {
          type: 'done', content: content.trim(), model: servedModel, finishReason,
          usage: toUsage(usage, servedModel), latencyMs: Date.now() - started,
        };
      } finally {
        handle.cleanup();
        if (!finished) handle.controller.abort(); // berhenti lebih awal → hentikan pemrosesan di provider
        reader.releaseLock?.();
      }
    },

    /** Status key (kuota & pemakaian) tanpa memanggil model dan tanpa membocorkan key/label. */
    async keyInfo({ signal } = {}) {
      const handle = await sendOk('/key', { method: 'GET', signal });
      let body;
      try {
        body = await handle.res.json();
      } catch (err) {
        throw handle.translate(err);
      } finally {
        handle.cleanup();
      }
      const d = body?.data || {};
      return {
        limit: d.limit ?? null,
        limitRemaining: d.limit_remaining ?? null,
        usageDaily: d.usage_daily ?? null,
        usageMonthly: d.usage_monthly ?? null,
        isFreeTier: d.is_free_tier ?? null,
      };
    },
  };
}
