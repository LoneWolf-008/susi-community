import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import gsap from 'gsap';
import { AUTH_ROLES } from '../data/constants';
import { useAuth } from '../context/authContext';
import { useTransitionNavigate } from '../context/transitionContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const go = useTransitionNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('requester');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [extra, setExtra] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef(null);
  const activeRole = AUTH_ROLES.find((r) => r.id === role);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.form-anim', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
      gsap.fromTo('.role-display', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    }, rootRef);

    // Pintasan admin: Ctrl + Shift + A
    const handleSecretKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        go('/admin');
      }
    };
    window.addEventListener('keydown', handleSecretKey);

    return () => {
      ctx.revert();
      window.removeEventListener('keydown', handleSecretKey);
    };
  }, [mode, role, go]);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setFieldErrors({});
  };

  const clearField = (field) => {
    setError('');
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f));
  };

  // Aturan sama dengan backend (validators/schemas.js) agar pengguna tahu sebelum mengirim.
  const validate = () => {
    const errs = {};
    if (mode === 'register') {
      if (!name.trim()) errs.name = 'Nama wajib diisi';
      if (password.length < 10) errs.password = 'Kata sandi minimal 10 karakter';
      if (password.length > 72) errs.password = 'Kata sandi maksimal 72 karakter';
    } else if (!password) {
      errs.password = 'Kata sandi wajib diisi';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register({
          email: email.trim(),
          password,
          role,
          name: name.trim(),
          extra_info: extra.trim() || undefined,
        });
      } else {
        await login(email.trim(), password);
      }
      go(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      // Pesan backend sudah berbahasa Indonesia: "Email sudah terdaftar",
      // "Email atau password salah", "Akun Anda ditangguhkan", batas percobaan, dll.
      setError(err.message || 'Gagal masuk. Coba lagi.');
      if (err.details) {
        const byField = {};
        for (const d of err.details) {
          const key = d.field === 'extra_info' ? 'extra' : d.field;
          if (key && !byField[key]) byField[key] = d.message;
        }
        setFieldErrors(byField);
      }
      setSubmitting(false);
    }
  };

  const fieldError = (field) => fieldErrors[field] && (
    <p className="mt-2 font-mono text-[10px] font-bold text-[#e62b2b]">{fieldErrors[field]}</p>
  );

  return (
    <div ref={rootRef} className="min-h-dvh bg-[#0e2233] text-[#f2efe6] flex items-center justify-center px-4 py-16"
      style={{ background: 'radial-gradient(90% 90% at 50% 10%, #1b3a5c 0%, #0e2233 60%, #0b1b2b 100%)' }}>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        {/* PANEL KIRI (GRADIEN NAVY→MAROON) */}
        <div className="p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#12283c 0%,#12283c 45%,#7a1a1f 100%)' }}>
          <div className="relative z-10">
            <button onClick={() => go('/')} className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#e62b2b] transition-all">← Kembali ke beranda</button>
          </div>
          <div className="relative z-10 my-14">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85]">
              <span className="block">{mode === 'login' ? 'MASUK.' : 'DAFTAR.'}</span>
              <span className="block text-white/20">SUSI.</span>
            </h1>
          </div>
          <div className="relative z-10 border-t border-white/15 pt-6 hidden lg:block">
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
            <button type="button" onClick={() => switchMode('login')} className={`flex-1 rounded-full py-3 text-xs font-black uppercase tracking-[0.25em] transition-colors ${mode === 'login' ? 'bg-[#12283c] text-[#f2efe6]' : 'hover:bg-[#12283c]/5'}`}>Masuk</button>
            <button type="button" onClick={() => switchMode('register')} className={`flex-1 rounded-full py-3 text-xs font-black uppercase tracking-[0.25em] transition-colors ${mode === 'register' ? 'bg-[#12283c] text-[#f2efe6]' : 'hover:bg-[#12283c]/5'}`}>Daftar</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-7">
            {mode === 'register' && (
              <div className="form-anim">
                <label className="field-label" htmlFor="auth-name">Nama Lengkap</label>
                <input id="auth-name" value={name} onChange={(e) => { setName(e.target.value); clearField('name'); }} className="input-line" placeholder="Nama kamu" aria-invalid={!!fieldErrors.name} required />
                {fieldError('name')}
              </div>
            )}
            <div className="form-anim">
              <label className="field-label" htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField('email'); }} className="input-line" placeholder="nama@email.com" aria-invalid={!!fieldErrors.email} required />
              {fieldError('email')}
            </div>
            <div className="form-anim">
              <label className="field-label" htmlFor="auth-password">Kata Sandi</label>
              <div className="flex items-center gap-3">
                <input
                  id="auth-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearField('password'); }}
                  className="input-line"
                  placeholder="••••••••"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={mode === 'register' ? 'auth-password-hint' : undefined}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="chip-mono shrink-0 hover:text-[#e62b2b] transition-colors">{showPass ? 'TUTUP' : 'LIHAT'}</button>
              </div>
              {fieldError('password') || (mode === 'register' && (
                <p id="auth-password-hint" className="mt-2 font-mono text-[10px] opacity-50">MINIMAL 10 KARAKTER</p>
              ))}
            </div>
            {mode === 'register' && activeRole && (
              <>
                <div className="form-anim">
                  <p className="field-label">Daftar sebagai</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AUTH_ROLES.map((r) => (
                      <button type="button" key={r.id} onClick={() => setRole(r.id)} className={`rounded-xl border p-4 text-left transition-colors ${role === r.id ? 'bg-[#e62b2b] text-white border-[#e62b2b]' : 'border-[#12283c]/20 hover:border-[#12283c]'}`}>
                        <span className="font-mono text-[10px] font-bold block mb-1">{r.num}</span>
                        <span className="font-black uppercase tracking-wider text-sm leading-tight">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-anim">
                  <label className="field-label" htmlFor="auth-extra">{activeRole.field}</label>
                  <input id="auth-extra" value={extra} onChange={(e) => { setExtra(e.target.value); clearField('extra'); }} className="input-line" placeholder={activeRole.ph} maxLength={150} />
                  {fieldError('extra')}
                </div>
                {role === 'talent' && (
                  <p className="form-anim rounded-lg bg-[#12283c]/5 p-3 text-xs leading-relaxed text-[#12283c]/75">
                    Profil ringkas Anda (nama, level, keahlian, proyek selesai) akan muncul di rekomendasi untuk komunitas yang
                    kebutuhannya cocok, dan mereka bisa mengundang Anda melamar. Bisa dimatikan kapan saja di Pengaturan → Privasi.
                  </p>
                )}
              </>
            )}
            {error && <p role="alert" className="form-anim font-mono text-[10px] font-bold text-[#e62b2b]">⚠ {error}</p>}
            <button type="submit" disabled={submitting} className="form-anim btn-pill btn-navy w-full disabled:opacity-60 disabled:cursor-wait">
              {submitting ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Buat Akun'} <span>→</span>
            </button>
          </form>
        </div>
        {/* MOBILE: Peran dipilih – muncul setelah form */}
        {mode === 'register' && activeRole && (
          <div className="lg:hidden p-8 border-t border-white/10" style={{ background: 'linear-gradient(160deg,#12283c 0%,#12283c 45%,#7a1a1f 100%)' }}>
            <p className="label-mono mb-3">Peran dipilih</p>
            <div key={role} className="role-display flex items-end gap-5">
              <span className="text-5xl font-black text-[#e62b2b] leading-none">{activeRole.num}</span>
              <div>
                <p className="text-xl font-black uppercase tracking-tight">{activeRole.label}</p>
                <p className="text-xs opacity-60 mt-2 max-w-xs leading-relaxed">{activeRole.desc}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
