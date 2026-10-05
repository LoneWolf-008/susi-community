// Saran pertanyaan cepat per peran untuk widget Tanya SUSI (T14). Setiap saran harus terjawab KB
// untuk audiens perannya, atau berupa pertanyaan data pribadi / intent personal (R3) untuk pengguna
// yang masuk — diuji di tests/unit/suggestions.test.js agar tombol saran tidak berujung "belum tahu".
// Saran `public` juga dipakai landing & navigasi frontend (frontend/src/data/askSuggestions.js).
export const SUGGESTIONS = Object.freeze({
  public: [
    'Apa itu SUSI Community?',
    'Bagaimana cara kerja SUSI?',
    'Apakah SUSI berbayar?',
    'Komunitas saya belum terbiasa pakai website, bisa dibantu?',
  ],
  requester: [
    'Talenta mana yang cocok untuk kebutuhan saya?',
    'Bagaimana cara mengajukan kebutuhan?',
    'Status kebutuhan saya?',
    'Apa itu verifikasi dua arah?',
  ],
  talent: [
    'Proyek apa yang cocok untuk saya?',
    'Skill apa yang perlu saya pelajari?',
    'Bagaimana cara melamar proyek?',
    'Status lamaran saya?',
  ],
  liaison: [
    'Talenta mana yang cocok untuk kebutuhan saya?',
    'Bagaimana mencatat kebutuhan atas nama komunitas?',
    'Bagaimana mencatat kunjungan lapangan?',
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
