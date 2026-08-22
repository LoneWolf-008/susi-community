import Badge from './Badge';

export default function ProjectTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-black text-[10px] font-mono uppercase tracking-widest">
            <th className="py-3 pr-4">Proyek</th>
            <th className="py-3 pr-4">Pihak</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-black/5 transition-colors">
              <td className="py-4 pr-4 font-bold">{r.p}</td>
              <td className="py-4 pr-4 text-xs opacity-70">{r.o}</td>
              <td className="py-4 pr-4"><Badge type={r.s} /></td>
              <td className="py-4 text-right">
                <button className="text-[10px] font-mono font-bold border-2 border-black px-3 py-1.5 hover:bg-[#FF5733] hover:border-[#FF5733] hover:text-white transition-colors">{r.a}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}