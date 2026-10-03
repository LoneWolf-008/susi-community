import { useState } from 'react';
export default function VerifyModal({ onClose }) {
  const [proj, setProj] = useState(0);
  const [step, setStep] = useState(0);
  const PROJECTS = [
    { t: 'Aplikasi Iuran Warga', talent: 'Derien A.' },
    { t: 'Website Profil PKK', talent: 'Khalifa H.' },
    { t: 'Formulir Pendaftaran Digital', talent: 'Ezra P.' },
  ];
  const p = PROJECTS[proj];
  const steps = [
    { n: '06', l: 'TALENTA MENANDAI SELESAI' },
    { n: '07', l: 'KOMUNITAS MEMBENARKAN' },
    { n: '08', l: 'REPUTASI +1' },
  ];
  const pct = [10, 55, 100][step];
  return (
    <div className="fixed inset-0 z-[500] bg-[#0e2233]/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12283c] text-[#f2efe6] w-full max-w-2xl border border-white/10 rounded-2xl p-8 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl font-black hover:bg-[#e62b2b] hover:border-[#e62b2b] transition-colors">×</button>
        <span className="chip-mono border-0 bg-[#e62b2b] text-white">F5 · VERIFIKASI DUA ARAH</span>
        <h3 className="text-2xl md:text-3xl font-black tracking-tight mt-3 mb-6">Verifikasi Projek</h3>
        <p className="label-mono mb-2">Pilih Projek</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {PROJECTS.map((pr, i) => (
            <button key={i} onClick={() => { setProj(i); setStep(0); }} className={`rounded-full px-4 py-2 text-[10px] font-mono font-bold border transition-colors ${proj === i ? 'bg-[#e62b2b] text-white border-[#e62b2b]' : 'border-white/20 hover:border-white/60'}`}>
              {pr.t}
            </button>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>PROGRES VERIFIKASI</span><span className="text-[#e62b2b]">{pct}%</span></div>
        <div className="h-2 rounded-full bg-white/10 mb-6 overflow-hidden"><div className="h-full rounded-full bg-[#e62b2b] transition-all duration-700" style={{ width: `${pct}%` }} /></div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={i} className={`rounded-xl border p-3 text-center transition-colors ${step > i ? 'border-[#c9ecd9] bg-[#c9ecd9] text-[#12283c]' : step === i ? 'border-[#e62b2b] bg-[#e62b2b]/10' : 'border-white/10 opacity-50'}`}>
              <p className="text-lg font-black">{s.n}</p>
              <p className="font-mono text-[8px] font-bold leading-tight">{s.l}</p>
            </div>
          ))}
        </div>
        {step < 2 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onClick={() => setStep(1)} disabled={step > 0} className={`btn-pill ${step === 0 ? 'btn-red' : 'border border-[#c9ecd9]/40 text-[#c9ecd9] cursor-default'}`}>
              {step === 0 ? '06 · Talenta: Tandai Selesai' : '✓ Talenta selesai'}
            </button>
            <button onClick={() => setStep(2)} disabled={step < 1} className={`btn-pill ${step === 1 ? 'bg-[#c9ecd9] text-[#12283c] hover:bg-white' : 'border border-white/10 opacity-40 cursor-not-allowed'}`}>
              07 · Komunitas: Benarkan
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-[#c9ecd9] text-[#12283c] p-6 text-center">
            <p className="text-xl font-black">✓ SELESAI DIVERIFIKASI</p>
            <p className="font-mono text-[10px] mt-1">REPUTASI {p.talent.toUpperCase()} +1 · TESTIMONI TERCATAT</p>
          </div>
        )}
        <p className="font-mono text-[10px] opacity-50 mt-4">{step < 2 ? 'STATUS MENGGANTUNG — REPUTASI TIDAK BERUBAH SAMPAI KEDUA PIHAK KONFIRMASI.' : ''}</p>
        {step === 2 && <button onClick={() => setStep(0)} className="mt-2 font-mono text-[10px] font-bold underline hover:text-[#e62b2b] transition-colors">↺ Ulangi simulasi</button>}
      </div>
    </div>
  );
}