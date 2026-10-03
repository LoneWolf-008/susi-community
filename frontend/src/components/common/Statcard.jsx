export default function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 ${accent ? 'bg-[#e62b2b] text-white' : 'card-light text-[#12283c]'}`}>
      <p className="label-mono">{label}</p>
      <div className="text-5xl font-black mt-2 tabular-nums tracking-tight">{value}</div>
      <p className="text-xs mt-2 opacity-70">{sub}</p>
    </div>
  );
}