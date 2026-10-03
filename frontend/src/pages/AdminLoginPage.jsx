import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AdminLoginPage({ onLogin, goToAuth }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  // Kunci akses masuk khusus admin
  const ADMIN_CODE = 'SUSI2026';

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.adm-fade', { y: 25, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim().toUpperCase() !== ADMIN_CODE) {
      setError('KODE AKSES SALAH — AREA INI KHUSUS ADMIN.');
      // Efek getar kartu jika kode salah
      gsap.fromTo('.adm-card', { x: 0 }, { x: 12, duration: 0.06, repeat: 5, yoyo: true, clearProps: 'x' });
      return;
    }
    onLogin({ role: 'admin', name: 'Admin SUSI' });
  };

  const inputCls = 'w-full border-b-2 border-white/20 bg-transparent p-3 text-sm font-medium outline-none focus:border-[#FF5733] transition-colors placeholder:text-white/30';
  const isLocked = code.trim() === '';

  return (
    <div ref={rootRef} className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Background Grid & Elemen Geometris */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute -top-16 -left-16 w-64 h-64 border-2 border-[#FF5733]/40" />
      <div className="absolute bottom-10 right-10 w-12 h-12 bg-[#FF5733]" />

      <div className="adm-card w-full max-w-md border-2 border-white/20 p-8 md:p-10 relative z-10">
        <button
          onClick={goToAuth}
          className="adm-fade absolute -top-12 left-0 text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#FF5733] transition-all"
        >
          ← Kembali ke halaman masuk
        </button>

        <span className="adm-fade inline-block text-[9px] font-mono font-bold bg-[#FF5733] text-white px-2 py-1 mb-4">
          ⚠ ADMIN LOGIN PAGE
        </span>
        <h1 className="adm-fade text-5xl md:text-6xl font-black tracking-tighter leading-[0.85] mb-3">
          ADMIN.
        </h1>
        <p className="adm-fade text-xs opacity-60 leading-relaxed mb-8">
          Halaman khusus pengelola platform SUSI.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="adm-fade">
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="admin@susi.id"
              required
            />
          </div>

          <div className="adm-fade">
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Kata Sandi</label>
            <div className="flex items-center">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="shrink-0 border-2 border-white/30 px-3 py-2 text-[10px] font-mono font-bold hover:bg-white hover:text-black transition-colors"
              >
                {showPass ? 'TUTUP' : 'LIHAT'}
              </button>
            </div>
          </div>

          <div className="adm-fade">
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Kode Akses Internal</label>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              className={`${inputCls} ${error ? 'border-[#FF5733]' : ''}`}
              placeholder="Kode khusus tim SUSI"
              required
            />
            {error && <p className="text-[10px] font-mono font-bold text-[#FF5733] mt-2">⚠ {error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLocked}
            className={`adm-fade w-full py-4 text-sm uppercase tracking-wider font-black transition-colors flex items-center justify-center gap-3 ${
              isLocked ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-[#FF5733] text-white hover:bg-white hover:text-black'
            }`}
          >
            Masuk →
          </button>

          <p className="adm-fade text-[9px] font-mono opacity-40 text-center">
            DEMO: KODE AKSES = SUSI2026
          </p>
        </form>
      </div>
    </div>
  );
}