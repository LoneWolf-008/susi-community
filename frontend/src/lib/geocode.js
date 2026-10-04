// Geocoding alamat lewat Nominatim (OpenStreetMap) dengan sopan:
// - cache hasil per alamat (memori),
// - antrean global maksimal 1 request/detik (kebijakan pemakaian Nominatim),
// - debounce 600 ms untuk pencarian sambil mengetik (useDebouncedGeocode).
import { useEffect, useState } from 'react';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1000;
export const GEOCODE_DEBOUNCE_MS = 600;
export const BANDUNG_CENTER = { lat: -6.9175, lng: 107.6191 };

const cache = new Map();
let lastRequestAt = 0;
let queue = Promise.resolve();

const normalize = (query) => query.trim().replace(/\s+/g, ' ').toLowerCase();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sektor kota seperti kolom generated `sector` di backend. */
export function sectorOf({ lat, lng }) {
  return `${lng < BANDUNG_CENTER.lng ? 'BARAT' : 'TIMUR'}–${lat > BANDUNG_CENTER.lat ? 'UTARA' : 'SELATAN'}`;
}

/**
 * @param {string} query alamat bebas; "Kota Bandung" ditambahkan bila belum ada
 * @returns {Promise<{ lat: number, lng: number, displayName: string } | null>} null bila tidak ditemukan
 */
export function geocode(query, { city = 'Kota Bandung' } = {}) {
  const text = (query || '').trim();
  if (!text) return Promise.resolve(null);
  const full = city && !normalize(text).includes('bandung') ? `${text}, ${city}` : text;
  const key = normalize(full);
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  // Antrean berurutan: setiap request menunggu jeda minimal sejak request sebelumnya.
  const job = queue.then(async () => {
    if (cache.has(key)) return cache.get(key);
    const delay = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (delay > 0) await wait(delay);
    lastRequestAt = Date.now();

    const params = new URLSearchParams({
      format: 'json', limit: '1', countrycodes: 'id', 'accept-language': 'id', q: full,
    });
    const res = await fetch(`${ENDPOINT}?${params}`);
    if (!res.ok) throw new Error('Layanan pencarian alamat sedang tidak tersedia.');
    const data = await res.json();
    const result = data?.[0]
      ? { lat: Number.parseFloat(data[0].lat), lng: Number.parseFloat(data[0].lon), displayName: data[0].display_name }
      : null;
    cache.set(key, result);
    return result;
  });
  queue = job.catch(() => {}); // kegagalan satu request tidak memblokir antrean
  return job;
}

/**
 * Hook pencarian sambil mengetik: menunggu 600 ms setelah ketikan terakhir.
 * @returns {{ result: object|null, searching: boolean, error: string }}
 */
export function useDebouncedGeocode(query, { enabled = true, minLength = 6 } = {}) {
  const [state, setState] = useState({ query: '', result: null, error: '' });
  const text = (query || '').trim();
  const active = enabled && text.length >= minLength;

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      geocode(text).then(
        (result) => { if (!cancelled) setState({ query: text, result, error: result ? '' : 'Alamat tidak ditemukan.' }); },
        (err) => { if (!cancelled) setState({ query: text, result: null, error: err.message }); },
      );
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, active]);

  const fresh = active && state.query === text;
  return { result: fresh ? state.result : null, error: fresh ? state.error : '', searching: active && !fresh };
}
