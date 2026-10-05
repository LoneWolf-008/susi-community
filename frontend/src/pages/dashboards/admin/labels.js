// Label tampilan khusus dasbor admin.

export const AUDIT_ACTION = {
  CREATE: { label: 'Membuat', color: 'bg-[#12283c]' },
  UPDATE: { label: 'Mengubah', color: 'bg-[#12283c]' },
  CLOSE: { label: 'Menutup', color: 'bg-[#6b7280]' },
  CANCEL: { label: 'Mundur', color: 'bg-[#6b7280]' },
  COMPLETE: { label: 'Menyelesaikan', color: 'bg-[#c9ecd9]' },
  MODERATE: { label: 'Memoderasi', color: 'bg-[#e62b2b]' },
  RESOLVE_DISPUTE: { label: 'Memutus sengketa', color: 'bg-[#7a1a1f]' },
  UPDATE_STATUS: { label: 'Mengubah status akun', color: 'bg-[#b45309]' },
  CREATE_LIAISON: { label: 'Membuat akun AgenSUSI', color: 'bg-[#0e7490]' },
  TAKEDOWN: { label: 'Menurunkan testimoni', color: 'bg-[#e62b2b]' },
  CLAIM_ESCALATION: { label: 'Mengklaim eskalasi', color: 'bg-[#0e7490]' },
  RESOLVE_ESCALATION: { label: 'Menyelesaikan eskalasi', color: 'bg-[#c9ecd9]' },
  CLOSE_ESCALATION: { label: 'Menutup eskalasi', color: 'bg-[#6b7280]' },
  HANDBACK_ESCALATION: { label: 'Mengembalikan eskalasi ke AI', color: 'bg-[#0e7490]' },
  CREATE_KB: { label: 'Membuat entri KB', color: 'bg-[#12283c]' },
  UPDATE_KB: { label: 'Mengubah entri KB', color: 'bg-[#12283c]' },
  APPROVE_KB: { label: 'Menyetujui entri KB', color: 'bg-[#15803d]' },
  ARCHIVE_KB: { label: 'Mengarsipkan entri KB', color: 'bg-[#6b7280]' },
  UNPUBLISH_KB: { label: 'Menjadikan draft KB', color: 'bg-[#b45309]' },
};

export const AUDIT_ENTITY = {
  needs: 'Kebutuhan',
  projects: 'Proyek',
  moderation_items: 'Moderasi',
  disputes: 'Sengketa',
  testimonials: 'Testimoni',
  users: 'Pengguna',
  escalations: 'Eskalasi Tanya SUSI',
  kb_entries: 'Basis pengetahuan',
};

export const auditAction = (action) => AUDIT_ACTION[action] || { label: action, color: 'bg-[#9CA3AF]' };

export const RISK_TONE = { RENDAH: 'success', SEDANG: 'warning', TINGGI: 'danger' };
export const DISPUTE_DECISION = {
  MARK_COMPLETE: 'Proyek dinyatakan selesai (reputasi talenta +1)',
  EXTEND_7_DAYS: 'Tenggat diperpanjang 7 hari, proyek kembali dikerjakan',
};

/** Jumlah hari sejak tanggal (dibulatkan ke bawah). */
export const daysSince = (value, now = Date.now()) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 86400000));
};
