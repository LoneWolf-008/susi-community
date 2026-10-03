export default function MiniBars({ data, height = 110 }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group">
          <div className="w-full rounded-t-sm bg-[#12283c] group-hover:bg-[#e62b2b] transition-colors" style={{ height: `${(d.v / max) * 100}%` }} />
          <span className="font-mono text-[9px] opacity-50">{d.l}</span>
        </div>
      ))}
    </div>
  );
}