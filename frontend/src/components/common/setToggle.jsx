export default function Toggle({ on, onClick, label, sub }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 border-2 transition-colors ${on ? 'border-[#0E7C66] bg-[#0E7C66]/10' : 'border-black/20 hover:border-black'}`}>
      <div className="text-left">
        <p className="text-sm font-black">{label}</p>
        <p className="text-[10px] opacity-60">{sub}</p>
      </div>
      <span className={`w-10 h-6 border-2 border-black relative transition-colors ${on ? 'bg-[#0E7C66]' : 'bg-white'}`}>
        <span className={`absolute top-0.5 w-3 h-3 bg-black transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}