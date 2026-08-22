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
    <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl border-2 border-[#FF5733] p-8 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white transition-colors">×</button>
        <span className="text-[10px] font-mono font-bold text-[#FF5733]">F5 · VERIFIKASI DUA ARAH</span>
        <h3 className="text-2xl md:text-3xl font-black tracking-tight mt-1 mb-6">Verifikasi Projek</h3>

        <p className="text-[10px] font-black uppercase tracking-widest mb-2">Pilih Projek</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {PROJECTS.map((pr, i) => (
            <button key={i} onClick={() => { setProj(i); setStep(0); }} className={`px-3 py-2 text-[10px] font-mono font-bold border-2 transition-colors ${proj === i ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>
              {pr.t}
            </button>
          ))}
        </div>

        <div className="flex justify-between text-[10px] font-mono font-bold mb-2">
          <span>PROGRES VERIFIKASI</span>
          <span className="text-[#FF5733]">{pct}%</span>
        </div>
        <div className="h-3 border-2 border-black bg-white mb-6">
          <div className="h-full bg-[#FF5733] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={i} className={`border-2 p-3 text-center transition-colors ${step > i ? 'border-[#0E7C66] bg-[#0E7C66] text-white' : step === i ? 'border-[#FF5733] bg-[#FF5733]/10' : 'border-black/15 opacity-50'}`}>
              <p className="text-lg font-black">{s.n}</p>
              <p className="text-[8px] font-mono font-bold leading-tight">{s.l}</p>
            </div>
          ))}
        </div>

        {step < 2 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setStep(1)}
              disabled={step > 0}
              className={`py-4 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${step === 0 ? 'bg-black text-white border-black hover:bg-[#FF5733]' : 'border-[#0E7C66] text-[#0E7C66] cursor-default'}`}
            >
              {step === 0 ? '06 · Talenta: Tandai Selesai' : '✓ Talenta selesai'}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={step < 1}
              className={`py-4 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${step === 1 ? 'bg-[#0E7C66] text-white border-[#0E7C66] hover:bg-black' : 'border-black/15 opacity-40 cursor-not-allowed'}`}
            >
              07 · Komunitas: Benarkan
            </button>
          </div>
        ) : (
          <div className="border-4 border-[#0E7C66] text-[#0E7C66] p-6 text-center">
            <p className="text-xl font-black">✓ SELESAI DIVERIFIKASI</p>
            <p className="text-[10px] font-mono mt-1">REPUTASI {p.talent.toUpperCase()} +1 · TESTIMONI TERCATAT</p>
          </div>
        )}

        <p className="text-[10px] font-mono opacity-50 mt-4">
          {step < 2 ? 'STATUS MENGGANTUNG — REPUTASI TIDAK BERUBAH SAMPAI KEDUA PIHAK KONFIRMASI.' : ''}
        </p>
        {step === 2 && (
          <button onClick={() => setStep(0)} className="mt-2 text-[10px] font-mono font-bold underline hover:text-[#FF5733]">↺ Ulangi simulasi</button>
        )}
      </div>
    </div>
  );
}