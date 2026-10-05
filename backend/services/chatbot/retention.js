// Retensi riwayat Tanya SUSI (T15): isi chat yang lebih tua dari CHATBOT_RETENTION_DAYS (bawaan 90)
// dihapus. Dijalankan harian oleh server.js dan bisa manual lewat `npm run chat:retention`.
//  1. pertanyaan di ask_logs dianonimkan (kosong, tanpa user_id); metrik biaya & kualitas tetap ada;
//  2. chat_messages dihapus;
//  3. sesi yang sudah lama tidak aktif dan tidak berisi pesan lagi dihapus (beserta tiket selesainya).
// Sesi dengan tiket eskalasi yang masih terbuka dilewati agar AgenSUSI tetap melihat percakapannya.
// Log hanya berisi jumlah baris, tidak pernah isi chat.
import { env } from '../../config/env.js';
import { deleteSessions } from './privacy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;
const NO_OPEN_TICKET = (column) => `NOT EXISTS (
  SELECT 1 FROM escalations e WHERE e.session_id = ${column} AND e.status IN ('pending', 'assigned'))`;

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ days?: number }} [options] 0 = retensi dimatikan
 * @returns {Promise<{ days: number, questions: number, messages: number, sessions: number }>}
 */
export async function purgeExpiredChats(pool, { days = env.chatbot.retentionDays } = {}) {
  const result = { days, questions: 0, messages: 0, sessions: 0 };
  if (!days) return result;

  const [logs] = await pool.query(
    `UPDATE ask_logs SET question = '', user_id = NULL
     WHERE created_at < NOW() - INTERVAL ? DAY
       AND (question <> '' OR user_id IS NOT NULL)
       AND (session_id IS NULL OR ${NO_OPEN_TICKET('ask_logs.session_id')})`,
    [days],
  );
  result.questions = logs.affectedRows;

  const [messages] = await pool.query(
    `DELETE FROM chat_messages
     WHERE created_at < NOW() - INTERVAL ? DAY AND ${NO_OPEN_TICKET('chat_messages.session_id')}`,
    [days],
  );
  result.messages = messages.affectedRows;

  for (;;) {
    const [rows] = await pool.query(
      `SELECT s.id FROM chat_sessions s
       WHERE s.last_active_at < NOW() - INTERVAL ? DAY
         AND NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.session_id = s.id)
         AND ${NO_OPEN_TICKET('s.id')}
       LIMIT ${BATCH}`,
      [days],
    );
    if (rows.length === 0) break;
    result.sessions += await deleteSessions(pool, rows.map((r) => r.id));
    if (rows.length < BATCH) break;
  }
  return result;
}

/**
 * Jalankan retensi sehari sekali (pertama kali 1 menit setelah server hidup). Timer di-unref agar
 * tidak menahan proses saat shutdown.
 * @returns {(() => void) | null} penghenti job, atau null bila retensi dimatikan
 */
export function startRetentionJob(pool, { days = env.chatbot.retentionDays, intervalMs = DAY_MS, firstRunMs = 60 * 1000 } = {}) {
  if (!days) return null;
  const run = async () => {
    try {
      const r = await purgeExpiredChats(pool, { days });
      if (r.questions || r.messages || r.sessions) {
        console.log(`[retensi chat] ${r.messages} pesan & ${r.sessions} sesi dihapus, ${r.questions} pertanyaan dianonimkan`);
      }
    } catch (err) {
      console.warn(`[retensi chat] gagal: ${err.name}${err.code ? ` (${err.code})` : ''}`);
    }
  };
  const first = setTimeout(run, firstRunMs);
  const timer = setInterval(run, intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
