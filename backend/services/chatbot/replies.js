// Jawaban tetap Tanya SUSI untuk jalur tanpa LLM (basa-basi, penolakan, di luar topik, dll.).
// Bukan klaim fakta tentang SUSI: fakta hanya berasal dari KB.

export const FALLBACK_REPLY = 'Maaf, saya belum menemukan jawabannya di panduan SUSI. Coba tanyakan dengan kata lain, atau minta bantuan AgenSUSI agar dibantu langsung.';

export const SMALLTALK_REPLIES = {
  greeting: 'Halo! Saya Tanya SUSI, asisten AI SUSI Community. Saya bisa menjelaskan cara kerja SUSI, cara mengajukan kebutuhan, melamar proyek, verifikasi, dan reputasi. Mau tanya apa?',
  thanks: 'Sama-sama! Kalau ada yang ingin ditanyakan lagi seputar SUSI, tulis saja di sini.',
  bye: 'Sampai jumpa! Semoga urusan komunitas dan proyek Anda lancar.',
  howareyou: 'Kabar baik, terima kasih! Ada yang bisa saya bantu seputar SUSI?',
  ack: 'Siap! Ada lagi yang ingin ditanyakan seputar SUSI?',
};

export const REPLIES = {
  injection: 'Maaf, saya tidak bisa mengubah aturan saya atau membagikan instruksi internal. Saya siap membantu pertanyaan seputar SUSI Community, misalnya cara mengajukan kebutuhan atau melamar proyek.',
  abusive: 'Saya mengerti mungkin Anda sedang kesal. Boleh ceritakan kendalanya dengan bahasa yang sopan supaya saya bisa membantu? Bila perlu, saya bisa menghubungkan Anda dengan AgenSUSI.',
  outOfScope: 'Maaf, saya hanya bisa membantu pertanyaan seputar SUSI Community, misalnya cara kerja SUSI, mengajukan kebutuhan, melamar proyek, verifikasi, dan reputasi.',
  loginRequired: 'Untuk melihat data pribadi seperti status proyek, lamaran, atau notifikasi, silakan masuk ke akun Anda dulu lewat halaman Masuk. Setelah masuk, tanyakan lagi di sini.',
  escalation: 'Baik, saya bisa meneruskan percakapan ini ke AgenSUSI, tim pendamping SUSI. Tekan tombol "Hubungi AgenSUSI" agar mereka bisa membantu Anda langsung.',
  cancelled: '(Jawaban dihentikan.)',
};

// Ditambahkan ke jawaban KB saat anggaran LLM harian habis (mode hemat), bukan pesan galat.
export const BUDGET_NOTE = 'Catatan: Tanya SUSI sedang dalam mode hemat, jadi jawaban ini diambil langsung dari panduan SUSI.';

/** Pesan di sesi setelah tiket eskalasi dibuat (T13). */
export function escalationCreatedReply({ id, available, anonymous }) {
  const where = anonymous ? 'di percakapan ini atau lewat kontak yang Anda berikan' : 'di percakapan ini';
  if (available) return `Permintaan Anda sudah diteruskan ke AgenSUSI (tiket #${id}). Balasan mereka akan muncul ${where}.`;
  return `Permintaan Anda sudah tercatat (tiket #${id}), tetapi saat ini belum ada AgenSUSI yang bertugas. Mereka akan membalas ${where} secepatnya. Untuk bantuan cepat, hubungi WhatsApp resmi SUSI di halaman Tentang Kami.`;
}
