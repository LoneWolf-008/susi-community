// Pemetaan status backend → label UI (satu tempat untuk semua dasbor).
//
// Langkah ProjSteps: 0 DITERIMA · 1 DIKERJAKAN · 2 SELESAI · 3 VERIFIKASI · 4 = semua tuntas.
// AWAITING_VERIFICATION = talenta sudah menandai SELESAI dan komunitas sedang memverifikasi
// (langkah 3); COMPLETED = terverifikasi dua arah (langkah 4).

export const PROJECT_STATUS = {
  AGREEMENT: { label: 'DITERIMA', step: 0, tone: 'info', hint: 'Menunggu talenta menyetujui kesepakatan' },
  IN_PROGRESS: { label: 'DIKERJAKAN', step: 1, tone: 'info', hint: 'Talenta sedang mengerjakan' },
  REVISION: { label: 'REVISI', step: 1, tone: 'warning', hint: 'Komunitas meminta perbaikan' },
  AWAITING_VERIFICATION: { label: 'MENUNGGU VERIFIKASI', step: 3, tone: 'warning', hint: 'Talenta menandai selesai, menunggu konfirmasi komunitas' },
  COMPLETED: { label: 'TERVERIFIKASI', step: 4, tone: 'success', hint: 'Selesai dan dikonfirmasi kedua pihak' },
  DISPUTED: { label: 'SENGKETA', step: null, tone: 'danger', hint: 'Sedang dimediasi admin' },
  CANCELLED: { label: 'DIBATALKAN', step: null, tone: 'muted', hint: 'Talenta mundur dari proyek' },
};

export const NEED_STATUS = {
  OPEN: { label: 'TERBUKA', tone: 'info' },
  IN_PROGRESS: { label: 'DIKERJAKAN', tone: 'info' },
  COMPLETED: { label: 'SELESAI', tone: 'success' },
  CLOSED: { label: 'DITUTUP', tone: 'muted' },
};

export const MODERATION_STATUS = {
  PENDING: { label: 'MENUNGGU MODERASI', tone: 'warning' },
  APPROVED: { label: 'TAYANG', tone: 'success' },
  REJECTED: { label: 'DITOLAK', tone: 'danger' },
};

export const APPLICATION_STATUS = {
  MENUNGGU: { label: 'MENUNGGU', tone: 'warning' },
  DITERIMA: { label: 'DITERIMA', tone: 'success' },
  DITOLAK: { label: 'DITOLAK', tone: 'muted' },
};

export const DISPUTE_STATUS = {
  MEDIASI: { label: 'MEDIASI', tone: 'warning' },
  ESKALASI: { label: 'ESKALASI', tone: 'danger' },
  SELESAI: { label: 'SELESAI', tone: 'success' },
};

// Tiket eskalasi Tanya SUSI ke AgenSUSI (T13).
export const ESCALATION_STATUS = {
  pending: { label: 'MENUNGGU', tone: 'warning' },
  assigned: { label: 'DITANGANI', tone: 'info' },
  resolved: { label: 'SELESAI', tone: 'success' },
  closed: { label: 'DITUTUP', tone: 'muted' },
  cancelled: { label: 'DIBATALKAN', tone: 'muted' }, // U6: pengguna kembali ke asisten AI
};

// Ruang AgenSUSI (U6): status alih-percakapan yang dilihat pengguna (objek `handoff` dari backend).
export const HANDOFF_ACTIVE = ['requested', 'waiting', 'assigned'];
export const HANDOFF_STATUS = {
  requested: { label: 'MENUNGGU AGEN', tone: 'warning' },
  waiting: { label: 'MENUNGGU AGEN', tone: 'warning' },
  assigned: { label: 'DITANGANI', tone: 'info' },
  resolved: { label: 'SELESAI', tone: 'success' },
};

export const ESCALATION_REASON = {
  explicit_request: 'Minta AgenSUSI',
  sensitive: 'Topik sensitif',
  complaint: 'Keluhan',
  repeated: 'Pertanyaan berulang',
  unanswered: 'Tidak terjawab',
  long_unresolved: 'Percakapan panjang',
  user_request: 'Permintaan pengguna',
};

export const KB_STATUS = {
  active: { label: 'AKTIF', tone: 'success' },
  draft: { label: 'DRAFT', tone: 'warning' },
  archived: { label: 'ARSIP', tone: 'muted' },
};

export const KB_AUDIENCE = {
  all: 'Semua',
  public: 'Pengunjung',
  requester: 'Komunitas',
  talent: 'Talenta',
  liaison: 'AgenSUSI',
};

export const VISIT_STATUS = {
  DIRENCANAKAN: { label: 'DIRENCANAKAN', tone: 'info' },
  BERLANGSUNG: { label: 'BERLANGSUNG', tone: 'warning' },
  TERDATA: { label: 'TERDATA', tone: 'success' },
};

export const NEED_CATEGORY = {
  PENCATATAN: 'Pencatatan & Data',
  WEBSITE: 'Website',
  APLIKASI: 'Aplikasi',
  LAINNYA: 'Lainnya',
};

export const NEED_SOURCE = {
  MANDIRI: 'Mandiri',
  AGENSUSI: 'AgenSUSI',
};

export const TALENT_LEVEL = {
  TALENTA_MUDA: 'Talenta Muda',
  TALENTA_TERPERCAYA: 'Talenta Terpercaya',
  TALENTA_AHLI: 'Talenta Ahli',
};

// Warna mengikuti palet DashShell/Badge.
export const TONE_COLOR = {
  info: '#12283c',
  warning: '#b45309',
  success: '#15803d',
  danger: '#e62b2b',
  muted: '#6b7280',
};

const FALLBACK = (value) => ({ label: value ? String(value).replace(/_/g, ' ') : '—', tone: 'muted', step: null });

export const projectStatus = (status) => PROJECT_STATUS[status] || FALLBACK(status);
export const needStatus = (status) => NEED_STATUS[status] || FALLBACK(status);
export const moderationStatus = (status) => MODERATION_STATUS[status] || FALLBACK(status);
export const applicationStatus = (status) => APPLICATION_STATUS[status] || FALLBACK(status);
export const disputeStatus = (status) => DISPUTE_STATUS[status] || FALLBACK(status);
export const visitStatus = (status) => VISIT_STATUS[status] || FALLBACK(status);
export const escalationStatus = (status) => ESCALATION_STATUS[status] || FALLBACK(status);
export const kbStatus = (status) => KB_STATUS[status] || FALLBACK(status);
