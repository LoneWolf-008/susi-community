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

/** Bentuk item untuk DashShell: { id, title, sub, read, color, label }. */
export const toShellNotif = (n) => ({
  id: n.id,
  title: n.title,
  sub: [n.body, timeAgo(n.created_at)].filter(Boolean).join(' · '),
  read: Boolean(n.is_read),
  color: NOTIF_META[n.type]?.color,
  label: NOTIF_META[n.type]?.label || 'INFO',
  raw: n,
});

/** Daftar notifikasi terbaru milik pengguna (polling & aksi baca/hapus menyusul di T10). */
export function useNotifications() {
  const { data, refetch } = useApi((signal) => api.get('/notifications', { signal, query: { limit: 20 } }), []);
  return { items: (data?.items || []).map(toShellNotif), refetch };
}
