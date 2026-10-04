import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useApi } from './useApi';

// Warna & label per tipe notifikasi backend (enum notifications.type).
export const NOTIF_META = {
  talenta: { color: '#e62b2b', label: 'TALENTA' },
  verifikasi: { color: '#15803d', label: 'VERIFIKASI' },
  diskusi: { color: '#12283c', label: 'DISKUSI' },
  sistem: { color: '#9CA3AF', label: 'SISTEM' },
  moderasi: { color: '#b45309', label: 'MODERASI' },
  sengketa: { color: '#7a1a1f', label: 'SENGKETA' },
  kunjungan: { color: '#0e7490', label: 'KUNJUNGAN' },
  intake: { color: '#0e7490', label: 'INTAKE' },
  eskalasi: { color: '#e62b2b', label: 'ESKALASI' },
};

/** Bentuk item untuk DashShell: { id, title, sub, read, color, label, raw }. */
export const toShellNotif = (n) => ({
  id: n.id,
  title: n.title,
  sub: [n.body, timeAgo(n.created_at)].filter(Boolean).join(' · '),
  read: Boolean(n.is_read),
  color: NOTIF_META[n.type]?.color,
  label: NOTIF_META[n.type]?.label || 'INFO',
  raw: n,
});

const POLL_MS = 30_000;

/**
 * Notifikasi pengguna: 20 terbaru + jumlah belum dibaca. Jumlah di-polling tiap 30 detik dan
 * berhenti saat tab peramban tidak aktif. Saat jumlah naik, daftar dimuat ulang dan `onNew`
 * dipanggil (mis. agar dasbor memuat ulang papan yang berubah karena aksi pihak lain).
 */
export function useNotifications({ onNew } = {}) {
  const list = useApi((signal) => api.get('/notifications', { signal, query: { limit: 20 } }), []);
  const [unread, setUnread] = useState(null);
  const [syncKey, setSyncKey] = useState(0);
  const lastCount = useRef(null);

  const handleCount = useEffectEvent((count) => {
    if (lastCount.current !== null && count > lastCount.current) {
      list.refetch();
      onNew?.();
    }
    lastCount.current = count;
    setUnread(count);
  });

  useEffect(() => {
    let timer = null;
    let controller = null;
    const poll = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await api.get('/notifications/unread-count', { signal: controller.signal });
        handleCount(Number(data?.count) || 0);
      } catch {
        // Gagal sesaat (jaringan, server): diam, dicoba lagi pada putaran berikutnya.
      }
    };
    const start = () => {
      if (timer) return;
      poll();
      timer = setInterval(poll, POLL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
      controller?.abort();
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncKey]);

  const raw = list.data?.items || [];
  const items = raw.map(toShellNotif);
  const unreadCount = unread ?? raw.filter((n) => !n.is_read).length;

  const adjustCount = (delta) => {
    setUnread((c) => Math.max(0, (c ?? unreadCount) + delta));
    if (lastCount.current !== null) lastCount.current = Math.max(0, lastCount.current + delta);
  };
  /** Muat ulang daftar & jumlah (juga dipakai bila aksi gagal, untuk kembali ke data server). */
  const refetch = () => { list.refetch(); setSyncKey((k) => k + 1); };
  const run = async (request) => {
    try {
      await request();
    } catch {
      refetch();
    }
  };

  return {
    items,
    unread: unreadCount,
    loading: list.loading && !list.data,
    error: list.error,
    refetch,
    markRead: (id) => {
      const target = raw.find((n) => n.id === id);
      if (!target || target.is_read) return;
      list.setData((d) => d && { ...d, items: d.items.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)) });
      adjustCount(-1);
      run(() => api.patch(`/notifications/${id}/read`));
    },
    markAllRead: () => {
      list.setData((d) => d && { ...d, items: d.items.map((n) => ({ ...n, is_read: 1 })) });
      setUnread(0);
      lastCount.current = 0;
      run(() => api.patch('/notifications/read-all'));
    },
    remove: (id) => {
      const target = raw.find((n) => n.id === id);
      list.setData((d) => d && { ...d, items: d.items.filter((n) => n.id !== id), total: Math.max(0, d.total - 1) });
      if (target && !target.is_read) adjustCount(-1);
      run(() => api.delete(`/notifications/${id}`));
    },
  };
}
