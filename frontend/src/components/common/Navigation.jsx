import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Navigation({ currentPage, navigateTo, goToSection, menuOpen, setMenuOpen, user, onLogout, onAsk, theme = 'dark' }) {

  const [askInput, setAskInput] = useState('');
  const overlayRef = useRef(null);
  const bloomRef = useRef(null);
  const closeRef = useRef(null);
  const markRef = useRef(null);
  const btnRef = useRef(null);
  const hiddenRef = useRef(false);
  const tlRef = useRef(null);

  /* ===== WORDMARK: masuk saat load, sembunyi saat scroll ===== */
  useEffect(() => {
    hiddenRef.current = false;
    gsap.fromTo(markRef.current, { yPercent: 110 }, { yPercent: 0, duration: 0.7, delay: 0.15, ease: 'power3.out' });
    gsap.fromTo(btnRef.current, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.55, delay: 0.3, ease: 'back.out(1.7)' });
  }, [currentPage]);

  useEffect(() => {
    const onScroll = () => {
      const shouldHide = window.scrollY > 40;
      if (shouldHide === hiddenRef.current) return;
      hiddenRef.current = shouldHide;
      if (shouldHide) gsap.to(markRef.current, { yPercent: -110, duration: 0.4, ease: 'power3.in' });
      else gsap.to(markRef.current, { yPercent: 0, duration: 0.5, ease: 'power3.out' });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ===== MENU: KOREOGRAFI SINEMATIK ALA VIDEO ===== */
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    tlRef.current?.kill();

    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      const tl = gsap.timeline();
      tl
        /* 1) overlay muncul instan */
        .set(overlay, { autoAlpha: 1 })
        /* 2) red bloom naik dari bawah */
        .fromTo(bloomRef.current, { opacity: 0, yPercent: 35 }, { opacity: 1, yPercent: 0, duration: 1, ease: 'power3.out' }, 0)
        /* 3) close button memutar masuk (seolah burger morph jadi X) */
        .fromTo(closeRef.current, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.7)' }, 0.1)
        /* 4) logo + label kiri */
        .fromTo('.menu-logo', { y: -18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, 0.15)
        /* 5) link ter-reveal dari dalam mask, berjenjang */
        .fromTo('.menu-link-inner', { yPercent: 115 }, { yPercent: 0, duration: 0.75, stagger: 0.06, ease: 'power4.out' }, 0.2)
        /* 6) judul raksasa kanan */
        .fromTo('.ask-title', { y: 56, autoAlpha: 0, scale: 0.94 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.85, ease: 'power3.out' }, 0.35)
        /* 7) input tanya */
        .fromTo('.ask-form', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, 0.5)
        /* 8) kartu promo kiri */
        .fromTo('.menu-card', { y: 34, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, 0.6)
        /* 9) label mono + pills saran */
        .fromTo('.ask-label', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.62)
        .fromTo('.ask-pill', { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out' }, 0.68);
      tlRef.current = tl;
    } else {
      document.body.style.overflow = '';
      const tl = gsap.timeline({ onComplete: () => gsap.set(overlay, { autoAlpha: 0 }) });
      tl
        /* semua tersapu keluar dulu */
        .to('.menu-link-inner', { yPercent: 115, duration: 0.4, stagger: 0.035, ease: 'power3.in' }, 0)
        .to(['.ask-title', '.ask-form', '.ask-label', '.ask-pill', '.menu-card', '.menu-logo'], { autoAlpha: 0, y: 24, duration: 0.32, ease: 'power2.in' }, 0)
        .to(closeRef.current, { scale: 0, rotation: 90, duration: 0.32, ease: 'power2.in' }, 0)
        /* bloom merah surut */
        .to(bloomRef.current, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 0.08)
        /* baru overlay menghilang */
        .to(overlay, { autoAlpha: 0, duration: 0.35, ease: 'power2.inOut' }, 0.4);
      tlRef.current = tl;
    }
    return () => tlRef.current?.kill();
  }, [menuOpen]);

  const go = (fn) => { setMenuOpen(false); setTimeout(fn, 250); };

  const LINKS = [
    { l: 'Cara Kerja', fn: () => { navigateTo('home'); setTimeout(() => goToSection('alur'), 600); } },
    { l: 'Tentang Kami', fn: () => navigateTo('tentang') },
    { l: user ? 'Dashboard' : 'Masuk / Daftar', fn: () => navigateTo('dashboard') },
  ];
  const SUGGEST = [
    'Cari tahu apakah kami cocok untuk Anda.',
    'Apa yang bisa kami bantu bangun?',
    'Tunjukkan proyek di sektor saya...',
    'Siapa saja tim di balik SUSI?',
  ];

  return (
    <>
      {/* ===== HEADER TRANSPARAN ===== */}
      <header className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-10 py-5 flex items-start justify-between pointer-events-none">
        <button
          onClick={() => go(() => navigateTo('home'))}
          className="pointer-events-auto text-left leading-[0.9] font-black tracking-tight text-xl md:text-2xl"
        >
          <span className="block overflow-hidden py-0.5">
            <span ref={markRef} className={`block will-change-transform ${theme === 'light' ? 'text-[#12283c]' : 'text-[#f2efe6]'}`}>
              SUSI<br />Community<span className="text-[#e62b2b]">.</span>
            </span>
          </span>
        </button>

        {/* BURGER: garis "menari" saat hover */}
        <button
          ref={btnRef}
          onClick={() => setMenuOpen(true)}
          aria-label="Buka menu"
          className="group pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#e62b2b] hover:bg-[#12283c] active:scale-90 text-white flex flex-col items-center justify-center gap-[5px] transition-colors duration-300 shadow-[0_0_30px_rgba(230,43,43,.35)]"
        >
          <span className="block h-[2px] w-5 bg-white transition-all duration-300 group-hover:w-3.5" />
          <span className="block h-[2px] w-5 bg-white transition-all duration-300 delay-75 group-hover:w-5" />
          <span className="block h-[2px] w-5 bg-white transition-all duration-300 delay-100 group-hover:w-2.5" />
        </button>
      </header>

      {/* ===== OVERLAY MENU ===== */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[200] invisible opacity-0 overflow-hidden"
        style={{ background: 'linear-gradient(165deg,#0e2233 0%,#12283c 55%,#2a0d12 100%)' }}
      >
        {/* Red bloom yang naik dari bawah */}
        <div
          ref={bloomRef}
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(120% 90% at 50% 108%, #c2232b 0%, #8f1a20 40%, rgba(143,26,32,0) 78%)', opacity: 0 }}
        />

        {/* Close: morph dari posisi burger */}
        <button
          ref={closeRef}
          onClick={() => setMenuOpen(false)}
          aria-label="Tutup menu"
          className="absolute top-6 right-6 z-20 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#f2efe6] text-[#12283c] flex items-center justify-center hover:rotate-90 transition-transform duration-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="relative z-10 w-full h-full grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[400px_1fr] overflow-y-auto">
          {/* KOLOM KIRI */}
          <div className="p-8 md:p-10 md:border-r border-white/10 flex flex-col">
            <div className="menu-logo mb-8">
              <p className="font-mono text-[10px] font-bold tracking-[0.35em] text-[#f2efe6]/50 mt-5">JELAJAH</p>
            </div>

            <nav className="flex flex-col gap-3 md:gap-4">
              {LINKS.map((x, i) => (
                <button key={i} onClick={() => go(x.fn)} className="menu-link group text-left">
                  <span className="block overflow-hidden py-0.5">
                    <span className="menu-link-inner block relative text-2xl md:text-3xl font-black tracking-tight text-[#f2efe6] group-hover:text-white transition-colors">
                      {x.l}
                      <span className="absolute left-0 -bottom-1 h-[3px] w-full bg-[#e62b2b] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out" />
                    </span>
                  </span>
                </button>
              ))}
              {user && (
                <button onClick={() => go(onLogout)} className="menu-link text-left overflow-hidden">
                  <span className="menu-link-inner block text-sm font-mono font-bold text-[#f2efe6]/50 hover:text-[#f2efe6] mt-3 transition-colors">
                    KELUAR AKUN →
                  </span>
                </button>
              )}
            </nav>

            <div className="menu-card mt-auto pt-10">
              <div className="rounded-lg bg-white/5 border border-white/10 p-6 max-w-[280px]">
                <p className="text-[#f2efe6] font-bold leading-snug">Kami adalah solusi digital komunitas anda.</p>
                <button
                  onClick={() => go(() => navigateTo('tentang'))}
                  className="mt-4 bg-[#e62b2b] text-white text-xs font-bold px-5 py-3 rounded hover:bg-[#c2232b] transition-colors"
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="menu-right p-8 md:p-14 flex flex-col items-center justify-center text-center">
            <h2 className="ask-title text-5xl md:text-7xl lg:text-8xl font-black text-[#e62b2b] tracking-tight leading-[0.9]">Tanya SUSI</h2>

            <form
              onSubmit={(e) => { e.preventDefault(); if (!askInput.trim()) return; setMenuOpen(false); onAsk(askInput); setAskInput(''); }}
              className="ask-form mt-8 w-full max-w-xl flex items-center gap-2 rounded-full bg-[#f2efe6] pl-6 pr-2 py-2"
            >
              <input
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                className="flex-1 bg-transparent text-[#12283c] placeholder-[#12283c]/45 text-sm md:text-base outline-none"
                placeholder="Tanyakan apa saja..."
              />
              <button type="submit" className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#e62b2b] text-white flex items-center justify-center hover:bg-[#12283c] transition-colors" aria-label="Kirim">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            </form>

            <p className="ask-label mt-10 font-mono text-[10px] md:text-xs font-bold tracking-[0.3em] text-[#f2efe6]/60">
              BELUM TAHU MULAI DARI MANA? COBA SALAH SATU INI:
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {SUGGEST.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setMenuOpen(false); onAsk(s); }}
                  className="ask-pill rounded-full bg-white/5 border border-white/10 px-6 py-4 text-sm text-[#f2efe6]/85 hover:bg-white/10 hover:border-white/25 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}