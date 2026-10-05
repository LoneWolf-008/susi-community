// Saran pertanyaan cepat per peran untuk widget Tanya SUSI (T14). Setiap saran harus terjawab KB
// untuk audiens perannya, atau berupa pertanyaan data pribadi untuk pengguna yang masuk — diuji di
// tests/unit/suggestions.test.js agar tombol saran tidak pernah berujung "belum tahu".
// Saran `public` juga dipakai landing & navigasi frontend (frontend/src/data/askSuggestions.js).
export const SUGGESTIONS = Object.freeze({
  public: [
    'Apa itu SUSI Community?',
    'Bagaimana cara kerja SUSI?',
    'Apakah SUSI berbayar?',
    'Komunitas saya belum terbiasa pakai website, bisa dibantu?',
  ],
  requester: [
    'Bagaimana cara mengajukan kebutuhan?',
    'Status kebutuhan saya?',
    'Bagaimana cara memilih talenta?',
    'Apa itu verifikasi dua arah?',
  ],
  talent: [
    'Bagaimana cara melamar proyek?',
    'Status lamaran saya?',
    'Berapa poin reputasi saya?',
    'Bagaimana cara mengirim hasil pekerjaan?',
  ],
  liaison: [
    'Bagaimana mencatat kebutuhan atas nama komunitas?',
    'Bagaimana mencatat kunjungan lapangan?',
    'Apa itu pemilik proksi?',
    'Status kebutuhan saya?',
  ],
  admin: [
    'Bagaimana sengketa ditangani?',
    'Apa itu verifikasi dua arah?',
    'Bagaimana level reputasi talenta dihitung?',
    'Apakah data pengguna aman?',
  ],
});

export const suggestionsFor = (user) => SUGGESTIONS[user?.role] ?? SUGGESTIONS.public;
