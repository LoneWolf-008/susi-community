// Kelas warna percakapan Tanya SUSI: gelap (overlay publik) dan terang (widget dasbor, Ruang AgenSUSI).

export const CHAT_THEMES = {
  dark: {
    text: 'text-[#f2efe6]',
    muted: 'text-[#f2efe6]/55',
    divider: 'border-white/10',
    ai: 'bg-white/[0.06] border border-white/10 text-[#f2efe6]/90',
    chip: 'border border-white/15 text-[#f2efe6]/85 hover:bg-white/10',
    action: 'border border-white/15 text-[#f2efe6]/70 hover:bg-white/10',
    input: 'bg-white/5 border border-white/10 text-[#f2efe6] placeholder-[#f2efe6]/35 focus-within:border-[#e62b2b]/60',
    field: 'bg-white/5 border border-white/15 text-[#f2efe6] placeholder-[#f2efe6]/40',
    link: 'underline underline-offset-2 break-all text-[#c9ecd9]',
    alert: 'bg-[#e62b2b]/15 border border-[#e62b2b]/40 text-[#f2efe6]',
    panel: 'bg-white/[0.04] border border-white/10',
  },
  light: {
    text: 'text-[#12283c]',
    muted: 'text-[#12283c]/55',
    divider: 'border-[#12283c]/10',
    ai: 'bg-white border border-[#12283c]/10 text-[#12283c] shadow-sm',
    chip: 'border border-[#12283c]/15 bg-white text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6]',
    action: 'border border-[#12283c]/15 text-[#12283c]/70 hover:bg-[#12283c]/5',
    input: 'bg-[#f2efe6] border border-[#12283c]/10 text-[#12283c] placeholder-[#12283c]/40 focus-within:border-[#e62b2b]',
    field: 'bg-white border border-[#12283c]/15 text-[#12283c] placeholder-[#12283c]/40',
    link: 'underline underline-offset-2 break-all text-[#e62b2b]',
    alert: 'bg-[#e62b2b]/10 border border-[#e62b2b]/30 text-[#12283c]',
    panel: 'bg-white border border-[#12283c]/10',
  },
};
