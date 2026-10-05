import { describe, it, expect } from 'vitest';
import { createOpenRouterClient } from '../../services/llm/openrouter.js';
import {
  LLMNotConfigured, LLMTimeout, LLMRateLimited, LLMUnavailable, LLMEmptyResponse,
} from '../../services/llm/errors.js';

const KEY = 'sk-or-v1-RAHASIA-UJI-123';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (content = 'Halo dari model', extra = {}) => json(200, {
  model: 'anthropic/claude-haiku-4.5',
  choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150, cost: 0.00027 },
  ...extra,
});
const sse = (chunks) => new Response(new ReadableStream({
  start(controller) {
    for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
    controller.close();
  },
}), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

/** fetch palsu: memutar urutan respons/galat & merekam panggilan. */
function fakeFetch(...outcomes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const next = outcomes[Math.min(calls.length - 1, outcomes.length - 1)];
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(url, init) : next.clone();
  };
  fn.calls = calls;
  return fn;
}

const sleeps = [];
const client = (fetchImpl, opts = {}) => createOpenRouterClient({
  apiKey: KEY, model: 'anthropic/claude-haiku-4.5', timeoutMs: 1000, referer: 'https://susi.example',
  fetchImpl, sleep: async (ms) => { sleeps.push(ms); }, random: () => 0.5, ...opts,
});
const messages = [{ role: 'system', content: 'Aturan' }, { role: 'user', content: 'Halo' }];

