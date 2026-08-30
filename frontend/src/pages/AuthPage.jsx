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
  const active = AUTH_ROLES.find((r) => r.id === role);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.form-anim', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out' });
      gsap.fromTo('.role-display', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [mode, role]);

  useEffect(() => {
    gsap.fromTo('.form-anim', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out' });
    gsap.fromTo('.role-display', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
  }, [mode, role]);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const mail = email.trim().toLowerCase();

    // ===== DAFTAR: pilih peran, akun disimpan =====
    if (mode === 'register') {
      const acc = { email: mail, role, name: name || active.fallback };
      try {
        const stored = JSON.parse(localStorage.getItem('susi_accounts') || '[]');
        localStorage.setItem('susi_accounts', JSON.stringify([...stored.filter((a) => a.email !== mail), acc]));
      } catch (_) { }
      onLogin({ role: acc.role, name: acc.name });
      return;
    }

    // ===== MASUK: peran dibaca otomatis dari akun terdaftar =====
    const acc = loadAccounts().find((a) => a.email === mail);
    if (!acc) {
      setError('EMAIL BELUM TERDAFTAR, SILAHKAN DAFTAR DULU.');
      return;
    }
    onLogin({ role: acc.role, name: acc.name });
  };

  const inputCls = 'w-full border-b-2 border-black/20 bg-transparent p-3 text-sm font-medium outline-none focus:border-[#FF5733] transition-colors placeholder:text-black/30';

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-black">
      <div className="max-w-[1440px] mx-auto px-4 md:px-12 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 border-2 border-black min-h-[calc(100vh-8rem)]">

          {/* PANEL KIRI: HITAM */}
          <div className="lg:col-span-5 bg-black text-white p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 border-2 border-[#FF5733]/40" />
            <div className="absolute bottom-8 right-8 w-10 h-10 bg-[#FF5733]" />
            <div className="relative z-10">
              <button onClick={goToHome} className="auth-fade text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#FF5733] transition-all">
                ← Kembali ke beranda
              </button>
            </div>
            <div className="relative z-10 my-16">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85]">
                <span className="block overflow-hidden"><span className="auth-line block">{mode === 'login' ? 'MASUK.' : 'DAFTAR.'}</span></span>
                <span className="block overflow-hidden"><span className="auth-line block text-white/20">SUSI.</span></span>
              </h1>
            </div>
            <div className="relative z-10 border-t-2 border-white/20 pt-6">
              {mode === 'register' ? (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 mb-3">Peran dipilih</p>
                  <div key={role} className="role-display flex items-end gap-5">
                    <span className="text-6xl lg:text-7xl font-black text-[#FF5733] leading-none">{active.num}</span>
                    <div>
                      <p className="text-2xl font-black uppercase tracking-tight">{active.label}</p>
                      <p className="text-xs opacity-60 mt-2 max-w-xs leading-relaxed">{active.desc}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div key="login" className="role-display">

                </div>
              )}
            </div>
          </div>

          {/* PANEL KANAN: FORM */}
          <div className="lg:col-span-7 bg-white p-10 lg:p-14">
            <div className="form-anim grid grid-cols-2 border-2 border-black mb-10">
              <button onClick={() => { setMode('login'); setError(''); }} className={`py-4 text-xs font-black uppercase tracking-[0.25em] transition-colors ${mode === 'login' ? 'bg-black text-white' : 'bg-white hover:bg-black/5'}`}>
                Masuk
              </button>
              <button onClick={() => { setMode('register'); setError(''); }} className={`py-4 text-xs font-black uppercase tracking-[0.25em] border-l-2 border-black transition-colors ${mode === 'register' ? 'bg-black text-white' : 'bg-white hover:bg-black/5'}`}>
                Daftar
              </button>
            </div>

            <form onSubmit={submit} className="space-y-8">
              {mode === 'register' && (
                <div className="form-anim">
                  <label className="text-xs font-black uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nama kamu" required />
                </div>
              )}

              <div className="form-anim">
                <label className="text-xs font-black uppercase tracking-widest mb-2 block">Email</label>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className={inputCls} placeholder="nama@email.com" required />
              </div>

              <div className="form-anim">
                <label className="text-xs font-black uppercase tracking-widest mb-2 block">Kata Sandi</label>
                <div className="flex items-center">
                  <input type={showPass ? 'text' : 'password'} className={inputCls} placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="shrink-0 border-2 border-black px-3 py-2 text-[10px] font-mono font-bold hover:bg-black hover:text-white transition-colors">
                    {showPass ? 'TUTUP' : 'LIHAT'}
                  </button>
                </div>
              </div>

              {/* PILIHAN PERAN — HANYA MUNCUL SAAT DAFTAR */}
              {mode === 'register' && (
                <>
                  <div className="form-anim">
                    <p className="text-xs font-black uppercase tracking-widest mb-3">Daftar sebagai</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-black border-2 border-black">
                      {PUBLIC_ROLES.map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => setRole(r.id)}
                          className={`p-4 sm:p-5 text-left transition-colors duration-300 ${role === r.id ? 'bg-[#FF5733] text-white' : 'bg-white hover:bg-black hover:text-white'}`}
                        >
                          <span className="text-[10px] font-mono font-bold block mb-1 sm:mb-2">{r.num}</span>
                          <span className="font-black uppercase tracking-wider text-sm leading-tight">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-anim">
                    <label className="text-xs font-black uppercase tracking-widest mb-2 block">{active.field}</label>
                    <input value={extra} onChange={(e) => setExtra(e.target.value)} className={inputCls} placeholder={active.ph} />
                  </div>
                </>
              )}

              {error && (
                <p className="form-anim text-[10px] font-mono font-bold text-[#FF5733]">⚠ {error}</p>
              )}

              <button type="submit" className="form-anim group w-full bg-black text-white py-5 text-sm uppercase tracking-wider font-black hover:bg-[#FF5733] transition-colors flex items-center justify-center gap-3">
                {mode === 'login' ? 'Masuk' : 'Buat Akun'}
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </button>



              {/* LINK ADMIN (opsional, hanya jika goAdmin disediakan) */}
              {goAdmin && (
                <>
                  <div className="form-anim flex items-center gap-3">
                    <div className="h-px bg-black/10 flex-1" />
                    <span className="text-[9px] font-mono opacity-40">ATAU</span>
                    <div className="h-px bg-black/10 flex-1" />
                  </div>
                  <button
                    type="button"
                    onClick={goAdmin}
                    className="form-anim w-full border-2 border-black py-3.5 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    Masuk sebagai Admin →
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
