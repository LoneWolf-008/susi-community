export default function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`bento-card border-2 border-black p-6 hover:shadow-[6px_6px_0_0_#000] hover:-translate-y-1 transition-all duration-300 ${accent ? 'bg-[#FF5733] text-white' : 'bg-white'}`}>
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60">{label}</p>
      <div className="text-5xl font-black mt-2 tabular-nums">{value}</div>
      <p className="text-xs mt-2 opacity-70">{sub}</p>
    </div>
  );
}