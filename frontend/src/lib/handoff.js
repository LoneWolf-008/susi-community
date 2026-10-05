// Ruang AgenSUSI (U6): pembantu untuk objek `handoff` dari backend
// ({ status: none|requested|waiting|assigned|resolved, agent, ticket_id, eta_text, summary, ... }).
import { HANDOFF_ACTIVE } from './statusMap';

/** Percakapan sedang dialihkan ke AgenSUSI (AI dijeda). */
export const isHandoffActive = (handoff) => HANDOFF_ACTIVE.includes(handoff?.status);

/** Ada bagian AgenSUSI yang perlu ditampilkan (aktif atau selesai menunggu penilaian). */
export const hasHandoff = (handoff) => Boolean(handoff) && handoff.status !== 'none';

/** Siapa yang menangani, untuk judul bagian AgenSUSI. */
export const handoffTitle = (handoff) => {
  if (handoff.status === 'assigned' || handoff.status === 'resolved') return handoff.agent?.name || 'AgenSUSI';
  return 'Menunggu AgenSUSI';
};
