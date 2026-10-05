// Format tampilan bersama (tanggal, waktu relatif, inisial) dalam Bahasa Indonesia.

const toDate = (value) => (value instanceof Date ? value : value ? new Date(value) : null);

/** "04 OKT 2026" — gaya label mono di dasbor. */
export function formatDate(value) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

/** "04 Okt 2026, 14.30" */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "baru saja", "5 menit lalu", "2 jam lalu", "3 hari lalu", lalu tanggal. */
export function timeAgo(value, now = Date.now()) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  const seconds = Math.round((now - d.getTime()) / 1000);
  if (seconds < 60) return 'baru saja';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDate(d);
}

/** Sisa waktu sampai `value`: "berakhir 2 hari lagi", "berakhir 5 jam lagi"; null bila tanpa batas. */
export function timeLeft(value, now = Date.now()) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const hours = (d.getTime() - now) / 3_600_000;
  if (hours <= 0) return 'sudah berakhir';
  if (hours < 1) return 'berakhir < 1 jam lagi';
  if (hours < 24) return `berakhir ${Math.ceil(hours)} jam lagi`;
  return `berakhir ${Math.ceil(hours / 24)} hari lagi`;
}

/** Nilai untuk <input type="date">: "YYYY-MM-DD" (zona waktu lokal). */
export function toDateInput(value) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Tautan wa.me dari nomor lokal ("0812-..." → "62812..."); null bila nomor kosong. */
export const whatsappLink = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '62');
  return digits ? `https://wa.me/${digits}` : null;
};

export const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';
export const firstName = (name, fallback = '') => (name || fallback).trim().split(/\s+/)[0] || fallback;

/** Ukuran berkas ramah baca: 1,2 MB */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${units[i]}`;
}
