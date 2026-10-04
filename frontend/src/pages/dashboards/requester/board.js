// Menyusun kartu papan dari /needs/mine + /projects/mine (dipakai beranda requester & liaison).

export const BOARD_COLUMNS = [
  { id: 'ANTRIAN', label: 'DALAM ANTRIAN' },
  { id: 'DIPROSES', label: 'DIPROSES' },
  { id: 'MENUNGGU', label: 'MENUNGGU VERIFIKASI' },
  { id: 'SELESAI', label: 'SELESAI DIVERIFIKASI' },
];

/** @returns {{ need: object, project: object|null, column: string|null }[]} */
export function buildBoard(needs = [], projects = []) {
  // projects/mine terurut terbaru dulu: proyek pertama per need = proyek terbaru.
  const projectByNeed = new Map();
  for (const p of projects) {
    if (p.status === 'CANCELLED') continue;
    if (!projectByNeed.has(p.need_id)) projectByNeed.set(p.need_id, p);
  }
  return needs.map((need) => {
    const project = projectByNeed.get(need.id) || null;
    let column = null;
    if (project) {
      if (project.status === 'COMPLETED') column = 'SELESAI';
      else if (project.status === 'AWAITING_VERIFICATION') column = 'MENUNGGU';
      else column = 'DIPROSES';
    } else if (need.status !== 'CLOSED' && need.status !== 'COMPLETED') {
      column = 'ANTRIAN';
    }
    return { need, project, column };
  });
}

/** Hal yang menunggu tindakan pemilik, urut paling mendesak. */
export function pendingActions(cards) {
  const actions = [];
  for (const card of cards) {
    const { need, project } = card;
    if (project?.status === 'AWAITING_VERIFICATION') {
      actions.push({ card, tone: 'warning', label: 'Tinjau hasil & verifikasi', rank: 0 });
    } else if (project?.status === 'DISPUTED') {
      actions.push({ card, tone: 'danger', label: 'Sengketa sedang dimediasi — isi pernyataan', rank: 1 });
    } else if (!project && need.moderation_status === 'APPROVED' && need.status === 'OPEN' && Number(need.applicants_waiting) > 0) {
      actions.push({ card, tone: 'info', label: `${need.applicants_waiting} pelamar menunggu dipilih`, rank: 2 });
    } else if (!project && need.moderation_status === 'REJECTED') {
      actions.push({ card, tone: 'danger', label: 'Ditolak moderasi — perbaiki & kirim ulang', rank: 3 });
    }
  }
  return actions.sort((a, b) => a.rank - b.rank);
}
