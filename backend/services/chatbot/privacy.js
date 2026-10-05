// Kontrol privasi Tanya SUSI (T15): pilihan pengguna di user_settings dan penghapusan riwayat.
//  - allows_ai_chat = 0: pesan tidak pernah dikirim ke penyedia LLM (jawaban dari KB/aturan saja).
//  - allows_chat_history_storage = 0: isi pesan disimpan sebagai NOT_STORED dan pertanyaan di ask_logs
//    dikosongkan; metadata (intent, biaya, latensi) tetap tercatat untuk anggaran & evaluasi.
// Pengunjung anonim memakai bawaan: sesinya hanya bisa dibuka pemegang id dan bisa dihapus kapan saja.

export const NOT_STORED = '[tidak disimpan]';
// personalize (R3): boleh membaca profil/keahlian/rekomendasi pengguna untuk jawaban pribadi.
export const DEFAULT_PRIVACY = Object.freeze({ aiAllowed: true, storeHistory: true, personalize: true });

/** Pilihan privasi chat `user` (anonim/tanpa baris pengaturan → bawaan). */
export async function chatPrivacy(db, user) {
  if (!user) return DEFAULT_PRIVACY;
  const [rows] = await db.query(
    `SELECT allows_ai_chat, allows_chat_history_storage, allows_ai_personalization FROM user_settings WHERE user_id = ?`,
    [user.id],
  );
  if (!rows[0]) return DEFAULT_PRIVACY;
  return {
    aiAllowed: Number(rows[0].allows_ai_chat) === 1,
    storeHistory: Number(rows[0].allows_chat_history_storage) === 1,
    personalize: Number(rows[0].allows_ai_personalization) === 1,
  };
}

/**
 * Hapus sesi chat beserta pesannya (CASCADE) dan tiket eskalasinya, termasuk tiket yang masih
 * terbuka (permintaan bantuan ikut dibatalkan). Sebelum itu, notifikasi eskalasi (berisi ringkasan
 * percakapan) dihapus dan baris ask_logs dianonimkan: pertanyaan dikosongkan, user_id dilepas, sementara
 * metrik biaya & kualitas tetap ada.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<number>} jumlah sesi yang terhapus
 */
export async function deleteSessions(pool, sessionIds) {
  const ids = [...new Set(sessionIds)];
  if (ids.length === 0) return 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `DELETE n FROM notifications n
       JOIN escalations e ON n.ref_type = 'escalation' AND n.ref_id = e.id
       WHERE e.session_id IN (?)`,
      [ids],
    );
    await conn.query(`UPDATE ask_logs SET question = '', user_id = NULL WHERE session_id IN (?)`, [ids]);
    const [result] = await conn.query(`DELETE FROM chat_sessions WHERE id IN (?)`, [ids]);
    await conn.commit();
    return result.affectedRows;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
