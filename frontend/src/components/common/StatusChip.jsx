// Chip status seragam dari lib/statusMap (warna ditentukan oleh "tone").
const TONE_CLASS = {
  info: 'bg-[#12283c] text-[#f2efe6]',
  warning: 'bg-[#e62b2b] text-white',
  success: 'bg-[#c9ecd9] text-[#12283c]',
  danger: 'bg-[#7a1a1f] text-white',
  muted: 'bg-[#12283c]/10 text-[#12283c]/70',
};

export default function StatusChip({ status, className = '' }) {
  if (!status) return null;
  return (
    <span className={`chip-mono border-0 ${TONE_CLASS[status.tone] || TONE_CLASS.muted} ${className}`}>
      {status.label}
    </span>
  );
}

/** Chip netral (kategori, sumber, dll.). */
export function TagChip({ children, dark = false }) {
  return <span className={`chip-mono ${dark ? 'border-white/30 text-[#f2efe6]/80' : 'text-[#12283c]'}`}>{children}</span>;
}
