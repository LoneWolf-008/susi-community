// Cache jawaban LLM (T12.2.3): LRU di memori proses, kunci = pertanyaan dalam bentuk baku + audiens,
// kedaluwarsa setelah TTL. Hanya untuk pertanyaan yang berdiri sendiri (bukan lanjutan percakapan,
// bukan data pribadi), sehingga jawaban yang sama aman diberikan ke penanya lain dengan audiens sama.
import { env } from '../../config/env.js';
import { canonicalText } from './text.js';

export function createAnswerCache({ max = 500, ttlMs = 6 * 60 * 60 * 1000, now = Date.now } = {}) {
  const store = new Map();
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      store.delete(key);
      if (hit.expires <= now()) return null;
      store.set(key, hit); // jadikan paling baru dipakai
      return hit.value;
    },
    set(key, value) {
      if (!(ttlMs > 0) || !(max > 0)) return; // TTL 0 = cache dimatikan
      store.delete(key);
      store.set(key, { value, expires: now() + ttlMs });
      while (store.size > max) store.delete(store.keys().next().value);
    },
    /** Kosongkan, mis. setelah isi KB diubah admin (T14). */
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}

export const answerCacheKey = (message, audiences) => `${[...audiences].sort().join(',')}|${canonicalText(message)}`;

export const answerCache = createAnswerCache({ max: env.chatbot.cacheMax, ttlMs: env.chatbot.cacheTtlMs });
