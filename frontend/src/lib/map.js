// Peta (U2): MapLibre + tile OpenFreeMap (gratis, tanpa API key; atribusi otomatis dari style).
// Konstanta di sini ringan (tanpa maplibre-gl) agar bisa dipakai di luar chunk peta.

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// Warna marker. Selaras dengan teks bantuan Tanya SUSI (entri KB "peta-dan-lokasi").
export const MARKER_VARIANTS = {
  community: { label: 'Komunitas lain', color: '#e62b2b' },
  own: { label: 'Komunitas Anda', color: '#c9ecd9' },
  need: { label: 'Kebutuhan terbuka', color: '#f2a900' },
  hq: { label: 'Kantor SUSI', color: '#12283c' },
};

/** Tautan luar "Rute di Google Maps" (tanpa embed). */
export const directionsUrl = ({ lat, lng }) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Koordinat dari API (string DECIMAL / null) → { lat, lng } atau null. */
export function toPoint(row) {
  const lat = row?.lat == null ? NaN : Number(row.lat);
  const lng = row?.lng == null ? NaN : Number(row.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Bulatkan seperti kolom DECIMAL(9,6) agar nilai yang dikirim sama dengan yang tersimpan. */
export const roundPoint = ({ lat, lng }) => ({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 });

/** Id marker komunitas di CommunityMap (dipakai daftar untuk membuka popup). */
export const communityMarkerId = (id) => `c-${id}`;
