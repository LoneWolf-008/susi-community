// Transport LLM_TRANSPORT=https: pengganti fetch berbasis node:https untuk klien OpenRouter.
// fetch bawaan Node memakai undici yang mengompilasi parser HTTP WebAssembly; di hosting bersama dengan
// batas memori ketat (CloudLinux LVE) hal itu bisa gagal dengan "WebAssembly ... Out of memory".
// Hanya bagian Response yang dipakai openrouter.js yang ditiru: ok, status, headers.get, json(), text(),
// dan body.getReader() (read/cancel/releaseLock). Pembatalan lewat AbortSignal menghentikan permintaan.
import https from 'node:https';

function toResponse(res, req) {
  const iterator = res[Symbol.asyncIterator]();
  const readAll = async () => {
    const parts = [];
    for await (const chunk of res) parts.push(chunk);
    return Buffer.concat(parts).toString('utf8');
  };
  return {
    ok: res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    headers: { get: (name) => res.headers[String(name).toLowerCase()] ?? null },
    text: readAll,
    json: async () => JSON.parse(await readAll()),
    body: {
      getReader: () => ({
        read: async () => {
          const { done, value } = await iterator.next();
          return done ? { done: true, value: undefined } : { done: false, value: new Uint8Array(value) };
        },
        cancel: async () => { req.destroy(); },
        // Sisa respons yang tidak dibaca dikuras agar soket bisa dipakai ulang.
        releaseLock: () => { res.resume(); },
      }),
    },
  };
}

/**
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string, signal?: AbortSignal }} [init]
 */
export function httpsFetch(url, { method = 'GET', headers = {}, body, signal } = {}) {
  return new Promise((resolve, reject) => {
    const abortError = () => Object.assign(new Error('Permintaan dibatalkan'), { name: 'AbortError' });
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const req = https.request(url, {
      method,
      headers: { ...headers, ...(body !== undefined ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
    }, (res) => resolve(toResponse(res, req)));
    const onAbort = () => req.destroy(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    req.on('error', reject);
    req.on('close', () => signal?.removeEventListener('abort', onAbort));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
