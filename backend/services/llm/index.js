// Pemilih provider LLM (LLM_PROVIDER). Klien dibuat saat pertama dipakai, jadi server tetap
// berjalan tanpa key: OpenRouter tanpa key melapor isConfigured() = false dan chatbot menjawab dari KB.
import { env } from '../../config/env.js';
import { createOpenRouterClient } from './openrouter.js';
import { createMockClient } from './mock.js';
import { httpsFetch } from './httpsTransport.js';

let instance = null;

export function getLLM() {
  if (!instance) {
    instance = env.llm.provider === 'mock'
      ? createMockClient()
      : createOpenRouterClient({
        ...env.llm.openrouter,
        // LLM_TRANSPORT=https: node:https tanpa undici/WebAssembly (lihat httpsTransport.js).
        ...(env.llm.transport === 'https' ? { fetchImpl: httpsFetch } : {}),
      });
  }
  return instance;
}

/** Hanya untuk test: ganti klien (null = kembali ke klien dari env). */
export function setLLMForTests(client) {
  instance = client;
}

export * from './errors.js';
