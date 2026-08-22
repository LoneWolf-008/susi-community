export default function SectorMap() {
  const sectors = [
    { l: 'BARAT–UTARA', n: 7 },
    { l: 'TIMUR–UTARA', n: 4 },
    { l: 'BARAT–SELATAN', n: 6 },
    { l: 'TIMUR–SELATAN', n: 3 },
  ];
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-px bg-black border-2 border-black">
        {sectors.map((s, i) => (
          <div key={i} className="bg-white p-5 hover:bg-[#FF5733] hover:text-white transition-colors duration-300 group cursor-default">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black tabular-nums">{s.n}</span>
              <span className="w-2 h-2 bg-[#FF5733] group-hover:bg-white rotate-45 transition-colors" />
            </div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest mt-2 opacity-60 group-hover:opacity-90">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-black text-white flex items-center justify-center rotate-45 border-2 border-black">
        <span className="-rotate-45 text-[8px] font-mono font-bold">KOTA</span>
      </div>
    </div>
  );
}