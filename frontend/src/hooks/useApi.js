import { useCallback, useEffect, useEffectEvent, useState } from 'react';

/**
 * Memuat data dari API dengan status loading/error dan refetch.
 *
 *   const { data, loading, error, refetch } = useApi((signal) => api.get('/needs/mine', { signal }), [page]);
 *
 * - `deps` menentukan kapan dimuat ulang (harus bisa di-JSON-kan, mis. angka/string/objek filter).
 * - Selama memuat ulang, `data` lama tetap tersedia agar tidak berkedip; pakai `loading` untuk skeleton.
 * - Request sebelumnya dibatalkan (AbortController) saat deps berubah atau komponen unmount.
 * - `setData` untuk pembaruan optimistis setelah aksi (mis. tandai notifikasi dibaca).
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([deps, version]);
  const [result, setResult] = useState({ key: null, data: undefined, error: null });

  const run = useEffectEvent((signal) => fetcher(signal));

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    run(controller.signal).then(
      (data) => setResult({ key, data, error: null }),
      (error) => {
        if (error?.name === 'AbortError') return;
        setResult((prev) => ({ key, data: prev.data, error }));
      },
    );
    return () => controller.abort();
  }, [key, enabled]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((updater) => {
    setResult((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);

  const settled = result.key === key;
  return {
    data: result.data,
    error: settled ? result.error : null,
    loading: enabled && !settled,
    refetch,
    setData,
  };
}

export default useApi;
