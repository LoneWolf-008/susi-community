import Badge from './Badge';
export default function ProjectTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#12283c]/15">
            <th className="py-3 pr-4 label-mono">Proyek</th>
            <th className="py-3 pr-4 label-mono">Pihak</th>
            <th className="py-3 pr-4 label-mono">Status</th>
            <th className="py-3 text-right label-mono">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#12283c]/10">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[#12283c]/5 transition-colors">
              <td className="py-4 pr-4 font-bold text-[#12283c]">{r.p}</td>
              <td className="py-4 pr-4 text-xs text-[#12283c]/60">{r.o}</td>
              <td className="py-4 pr-4"><Badge type={r.s} /></td>
              <td className="py-4 text-right">
                <button className="chip-mono text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white transition-colors">{r.a}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}