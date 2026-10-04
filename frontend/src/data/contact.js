// Satu-satunya sumber data kontak resmi SUSI di frontend.
//
// Nomor WhatsApp, email, dan tautan media sosial diisi lewat frontend/.env.local (lihat
// .env.example) — prasyarat manusia di docs/TASKS.md §1. Nilai yang belum diisi TIDAK
// diganti nomor contoh: tautannya disembunyikan agar pengguna tidak menghubungi nomor palsu.

const env = import.meta.env;
const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** "6281234567890" → "+62 812-3456-7890" */
export function formatWhatsapp(digits) {
  const m = /^62(\d{3})(\d{4})(\d{3,5})$/.exec(digits || '');
  return m ? `+62 ${m[1]}-${m[2]}-${m[3]}` : digits ? `+${digits}` : null;
}

const whatsappNumber = clean(env.VITE_CONTACT_WHATSAPP)?.replace(/\D/g, '').replace(/^0/, '62') || null;
const SOCIALS = [
  { key: 'instagram', label: 'Instagram', href: clean(env.VITE_CONTACT_INSTAGRAM) },
  { key: 'discord', label: 'Discord', href: clean(env.VITE_CONTACT_DISCORD) },
  { key: 'github', label: 'GitHub', href: clean(env.VITE_CONTACT_GITHUB) },
];

export const CONTACT = Object.freeze({
  whatsappNumber,
  whatsappDisplay: formatWhatsapp(whatsappNumber),
  /** Tautan wa.me, atau null bila nomor belum diatur. */
  whatsappUrl: (text) => (whatsappNumber
    ? `https://wa.me/${whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`
    : null),
  email: clean(env.VITE_CONTACT_EMAIL),
  // Alamat & titik kantor dari TentangPage (HQ) dan Footer.
  address: 'Jl. Kliningan No. 4, Kota Bandung, Jawa Barat 40132, Indonesia',
  hq: { lat: -6.9075, lng: 107.619 },
  mapsQuery: 'SMKN 4 Bandung',
  mapsDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=SMKN+4+Bandung',
  socials: SOCIALS.filter((s) => s.href),
});

/** Tautan bantuan terbaik yang tersedia: WhatsApp, lalu email, atau null. */
export function contactHref(text) {
  return CONTACT.whatsappUrl(text) || (CONTACT.email ? `mailto:${CONTACT.email}${text ? `?body=${encodeURIComponent(text)}` : ''}` : null);
}
