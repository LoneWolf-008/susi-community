import { useState, useEffect } from 'react';

export default function ProjSteps({ status }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);
  const labels = [
    { l: 'DITERIMA' },
    { l: 'DIKERJAKAN' },
    { l: 'SELESAI' },
    { l: 'VERIFIKASI' },
  ];
  const curIdx = status === 'PROSES' ? 1 : (status === 'VERIFIKASI' || status === 'MENUNGGU') ? 3 : status === 'SELESAI' ? 4 : 0;
  const pct = status === 'PROSES' ? 50 : (status === 'VERIFIKASI' || status === 'MENUNGGU') ? 83 : status === 'SELESAI' ? 100 : 10;
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-60">Progress Proyek</p>
        <p className="text-[10px] font-mono font-black text-[#FF5733]">{pct}%</p>
      </div>
      <div className="relative mx-2">
        <div className="h-3 border-2 border-black bg-white overflow-hidden">
          <div className="h-full bg-[#FF5733] transition-all duration-1000 ease-out" style={{ width: mounted ? `${pct}%` : '0%' }} />
        </div>
        {labels.map((s, i) => (
          <span
            key={s.n}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-45 border-2 border-black transition-colors ${
              i < curIdx ? 'bg-[#0E7C66]' : i === curIdx ? 'bg-[#FF5733] animate-pulse' : 'bg-white'
            }`}
            style={{ left: `${(i / 3) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative mx-2 mt-2 h-7">
        {labels.map((s, i) => (
          <span
            key={s.n}
            className={`absolute text-[8px] font-mono font-bold leading-tight ${
              i === 0 ? 'left-0' : i === 3 ? 'right-0 text-right' : '-translate-x-1/2 text-center'
            } ${i < curIdx ? 'text-[#0E7C66]' : i === curIdx ? 'text-[#FF5733]' : 'opacity-50'}`}
            style={i === 1 || i === 2 ? { left: `${(i / 3) * 100}%` } : undefined}
          >
            {s.n} {s.l}
          </span>
        ))}
      </div>
    </div>
  );
}