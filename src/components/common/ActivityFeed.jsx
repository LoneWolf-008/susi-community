export default function ActivityFeed({ items }) {
  return (
    <div className="divide-y-2 divide-black/10">
      {items.map((a, i) => (
        <div key={i} className="feed-item flex gap-4 items-start py-3 px-2 hover:bg-black/5 transition-colors">
          <span className={`mt-1.5 w-2 h-2 shrink-0 ${a.c}`} />
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight">{a.t}</p>
            <p className="text-xs opacity-60 mt-0.5">{a.s}</p>
          </div>
          <span className="text-[10px] font-mono opacity-50 shrink-0">{a.time}</span>
        </div>
      ))}
    </div>
  );
}