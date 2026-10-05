// Ruang AgenSUSI (U6): status alih-percakapan yang dilihat pengguna, diturunkan dari tiket eskalasi
// terakhir di sesi. Selama tiket terbuka (pending/assigned), AI dijeda: pesan pengguna disimpan untuk
// AgenSUSI tanpa memanggil LLM dan tanpa baris ask_logs.
//   none      tidak ada tiket, tiket dibatalkan/ditutup, atau pengguna sudah menutup tiket selesai
//   requested tiket menunggu, tetapi tidak ada AgenSUSI yang bertugas (di luar jam layanan / tanpa liaison aktif)
//   waiting   tiket menunggu diklaim AgenSUSI yang sedang bertugas
//   assigned  ditangani AgenSUSI
//   resolved  selesai; pengguna belum menilai atau kembali ke AI
import { env } from '../../config/env.js';
import { withinServiceHours } from './escalation.js';

export const ACTIVE_ESCALATION = ['pending', 'assigned'];
export const ACTIVE_HANDOFF = ['requested', 'waiting', 'assigned'];

const TZ_LABELS = { 'Asia/Jakarta': 'WIB', 'Asia/Pontianak': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
const clock = (hhmm) => hhmm.trim().replace(':', '.');

/** "08.00–17.00 WIB" dari CHATBOT_SERVICE_HOURS, atau null bila setiap saat. */
export function serviceHoursLabel({ hours = env.chatbot.serviceHours, timeZone = env.chatbot.serviceTimeZone } = {}) {
  if (!hours) return null;
  const [start, end] = hours.split('-');
  return `${clock(start)}–${clock(end)} ${TZ_LABELS[timeZone] ?? timeZone}`;
}

/** Perkiraan kapan dibalas, mengikuti jam layanan T13. Hanya untuk tiket yang belum diklaim. */
export function etaText(status, { hasLiaison = true, hours = env.chatbot.serviceHours, timeZone = env.chatbot.serviceTimeZone } = {}) {
  const label = serviceHoursLabel({ hours, timeZone });
  if (status === 'waiting') {
    return label ? `Biasanya dibalas dalam beberapa menit pada jam layanan ${label}.` : 'Biasanya dibalas dalam beberapa menit.';
  }
  if (status === 'requested') {
    if (!hasLiaison || !label) {
      return 'Belum ada AgenSUSI yang bertugas. Balasan tetap muncul di sini; untuk bantuan cepat, hubungi WhatsApp resmi SUSI.';
    }
    const opens = clock(hours.split('-')[0]);
    return `Di luar jam layanan (${label}). AgenSUSI membalas mulai pukul ${opens} ${TZ_LABELS[timeZone] ?? timeZone}.`;
  }
  return null;
}

/** Status pengguna dari baris tiket (lihat daftar di atas). `available` hanya dipakai untuk tiket pending. */
export function handoffStatus(row, available = true) {
  if (!row) return 'none';
  if (row.status === 'pending') return available ? 'waiting' : 'requested';
  if (row.status === 'assigned') return 'assigned';
  if (row.status === 'resolved' && !row.user_done_at) return 'resolved';
  return 'none';
}

const SELECT_TICKET = `
  SELECT e.id, e.session_id, e.status, e.summary, e.assigned_to, e.handoff_message_id, e.handed_back, e.user_read_id,
         e.agent_read_id, e.rating, e.user_done_at, e.created_at, e.assigned_at, e.resolved_at,
         a.name AS agent_name, a.avatar_url AS agent_avatar
  FROM escalations e
  LEFT JOIN users a ON a.id = e.assigned_to`;

/** Tiket terakhir sesi (status apa pun) beserta nama/avatar AgenSUSI, atau null. */
export async function latestTicket(db, sessionId) {
  const [rows] = await db.query(`${SELECT_TICKET} WHERE e.session_id = ? ORDER BY e.id DESC LIMIT 1`, [sessionId]);
  return rows[0] ?? null;
}

/** Balasan AgenSUSI yang belum dilihat pengguna di sesi ini. */
export async function unreadForUser(db, ticket) {
  if (!ticket) return 0;
  const [[{ n }]] = await db.query(
    `SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ? AND role = 'agent' AND id > ?`,
    [ticket.session_id, ticket.user_read_id],
  );
  return Number(n);
}

/**
 * Objek `handoff` untuk respons chatbot: `{ status, ticket_id, agent: {name, avatar}|null, eta_text,
 * summary, handed_back, rating, unread, since_message_id }`. `summary` = ringkasan yang dikirim ke
 * AgenSUSI (transparansi); `since_message_id` = awal bagian AgenSUSI di transkrip.
 */
export function toHandoff(ticket, { available = true, hasLiaison = true, unread = 0 } = {}) {
  const status = handoffStatus(ticket, available);
  if (status === 'none') {
    return {
      status, ticket_id: null, agent: null, eta_text: null, summary: null, handed_back: false, rating: null, unread: 0,
      since_message_id: null,
    };
  }
  return {
    status,
    ticket_id: ticket.id,
    agent: ticket.agent_name ? { name: ticket.agent_name, avatar: ticket.agent_avatar ?? null } : null,
    eta_text: etaText(status, { hasLiaison }),
    summary: ticket.summary,
    handed_back: Boolean(Number(ticket.handed_back)),
    rating: ticket.rating ?? null,
    unread,
    since_message_id: ticket.handoff_message_id ?? null,
  };
}

/** Objek `handoff` sesi saat ini (satu query tiket, plus ketersediaan agen & jumlah belum dibaca bila perlu). */
export async function sessionHandoff(db, sessionId, ticket) {
  const row = ticket === undefined ? await latestTicket(db, sessionId) : ticket;
  if (handoffStatus(row) === 'none') return toHandoff(null);
  let available = true;
  let hasLiaison = true;
  if (row.status === 'pending') {
    const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'liaison' AND status = 'AKTIF'`);
    hasLiaison = Number(n) > 0;
    available = hasLiaison && withinServiceHours();
  }
  return toHandoff(row, { available, hasLiaison, unread: await unreadForUser(db, row) });
}

/** Pengguna sudah melihat semua pesan sesi (semua tiket di sesi ikut, agar tiket lama tidak berlencana). */
export async function markReadByUser(db, sessionId) {
  await db.query(
    `UPDATE escalations
     SET user_read_id = GREATEST(user_read_id, COALESCE((SELECT MAX(id) FROM chat_messages WHERE session_id = ?), 0))
     WHERE session_id = ?`,
    [sessionId, sessionId],
  );
}

/**
 * Tiket selesai ditutup pengguna (menilai, melewati penilaian, atau bertanya lagi ke AI). Penilaian
 * hanya diisi sekali; menutup tanpa nilai tetap bisa dinilai belakangan dari Ruang AgenSUSI.
 */
export async function closeResolvedForUser(db, ticketId, rating = null) {
  await db.query(
    `UPDATE escalations SET rating = COALESCE(rating, ?), user_done_at = COALESCE(user_done_at, NOW())
     WHERE id = ? AND status = 'resolved'`,
    [rating, ticketId],
  );
}
