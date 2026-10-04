// Satu-satunya sumber data kontak resmi SUSI di frontend.
// Nilai bertanda PLACEHOLDER belum asli — prasyarat manusia di docs/TASKS.md §1.

// TODO(isi nomor asli): nomor WhatsApp tim SUSI dalam format internasional tanpa "+".
const WHATSAPP_NUMBER = '6281234567890'; // PLACEHOLDER
// TODO(isi nomor asli): tampilan nomor untuk dibaca manusia.
const WHATSAPP_DISPLAY = '+62 812-3456-7890'; // PLACEHOLDER

export const CONTACT = Object.freeze({
  whatsappNumber: WHATSAPP_NUMBER,
  whatsappDisplay: WHATSAPP_DISPLAY,
  whatsappUrl: (text) => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`,
  // TODO(isi email asli): Tentang memakai timsusi@smkn4bdg.sch.id, Footer memakai
  // halosusi@gmail.com. Pilih satu yang aktif sebelum demo.
  email: 'timsusi@smkn4bdg.sch.id', // PLACEHOLDER
  // Alamat & titik dari TentangPage (HQ) dan Footer.
  address: 'Jl. Kliningan No. 4, Kota Bandung, Jawa Barat 40132, Indonesia',
  hq: { lat: -6.9075, lng: 107.619 },
  mapsQuery: 'SMKN 4 Bandung',
  mapsDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=SMKN+4+Bandung',
  socials: [
    // TODO(isi tautan asli): akun media sosial resmi.
    { key: 'instagram', label: 'Instagram', href: 'https://instagram.com' }, // PLACEHOLDER
    { key: 'discord', label: 'Discord', href: 'https://discord.com' }, // PLACEHOLDER
    { key: 'github', label: 'GitHub', href: 'https://github.com' }, // PLACEHOLDER
  ],
});

/** True bila masih memakai nilai contoh (dipakai untuk peringatan di mode dev). */
export const CONTACT_IS_PLACEHOLDER = true;
