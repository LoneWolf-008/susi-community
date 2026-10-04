export default function MiniBars({ data, height = 110 }) {
  // Minimal 1 agar semua-nol tidak menghasilkan tinggi NaN%.
  const max = Math.max(1, ...data.map((d) => Number(d.v) || 0));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group" title={`${d.l}: ${d.v}`}>
          <span className="font-mono text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{d.v}</span>
          <div className="w-full rounded-t-sm bg-[#12283c] group-hover:bg-[#e62b2b] transition-colors" style={{ height: `${((Number(d.v) || 0) / max) * 100}%` }} />
          <span className="font-mono text-[9px] opacity-50">{d.l}</span>
        </div>
      ))}
    </div>
  );
}
