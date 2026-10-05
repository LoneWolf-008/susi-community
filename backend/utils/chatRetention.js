// Retensi riwayat Tanya SUSI sekali jalan (server juga menjalankannya harian):
//
//   npm run chat:retention   hapus isi chat lebih tua dari CHATBOT_RETENTION_DAYS (0 = dimatikan)
//
// Hanya jumlah baris yang dicetak, tidak pernah isi chat.
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { purgeExpiredChats } from '../services/chatbot/retention.js';

try {
  if (!env.chatbot.retentionDays) {
    console.log('Retensi chat dimatikan (CHATBOT_RETENTION_DAYS=0).');
  } else {
    const r = await purgeExpiredChats(pool);
    console.log(
      `Retensi chat (${r.days} hari): ${r.messages} pesan & ${r.sessions} sesi dihapus, ${r.questions} pertanyaan dianonimkan.`,
    );
  }
} catch (err) {
  console.error(`Retensi chat gagal: ${err.name}${err.code ? ` (${err.code})` : ''}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
