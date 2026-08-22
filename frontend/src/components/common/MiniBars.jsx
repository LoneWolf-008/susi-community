export default function MiniBars({ data, height = 110 }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group">
          <div className="bar-v w-full bg-black group-hover:bg-[#FF5733] transition-colors" style={{ height: `${(d.v / max) * 100}%` }} />
          <span className="text-[9px] font-mono opacity-50">{d.l}</span>
        </div>
      ))}
    </div>
  );
}