describe('Klien OpenRouter (T11)', () => {
  it('mengirim permintaan sesuai dokumentasi: header atribusi, data_collection, tanpa parameter usang', async () => {
    const fetchImpl = fakeFetch(ok());
    const res = await client(fetchImpl).complete({ messages, maxTokens: 350 });
    const [{ url, init, body }] = fetchImpl.calls;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${KEY}`, 'HTTP-Referer': 'https://susi.example', 'X-OpenRouter-Title': 'SUSI Community',
    });
    expect(body).toEqual({
      model: 'anthropic/claude-haiku-4.5', messages, max_tokens: 350, stream: false, provider: { data_collection: 'deny' },
    });
    expect(res).toMatchObject({
      content: 'Halo dari model', model: 'anthropic/claude-haiku-4.5', finishReason: 'stop',
      usage: { tokensIn: 120, tokensOut: 30, costUsd: 0.00027, costEstimated: false },
    });
  });

  it('fallback model: `models` = [utama, ...cadangan]; reasoning diberi ruang token', async () => {
    const fetchImpl = fakeFetch(ok());
    await client(fetchImpl, { fallbackModels: ['openai/gpt-cadangan'], reasoningEffort: 'low' }).complete({ messages, maxTokens: 350 });
    const { body } = fetchImpl.calls[0];
    expect(body.models).toEqual(['anthropic/claude-haiku-4.5', 'openai/gpt-cadangan']);
    expect(body.reasoning).toEqual({ effort: 'low', exclude: true });
    expect(body.max_tokens).toBe(350 + 1024);
  });

  it('biaya diestimasi bila usage.cost tidak ada', async () => {
    const fetchImpl = fakeFetch(json(200, {
      model: 'anthropic/claude-haiku-4.5',
      choices: [{ message: { content: 'x' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    }));
    const res = await client(fetchImpl).complete({ messages, maxTokens: 10 });
    expect(res.usage).toEqual({ tokensIn: 1000, tokensOut: 200, costUsd: (1000 * 1 + 200 * 5) / 1e6, costEstimated: true });
  });

  it('429 → retry sekali dengan jitter lalu berhasil', async () => {
    sleeps.length = 0;
    const fetchImpl = fakeFetch(json(429, { error: { code: 429, message: 'pelan-pelan' } }), ok());
    const res = await client(fetchImpl).complete({ messages, maxTokens: 10 });
    expect(res.content).toBe('Halo dari model');
    expect(fetchImpl.calls).toHaveLength(2);
    expect(sleeps).toEqual([500]);
  });

  it('5xx dua kali → LLMUnavailable setelah tepat satu retry', async () => {
    const fetchImpl = fakeFetch(json(503, {}), json(502, {}));
    await expect(client(fetchImpl).complete({ messages, maxTokens: 10 })).rejects.toBeInstanceOf(LLMUnavailable);
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('429 dua kali → LLMRateLimited', async () => {
    const fetchImpl = fakeFetch(json(429, {}), json(429, {}));
    await expect(client(fetchImpl).complete({ messages, maxTokens: 10 })).rejects.toBeInstanceOf(LLMRateLimited);
  });

  it('400/401/402 tidak di-retry; pesan galat tidak memuat key maupun isi provider', async () => {
    for (const status of [400, 401, 402]) {
      const fetchImpl = fakeFetch(json(status, { error: { code: status, message: `bocor ${KEY} isi prompt` } }));
      const err = await client(fetchImpl).complete({ messages, maxTokens: 10 }).catch((e) => e);
      expect(err).toBeInstanceOf(LLMUnavailable);
      expect(err.status).toBe(status);
      expect(fetchImpl.calls).toHaveLength(1);
      expect(`${err.message} ${err.stack}`).not.toContain(KEY);
      expect(err.message).not.toContain('isi prompt');
    }
  });

  it('timeout → LLMTimeout tanpa retry', async () => {
    const hang = (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('dibatalkan', 'AbortError')));
    });
    const fetchImpl = fakeFetch(hang);
    const err = await client(fetchImpl, { timeoutMs: 30 }).complete({ messages, maxTokens: 10 }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMTimeout);
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('galat jaringan → retry sekali', async () => {
    const fetchImpl = fakeFetch(new TypeError('fetch failed'), ok('pulih'));
    expect((await client(fetchImpl).complete({ messages, maxTokens: 10 })).content).toBe('pulih');
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('konten kosong (mis. habis untuk reasoning) atau penolakan → LLMEmptyResponse', async () => {
    const empty = fakeFetch(json(200, { model: 'm', choices: [{ message: { content: '' }, finish_reason: 'length' }], usage: {} }));
    await expect(client(empty).complete({ messages, maxTokens: 10 })).rejects.toBeInstanceOf(LLMEmptyResponse);
    const refusal = fakeFetch(json(200, { model: 'm', choices: [{ message: { content: 'x', refusal: 'tidak' }, finish_reason: 'stop' }] }));
    await expect(client(refusal).complete({ messages, maxTokens: 10 })).rejects.toBeInstanceOf(LLMEmptyResponse);
  });

  it('tanpa key → LLMNotConfigured tanpa memanggil jaringan', async () => {
    const fetchImpl = fakeFetch(ok());
    const c = client(fetchImpl, { apiKey: null });
    expect(c.isConfigured()).toBe(false);
    await expect(c.complete({ messages, maxTokens: 10 })).rejects.toBeInstanceOf(LLMNotConfigured);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('pembatalan oleh pemanggil diteruskan apa adanya (bukan dianggap timeout)', async () => {
    const hang = (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('dibatalkan', 'AbortError')));
    });
    const caller = new AbortController();
    const pending = client(fakeFetch(hang), { timeoutMs: 5000 }).complete({ messages, maxTokens: 10, signal: caller.signal });
    caller.abort();
    const err = await pending.catch((e) => e);
    expect(err.name).toBe('AbortError');
  });

  it('stream: abaikan komentar keep-alive, gabung chunk terpotong, baca usage sebelum [DONE]', async () => {
    const fetchImpl = fakeFetch(sse([
      ': OPENROUTER PROCESSING\n\n',
      'data: {"model":"anthropic/claude-haiku-4.5","choices":[{"delta":{"role":"assistant","content":"Ha"}}]}\n\ndata: {"choices":[{"de',
      'lta":{"content":"lo!"},"finish_reason":"stop"}]}\n\n',
      'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":40,"completion_tokens":3,"cost":0.000055}}\n\n',
      'data: [DONE]\n\n',
    ]));
    const events = [];
    for await (const ev of client(fetchImpl).stream({ messages, maxTokens: 10 })) events.push(ev);
    expect(fetchImpl.calls[0].body.stream).toBe(true);
    expect(events.filter((e) => e.type === 'delta').map((e) => e.content)).toEqual(['Ha', 'lo!']);
    expect(events.at(-1)).toMatchObject({
      type: 'done', content: 'Halo!', model: 'anthropic/claude-haiku-4.5', finishReason: 'stop',
      usage: { tokensIn: 40, tokensOut: 3, costUsd: 0.000055, costEstimated: false },
    });
  });

  it('stream: galat di tengah stream → LLMUnavailable', async () => {
    const fetchImpl = fakeFetch(sse([
      'data: {"choices":[{"delta":{"content":"Sebagian"}}]}\n\n',
      'data: {"error":{"code":"server_error","message":"x"},"choices":[{"finish_reason":"error"}]}\n\n',
    ]));
    const seen = [];
    const err = await (async () => {
      for await (const ev of client(fetchImpl).stream({ messages, maxTokens: 10 })) seen.push(ev);
    })().catch((e) => e);
    expect(err).toBeInstanceOf(LLMUnavailable);
    expect(seen.map((e) => e.content)).toEqual(['Sebagian']);
  });

  it('stream: berhenti membaca lebih awal membatalkan permintaan (hentikan penagihan)', async () => {
    let fetchSignal;
    const fetchImpl = fakeFetch((url, init) => {
      fetchSignal = init.signal;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Satu "}}]}\n\n'));
          init.signal.addEventListener('abort', () => controller.error(new DOMException('dibatalkan', 'AbortError')));
        },
      }), { status: 200 });
    });
    for await (const ev of client(fetchImpl).stream({ messages, maxTokens: 10 })) {
      expect(ev).toEqual({ type: 'delta', content: 'Satu ' });
      break;
    }
    expect(fetchSignal.aborted).toBe(true);
  });

  it('keyInfo: GET /key, hanya angka kuota (label/key tidak diteruskan)', async () => {
    const fetchImpl = fakeFetch(json(200, {
      data: { label: 'sk-or-v1-RAH...123', limit: 5, limit_remaining: 4.2, usage_daily: 0.01, usage_monthly: 0.8, is_free_tier: false },
    }));
    const info = await client(fetchImpl).keyInfo();
    expect(fetchImpl.calls[0].url).toBe('https://openrouter.ai/api/v1/key');
    expect(fetchImpl.calls[0].init.method).toBe('GET');
    expect(info).toEqual({ limit: 5, limitRemaining: 4.2, usageDaily: 0.01, usageMonthly: 0.8, isFreeTier: false });
  });
});
