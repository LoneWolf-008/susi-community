import { useState, useEffect } from 'react';
export default function ProjSteps({ status }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 150); return () => clearTimeout(t); }, []);
  const labels = ['DITERIMA', 'DIKERJAKAN', 'SELESAI', 'VERIFIKASI'];
  const curIdx = status === 'PROSES' ? 1 : (status === 'VERIFIKASI' || status === 'MENUNGGU') ? 3 : status === 'SELESAI' ? 4 : 0;
  const pct = status === 'PROSES' ? 50 : (status === 'VERIFIKASI' || status === 'MENUNGGU') ? 83 : status === 'SELESAI' ? 100 : 10;
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="label-mono">Progress Proyek</p>
        <p className="font-mono text-[11px] font-bold text-[#e62b2b]">{pct}%</p>
      </div>
      <div className="relative mx-2">
        <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden">
          <div className="h-full rounded-full bg-[#e62b2b] transition-all duration-1000 ease-out" style={{ width: mounted ? `${pct}%` : '0%' }} />
        </div>
        {labels.map((_, i) => (
          <span
            key={i}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rotate-45 transition-colors ${i < curIdx ? 'bg-[#12283c]' : i === curIdx ? 'bg-[#e62b2b] animate-pulse' : 'bg-[#f2efe6] border border-[#12283c]/30'}`}
            style={{ left: `${(i / 3) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative mx-2 mt-2 h-7">
        {labels.map((l, i) => (
          <span
            key={i}
            className={`absolute font-mono text-[8px] font-bold leading-tight ${i === 0 ? 'left-0' : i === 3 ? 'right-0 text-right' : '-translate-x-1/2 text-center'} ${i < curIdx ? 'text-[#12283c]' : i === curIdx ? 'text-[#e62b2b]' : 'opacity-40'}`}
            style={i === 1 || i === 2 ? { left: `${(i / 3) * 100}%` } : undefined}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}