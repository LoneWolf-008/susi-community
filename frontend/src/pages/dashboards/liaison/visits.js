// Bantuan kunjungan liaison (dipakai beranda, daftar kunjungan, dan form intake).
import { toDateInput } from '../../../lib/format';

/** "Hari ini" menurut zona waktu peramban, format YYYY-MM-DD untuk ?date= dan <input type="date">. */
export const todayInput = () => toDateInput(new Date());

/** "09.00" dari kolom TIME "09:00:00". */
export const timeLabel = (time) => (time ? String(time).slice(0, 5).replace(':', '.') : '—');

export const visitPoint = (v) => (v?.lat != null && v?.lng != null ? { lat: Number(v.lat), lng: Number(v.lng) } : null);

/** Tautan rute Google Maps: koordinat bila ada, bila tidak memakai alamat. */
export function routeUrl(v) {
  const point = visitPoint(v);
  if (point) return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
  if (v?.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.address}, Bandung`)}`;
  return null;
}

export const visitName = (v) => v.community_real_name || v.community_name;
