import { formatDateTime } from '../../lib/format';

/** Lini masa dari project_events (terlama di atas). */
export default function ProjectTimeline({ events = [] }) {
  const ordered = [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  if (ordered.length === 0) return <p className="text-sm text-[#12283c]/60">Belum ada aktivitas.</p>;
  return (
    <ol className="space-y-0">
      {ordered.map((ev, i) => (
        <li key={ev.id} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
          <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-[#12283c] ${i === ordered.length - 1 ? 'bg-[#e62b2b]' : 'bg-[#c9ecd9]'}`} />
          <p className="font-mono text-[10px] font-bold mb-1">{formatDateTime(ev.created_at)}</p>
          <p className="text-sm font-bold">{ev.label}</p>
        </li>
      ))}
    </ol>
  );
}
