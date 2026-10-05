// LLM tiruan (LLM_PROVIDER=mock) untuk dev & test tanpa key: deterministik, tanpa jaringan.
// Jawaban merangkum entri <kb> pertama di prompt sistem, sehingga test bisa membuktikan konteks
// KB benar-benar dikirim. Penanda di pesan pengguna memicu galat untuk menguji jalur fallback:
//   [mock:timeout] · [mock:ratelimit] · [mock:unavailable] · [mock:empty]
import { LLMTimeout, LLMRateLimited, LLMUnavailable, LLMEmptyResponse } from './errors.js';
import { estimateCostUsd } from './pricing.js';

const TRIGGERS = {
  '[mock:timeout]': () => new LLMTimeout('Mock: batas waktu'),
  '[mock:ratelimit]': () => new LLMRateLimited('Mock: 429', { status: 429 }),
  '[mock:unavailable]': () => new LLMUnavailable('Mock: 503', { status: 503 }),
  '[mock:empty]': () => new LLMEmptyResponse('Mock: jawaban kosong'),
};

function answerFor(messages) {
  const system = messages.find((m) => m.role === 'system')?.content || '';
  // Ringkasan eskalasi (T13): ulangi baris pertama percakapan agar test bisa memeriksa isinya.
  const conversation = /<percakapan>\n([\s\S]*?)\n<\/percakapan>/.exec(messages.at(-1)?.content || '')?.[1];
  if (conversation) return `[mock] Ringkasan: ${conversation.split('\n')[0].slice(0, 200)}`;
  // Pertanyaan data pribadi: ulangi baris pertama <user_data> agar test bisa memeriksa isinya.
  const userData = /<user_data>\n([\s\S]*?)\n<\/user_data>/.exec(system)?.[1];
  if (userData && userData !== '(tidak ada)') return `[mock] Data Anda: ${userData.split('\n').slice(0, 3).join(' | ')}`;
  // R3: penjelasan rekomendasi / narasi karier → ulangi rekomendasi pertama & keahlian dari profil.
  const recommendations = /<recommendations>\n([\s\S]*?)\n<\/recommendations>/.exec(system)?.[1];
  const profile = /<user_profile>\n([\s\S]*?)\n<\/user_profile>/.exec(system)?.[1];
  if (recommendations || profile) {
    const lines = (profile || '').split('\n');
    const skills = lines.find((l) => l.startsWith('Keahlian:')) || '';
    const demand = lines.find((l) => l.startsWith('Keahlian yang paling banyak diminta')) || '';
    return `[mock] Rekomendasi: ${(recommendations || '(tidak ada)').split('\n')[0]} | ${skills} | ${demand}`.slice(0, 400);
  }
  const entry = /<entry[^>]*title="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/entry>/.exec(system);
  if (!entry) return '[mock] Maaf, saya belum menemukan informasinya. Anda bisa minta bantuan AgenSUSI.';
  const firstSentence = entry[2].split(/(?<=[.!?])\s/)[0].slice(0, 200);
  return `[mock] ${entry[1] ? `${entry[1]}: ` : ''}${firstSentence}`;
}

const approxTokens = (text) => Math.ceil(String(text).length / 4);

export function createMockClient({ model = 'mock' } = {}) {
  const run = (messages) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const trigger = Object.keys(TRIGGERS).find((t) => lastUser.includes(t));
    if (trigger) throw TRIGGERS[trigger]();
    const content = answerFor(messages);
    const tokensIn = approxTokens(messages.map((m) => m.content).join('\n'));
    const tokensOut = approxTokens(content);
    return {
      content,
      model,
      finishReason: 'stop',
      usage: { tokensIn, tokensOut, costUsd: estimateCostUsd('mock', tokensIn, tokensOut), costEstimated: true },
      latencyMs: 1,
    };
  };

  return {
    name: 'mock',
    model,
    fallbackModels: [],
    isConfigured: () => true,
    async complete({ messages }) {
      return run(messages);
    },
    async* stream({ messages }) {
      const result = run(messages);
      for (const word of result.content.split(/(?<= )/)) yield { type: 'delta', content: word };
      yield { type: 'done', ...result };
    },
    async keyInfo() {
      return { limit: null, limitRemaining: null, usageDaily: 0, usageMonthly: 0, isFreeTier: null };
    },
  };
}
