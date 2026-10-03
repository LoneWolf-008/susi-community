import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { AUTH_ROLES, loadAccounts } from '../data/constants';

export default function AuthPage({ onLogin, goToHome, goAdmin }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('requester');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [extra, setExtra] = useState('');
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const PUBLIC_ROLES = AUTH_ROLES.filter((r) => r.id !== 'admin');
  const activeRole = AUTH_ROLES.find((r) => r.id === role);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.form-anim', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
      gsap.fromTo('.role-display', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    }, rootRef);

    // Shortcut rahasia admin: Tekan Ctrl + Shift + A
    const handleSecretKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (goAdmin) goAdmin();
      }
    };
    window.addEventListener('keydown', handleSecretKey);

    return () => {
      ctx.revert();
      window.removeEventListener('keydown', handleSecretKey);
    };
  }, [mode, role, goAdmin]);
  const handleSubmit = (e) => {
    e.preventDefault(); setError('');
    const mail = email.trim().toLowerCase();
    if (mode === 'register') {
      const acc = { email: mail, role, name: name || activeRole.fallback };
      try {
        const stored = JSON.parse(localStorage.getItem('susi_accounts') || '[]');
        localStorage.setItem('susi_accounts', JSON.stringify([...stored.filter((a) => a.email !== mail), acc]));
      } catch (_) {}
      onLogin({ role: acc.role, name: acc.name }); return;
    }
    const acc = loadAccounts().find((a) => a.email === mail);
    if (!acc) { setError('EMAIL BELUM TERDAFTAR, SILAHKAN DAFTAR DULU.'); return; }
    onLogin({ role: acc.role, name: acc.name });
  };
  return (
    <div ref={rootRef} className="min-h-screen bg-[#0e2233] text-[#f2efe6] flex items-center justify-center px-4 py-16"
      style={{ background: 'radial-gradient(90% 90% at 50% 10%, #1b3a5c 0%, #0e2233 60%, #0b1b2b 100%)' }}>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        {/* PANEL KIRI (GRADIEN NAVY→MAROON) */}
        <div className="p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#12283c 0%,#12283c 45%,#7a1a1f 100%)' }}>
          <div className="relative z-10">
            <button onClick={goToHome} className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#e62b2b] transition-all">← Kembali ke beranda</button>
          </div>
          <div className="relative z-10 my-14">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85]">
              <span className="block">{mode === 'login' ? 'MASUK.' : 'DAFTAR.'}</span>
              <span className="block text-white/20">SUSI.</span>
            </h1>
          </div>
          <div className="relative z-10 border-t border-white/15 pt-6">
            {mode === 'register' && activeRole && (
              <>
                <p className="label-mono mb-3">Peran dipilih</p>
                <div key={role} className="role-display flex items-end gap-5">
                  <span className="text-6xl lg:text-7xl font-black text-[#e62b2b] leading-none">{activeRole.num}</span>
                  <div>
                    <p className="text-2xl font-black uppercase tracking-tight">{activeRole.label}</p>
                    <p className="text-xs opacity-60 mt-2 max-w-xs leading-relaxed">{activeRole.desc}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* PANEL KANAN (KREM) */}
        <div className="bg-[#f2efe6] text-[#12283c] p-10 lg:p-14">
          <div className="form-anim flex rounded-full bg-[#12283c]/10 p-1 mb-9">
            <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`flex-1 rounded-full py-3 text-xs font-black uppercase tracking-[0.25em] transition-colors ${mode === 'login' ? 'bg-[#12283c] text-[#f2efe6]' : 'hover:bg-[#12283c]/5'}`}>Masuk</button>
            <button type="button" onClick={() => { setMode('register'); setError(''); }} className={`flex-1 rounded-full py-3 text-xs font-black uppercase tracking-[0.25em] transition-colors ${mode === 'register' ? 'bg-[#12283c] text-[#f2efe6]' : 'hover:bg-[#12283c]/5'}`}>Daftar</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-7">
            {mode === 'register' && (
              <div className="form-anim">
                <label className="field-label">Nama Lengkap</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-line" placeholder="Nama kamu" required />
              </div>
            )}
            <div className="form-anim">
              <label className="field-label">Email</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className="input-line" placeholder="nama@email.com" required />
            </div>
            <div className="form-anim">
              <label className="field-label">Kata Sandi</label>
              <div className="flex items-center gap-3">
                <input type={showPass ? 'text' : 'password'} className="input-line" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="chip-mono shrink-0 hover:text-[#e62b2b] transition-colors">{showPass ? 'TUTUP' : 'LIHAT'}</button>
              </div>
            </div>
            {mode === 'register' && activeRole && (
              <>
                <div className="form-anim">
                  <p className="field-label">Daftar sebagai</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PUBLIC_ROLES.map((r) => (
                      <button type="button" key={r.id} onClick={() => setRole(r.id)} className={`rounded-xl border p-4 text-left transition-colors ${role === r.id ? 'bg-[#e62b2b] text-white border-[#e62b2b]' : 'border-[#12283c]/20 hover:border-[#12283c]'}`}>
                        <span className="font-mono text-[10px] font-bold block mb-1">{r.num}</span>
                        <span className="font-black uppercase tracking-wider text-sm leading-tight">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-anim">
                  <label className="field-label">{activeRole.field}</label>
                  <input value={extra} onChange={(e) => setExtra(e.target.value)} className="input-line" placeholder={activeRole.ph} />
                </div>
              </>
            )}
            {error && <p className="form-anim font-mono text-[10px] font-bold text-[#e62b2b]">⚠ {error}</p>}
            <button type="submit" className="form-anim btn-pill btn-navy w-full">
              {mode === 'login' ? 'Masuk' : 'Buat Akun'} <span>→</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}