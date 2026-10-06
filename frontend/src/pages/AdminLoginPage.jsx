import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router';
import gsap from 'gsap';
import { useAuth } from '../context/authContext';
import { useTransitionNavigate } from '../context/transitionContext';
import FullPageLoader from '../components/ui/FullPageLoader';

// Login admin memakai /auth/login yang sama. Halaman ini hanya pintu masuk khusus:
// keamanan sebenarnya ditegakkan backend (requireRole('admin') di setiap endpoint admin).
export default function AdminLoginPage() {
  const { status, user, login, logout } = useAuth();
  const go = useTransitionNavigate();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef(null);

  const ready = status !== 'loading';
  useEffect(() => {
    if (!ready) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo('.adm-fade', { y: 25, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [ready]);

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated' && user?.role === 'admin' && !submitting) return <Navigate to="/dashboard" replace />;

  const shake = () => gsap.fromTo('.adm-card', { x: 0 }, { x: 12, duration: 0.06, repeat: 5, yoyo: true, clearProps: 'x' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      // Sesi peran lain ditutup dulu agar cookie refresh lama dicabut.
      if (status === 'authenticated') await logout();
      const loggedIn = await login(email.trim(), pass);
      if (loggedIn.role !== 'admin') {
        await logout();
        setError('AKUN INI BUKAN ADMIN — AREA INI KHUSUS PENGELOLA SUSI.');
        shake();
        setSubmitting(false);
        return;
      }
      go('/dashboard', { replace: true });
    } catch (err) {
      setError((err.message || 'Gagal masuk').toUpperCase());
      shake();
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full border-b-2 border-white/20 bg-transparent p-3 text-sm font-medium outline-none focus:border-[#FF5733] transition-colors placeholder:text-white/30';

  return (
    <div ref={rootRef} className="min-h-dvh bg-black text-white flex items-center justify-center px-6 py-16 relative overflow-hidden">
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
          onClick={() => go('/masuk')}
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

        {status === 'authenticated' && user?.role !== 'admin' && (
          <p className="adm-fade mb-6 border border-white/20 p-3 text-[10px] font-mono font-bold opacity-80">
            ANDA SEDANG MASUK SEBAGAI {user.name?.toUpperCase()}. MASUK DENGAN AKUN ADMIN AKAN MENUTUP SESI INI.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="adm-fade">
            <label htmlFor="adm-email" className="text-[10px] font-black uppercase tracking-widest mb-2 block">Email</label>
            <input
              id="adm-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className={inputCls}
              placeholder="admin@susi.test"
              required
            />
          </div>

          <div className="adm-fade">
            <label htmlFor="adm-pass" className="text-[10px] font-black uppercase tracking-widest mb-2 block">Kata Sandi</label>
            <div className="flex items-center">
              <input
                id="adm-pass"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={pass}
                onChange={(e) => { setPass(e.target.value); setError(''); }}
                className={`${inputCls} ${error ? 'border-[#FF5733]' : ''}`}
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
            {error && <p role="alert" className="text-[10px] font-mono font-bold text-[#FF5733] mt-2">⚠ {error}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`adm-fade w-full py-4 text-sm uppercase tracking-wider font-black transition-colors flex items-center justify-center gap-3 ${
              submitting ? 'bg-white/10 text-white/30 cursor-wait' : 'bg-[#FF5733] text-white hover:bg-white hover:text-black'
            }`}
          >
            {submitting ? 'Memeriksa…' : 'Masuk →'}
          </button>
        </form>
      </div>
    </div>
  );
}
