/** Saklar pengaturan (role="switch" agar status on/off terbaca pembaca layar). */
export default function Toggle({ on, onClick, label, sub }) {
  return (
    <button type="button" role="switch" aria-checked={Boolean(on)} onClick={onClick} className="w-full flex items-center justify-between p-4 rounded-xl border border-[#12283c]/15 bg-[#fdfcf7] hover:border-[#12283c]/40 transition-colors text-left">
      <span>
        <span className="block text-sm font-black text-[#12283c]">{label}</span>
        <span className="block text-[10px] text-[#12283c]/50 mt-0.5">{sub}</span>
      </span>
      <span aria-hidden="true" className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-[#e62b2b]' : 'bg-[#12283c]/20'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
