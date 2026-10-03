export default function SectorMap() {
  const sectors = [
    { l: 'BARAT–UTARA', n: 7 }, { l: 'TIMUR–UTARA', n: 4 },
    { l: 'BARAT–SELATAN', n: 6 }, { l: 'TIMUR–SELATAN', n: 3 },
  ];
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-px bg-[#12283c]/10 border border-[#12283c]/15 rounded-xl overflow-hidden">
        {sectors.map((s, i) => (
          <div key={i} className="bg-[#fdfcf7] p-5 hover:bg-[#e62b2b] hover:text-white transition-colors duration-300 group cursor-default">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black tabular-nums">{s.n}</span>
              <span className="w-2 h-2 bg-[#e62b2b] group-hover:bg-white rotate-45 transition-colors" />
            </div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest mt-2 opacity-60 group-hover:opacity-90">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-[#12283c] text-[#f2efe6] flex items-center justify-center rotate-45 rounded-sm">
        <span className="-rotate-45 font-mono text-[8px] font-bold">KOTA</span>
      </div>
    </div>
  );
}