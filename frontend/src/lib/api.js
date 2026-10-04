// Klien API tunggal untuk seluruh frontend.
//
// - Basis `/api`: saat dev Vite mem-proxy ke backend (vite.config.js); di produksi lintas
//   domain isi VITE_API_URL (mis. https://susi-api.up.railway.app/api).
// - Access token HANYA di memori (bukan localStorage) agar tidak bisa dibaca skrip lain;
//   sesi dipulihkan dari cookie refresh httpOnly lewat POST /auth/refresh.
// - 401 → refresh sekali (single-flight: request serentak berbagi satu refresh) lalu ulangi
//   request satu kali. Bila refresh gagal, handler sesi-habis dipanggil (AuthContext logout).
// - Semua kegagalan dilempar sebagai ApiError { status, message, details }.

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let accessToken = null;
let refreshPromise = null;
let sessionExpiredHandler = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};
export const getAccessToken = () => accessToken;
/** Dipanggil saat refresh gagal (cookie habis/dicabut) agar UI keluar dari sesi. */
export const onSessionExpired = (handler) => {
  sessionExpiredHandler = handler;
};

// Endpoint auth tidak memicu refresh otomatis (menghindari loop).
const NO_AUTO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

const buildUrl = (path, query) => {
  let url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`;
  }
  return url;
};

async function readBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(status, body) {
  let message = body?.error?.message;
  if (!message) {
    if (status === 0) message = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    else if (status === 429) message = 'Terlalu banyak permintaan. Coba lagi sebentar lagi.';
    else if (status >= 500) message = 'Server sedang bermasalah. Coba lagi sebentar lagi.';
    else message = 'Permintaan gagal diproses.';
  }
  return new ApiError(status, message, body?.error?.details || null);
}

/** Memperbarui access token dari cookie refresh. Request serentak berbagi satu panggilan. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let res;
      try {
        res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include' });
      } catch {
        throw toApiError(0, null);
      }
      const body = await readBody(res);
      if (!res.ok) {
        setAccessToken(null);
        throw toApiError(res.status, body);
      }
      setAccessToken(body.data.accessToken);
      return body.data; // { user, accessToken }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request(method, path, { body, query, signal, retry = true } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      signal,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw toApiError(0, null);
  }

  if (res.status === 401 && retry && !NO_AUTO_REFRESH.some((p) => path.startsWith(p))) {
    try {
      await refreshSession();
    } catch {
      sessionExpiredHandler?.();
      throw toApiError(401, await readBody(res));
    }
    return request(method, path, { body, query, signal, retry: false });
  }

  const data = await readBody(res);
  if (!res.ok) throw toApiError(res.status, data);
  return data; // { success, message, data }
}

/**
 * Unggah berkas dengan progres (XMLHttpRequest, karena fetch belum punya progres unggah).
 * @param {string} path
 * @param {FormData} formData
 * @param {{ onProgress?: (percent: number) => void, signal?: AbortSignal }} [options]
 */
export function upload(path, formData, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const send = (isRetry) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUrl(path));
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = async () => {
        let body;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = null;
        }
        if (xhr.status === 401 && !isRetry) {
          try {
            await refreshSession();
            send(true);
          } catch {
            sessionExpiredHandler?.();
            reject(toApiError(401, body));
          }
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body?.data);
        else reject(toApiError(xhr.status, body));
      };
      xhr.onerror = () => reject(new ApiError(0, 'Unggahan gagal. Periksa koneksi internet Anda.'));
      xhr.onabort = () => reject(new DOMException('Unggahan dibatalkan', 'AbortError'));
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(formData);
    };
    send(false);
  });
}

/** Mengunduh berkas yang butuh login (header Authorization) lalu memicu dialog simpan. */
export async function download(path, filename) {
  const doFetch = () => fetch(buildUrl(path), {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  let res = await doFetch();
  if (res.status === 401) {
    await refreshSession();
    res = await doFetch();
  }
  if (!res.ok) throw toApiError(res.status, await readBody(res));

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'berkas';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Bentuk singkat: hasilnya `data` dari amplop { success, message, data }.
// Pakai api.send() bila butuh `message` dari backend (mis. untuk toast).
export const api = {
  get: (path, options) => request('GET', path, options).then((r) => r?.data),
  post: (path, body, options) => request('POST', path, { ...options, body }).then((r) => r?.data),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }).then((r) => r?.data),
  delete: (path, options) => request('DELETE', path, options).then((r) => r?.data),
  send: (method, path, options) => request(method, path, options),
  upload,
  download,
};

export default api;
