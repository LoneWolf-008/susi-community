export default function ActivityFeed({ items }) {
  return (
    <div className="divide-y divide-[#12283c]/10">
      {items.map((a, i) => (
        <div key={i} className="flex gap-4 items-start py-3 px-2 hover:bg-[#12283c]/5 transition-colors rounded-lg">
          <span className={`mt-1.5 w-2 h-2 shrink-0 rotate-45 ${a.c}`} />
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight text-[#12283c]">{a.t}</p>
            <p className="text-xs text-[#12283c]/50 mt-0.5">{a.s}</p>
          </div>
          <span className="font-mono text-[10px] opacity-50 shrink-0">{a.time}</span>
        </div>
      ))}
    </div>
  );
}