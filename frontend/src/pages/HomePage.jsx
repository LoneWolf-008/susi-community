import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FlowSection from '../sections/FlowSection';
import StatsSection from '../sections/StatsSection';
import { api } from '../lib/api';
import photoTop from '../assets/photos/hero-top.jpg';
import photoLeft from '../assets/photos/hero-left.jpg';
import photoRight from '../assets/photos/hero-right.jpg';
import photoBottom from '../assets/photos/hero-bottom.jpg';
import { PUBLIC_SUGGESTIONS } from '../data/askSuggestions';

const VISIT_KEY = 'susi_visit_recorded';

// Foto Unsplash disimpan lokal agar landing tetap utuh tanpa internet (cadangan demo onsite).
const PHOTOS = { top: photoTop, left: photoLeft, right: photoRight, bottom: photoBottom };
// Saran yang dijamin terjawab basis pengetahuan Tanya SUSI (lihat data/askSuggestions.js).
const QUESTIONS = PUBLIC_SUGGESTIONS;

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const Dither = () => (
  <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: '240px 240px' }} />
);

export default function HomePage({ navigateTo, onAsk }) {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const [askInput, setAskInput] = useState('');

  // Catat kunjungan landing sekali per sesi browser (daily_stats). Penanda dipasang
  // sebelum request agar efek ganda StrictMode tidak mencatat dua kali.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(VISIT_KEY)) return;
      sessionStorage.setItem(VISIT_KEY, '1');
    } catch {
      // Storage diblokir (mode privat): tetap catat; server membatasi per IP.
    }
    api.post('/public/visit').catch(() => {});
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      /* ===== HERO TIMELINE ===== */
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .fromTo('.hero-badge', { autoAlpha: 0, y: -16, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7 })
        .fromTo('.hero-line', { yPercent: 115 }, { yPercent: 0, duration: 1.25, stagger: 0.12 }, 0.1)
        .fromTo('.hero-accent-line', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out', transformOrigin: 'center center' }, '-=0.5')
        .fromTo('.hero-dot', { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' }, '-=0.3')
        .fromTo('.hero-fade', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1 }, '-=0.6')
        .fromTo('.hero-scroll', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.3');

      /* Parallax heading saat scroll */
      gsap.to('.hero-parallax', {
        yPercent: -25,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 1.2 },
      });

      /* Glow merah berdenyut pelan di belakang "solusi digital" */
      gsap.to('.hero-glow', {
        opacity: 0.9,
        scale: 1.15,
        duration: 2.8,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });

      /* Foto melayang */
      gsap.fromTo('.fp', { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 1.3, stagger: 0.14, ease: 'power3.out', delay: 0.45 });
      gsap.utils.toArray('.fp').forEach((el, i) => {
        gsap.to(el, { y: i % 2 === 0 ? 14 : -14, duration: 3 + i * 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.8 });
      });

      /* Scroll indicator bounce */
      gsap.to('.scroll-arrow', { y: 8, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' });

      /* Reveal */
      gsap.utils.toArray('.sec-reveal').forEach((el) => {
        gsap.fromTo(el, { y: 42, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%' },
        });
      });
    }, rootRef);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="bg-[#0e2233] text-[#f2efe6]">
      {/* ===== 1. HERO — dengan 5 layer kedalaman ===== */}
      <section
        ref={heroRef}
        className="relative min-h-dvh flex items-center justify-center overflow-hidden px-6 pt-36 pb-44"
        style={{ background: 'radial-gradient(120% 90% at 50% 40%, #2a4d74 0%, #1b3a5c 45%, #12283c 75%, #0e2233 100%)' }}
      >
        {/* LAYER 1 — Vignette radial (fokus mata ke tengah) */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,10,20,0.6) 100%)',
        }} />

        {/* LAYER 2 — Grain halus untuk tekstur film */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{
          backgroundImage: NOISE, backgroundSize: '240px 240px',
        }} />

        {/* LAYER 3 — Glow merah besar di tengah (berdenyut pelan) */}
        <div
          className="hero-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: '80vw',
            height: '60vh',
            background: 'radial-gradient(circle, rgba(230,43,43,0.25) 0%, rgba(230,43,43,0) 65%)',
            opacity: 0.7,
            filter: 'blur(40px)',
          }}
        />

        {/* Foto melayang */}
        <div className="absolute top-[22%] md:top-24 left-4 md:left-1/2 md:-ml-[120px] w-[120px] md:w-[240px] h-[80px] md:h-[130px] rotate-[-3deg] opacity-60 md:opacity-100">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.top} alt="" className="w-full h-full object-cover" /></div>
        </div>
        <div className="hidden md:block absolute top-[30%] -left-8 w-[150px] h-[310px] rotate-[-4deg]">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.left} alt="" className="w-full h-full object-cover" /></div>
        </div>
        <div className="hidden md:block absolute top-[32%] -right-6 w-[190px] h-[230px] rotate-[3deg]">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.right} alt="" className="w-full h-full object-cover" /></div>
        </div>
        <div className="absolute bottom-[18%] md:-bottom-16 right-3 md:right-auto md:left-1/2 md:-ml-[190px] w-[130px] md:w-[380px] h-[90px] md:h-[220px] rotate-[3deg] opacity-60 md:opacity-100">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.bottom} alt="" className="w-full h-full object-cover" /></div>
        </div>

        {/* KONTEN UTAMA — parallax saat scroll */}
        <div className="hero-parallax relative z-10 max-w-5xl mx-auto text-center">
          {/* HEADING — dengan glow text-shadow pada kata merah */}
          <h1 className="font-black tracking-tight leading-[1.08] text-[clamp(2.6rem,7.5vw,7.2rem)] text-[#f5f2e8]">
            <span className="block overflow-hidden py-1 -my-1.5">
              <span className="hero-line block">Kami adalah</span>
            </span>
            <span className="block overflow-hidden py-3 -my-1.5 relative">
              <span
                className="hero-line block relative text-[#e62b2b]"
                style={{
                  textShadow: `
                    0 0 30px rgba(230,43,43,0.5),
                    0 0 60px rgba(230,43,43,0.3),
                    0 0 100px rgba(230,43,43,0.2)
                  `,
                }}
              >
                solusi digital
              </span>
            </span>
            <span className="block overflow-hidden py-1 -my-1.5">
              <span className="hero-line block">komunitas anda.</span>
            </span>
          </h1>
        </div>

        {/* Scroll indicator — di bawah hero */}
        <div className="hero-scroll absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-[#f2efe6]/40">
          <p className="font-mono text-[9px] font-bold tracking-[0.4em]">SCROLL</p>
          <span className="scroll-arrow block w-[1px] h-8 bg-[#f2efe6]/40 relative">
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 border-b border-r border-[#f2efe6]/40 rotate-45" />
          </span>
        </div>
      </section>

      {/* ===== 2. DESKRIPSI ===== */}
      <section className="relative py-24 md:py-36 px-6 lg:px-12" style={{ background: 'linear-gradient(180deg, #0e2233 0%, #111f2e 45%, #1f1a28 100%)' }}>
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-start">
          <div className="md:col-span-4 sec-reveal">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#f2efe6] leading-[0.95]">
              Menjembatani <span className="text-[#e62b2b]">Kesenjangan</span> Digital.
            </h2>
          </div>
          <div className="md:col-span-8 sec-reveal md:border-l md:border-white/10 md:pl-10">
            <p className="text-lg md:text-2xl leading-relaxed text-[#f2efe6]/85 font-medium">
              SUSI menghubungkan komunitas lokal di Kota Bandung dengan talenta IT muda. Kami bekerja bersama untuk menembus kendala teknis, menemukan masalah yang benar-benar perlu diselesaikan, dan membangun solusi digital yang <span className="text-[#f2efe6] font-bold underline decoration-[#e62b2b] decoration-2 underline-offset-4">benar-benar dipakai</span> oleh masyarakat.
            </p>
          </div>
        </div>
      </section>

      {/* ===== 3. TANYA SUSI ===== */}
      <section id="tanya" className="relative overflow-hidden py-32 md:py-40 px-6" style={{ background: 'linear-gradient(180deg, #1f1a28 0%, #471119 22%, #7a1a1f 50%, #8f1a20 74%, #6d151b 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 55% at 50% 42%, rgba(230,43,43,0.28), rgba(230,43,43,0) 70%)' }} />
        <Dither />
        <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-[17vw] leading-none font-black text-[#e62b2b]/60">Tanya SUSI</span>
        <div className="sec-reveal relative z-10 max-w-2xl mx-auto rounded-2xl bg-[#12283c]/75 backdrop-blur-md p-6 md:p-8 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
          {QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => onAsk(q)} className="w-full mb-3 rounded-full bg-white/[0.06] border border-white/10 px-6 py-4 text-sm md:text-base text-[#f2efe6]/90 hover:bg-white/10 transition-colors text-left">{q}</button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (!askInput.trim()) return; onAsk(askInput); setAskInput(''); }} className="mt-5 flex items-center gap-2 rounded-full bg-[#f2efe6] pl-6 pr-2 py-2">
            <input value={askInput} onChange={(e) => setAskInput(e.target.value)} className="flex-1 bg-transparent text-[#12283c] placeholder-[#12283c]/45 text-sm md:text-base outline-none" placeholder="Tanyakan apa saja..." />
            <button type="submit" className="w-11 h-11 rounded-full bg-[#e62b2b] text-white flex items-center justify-center hover:bg-[#0e2233] transition-colors" aria-label="Kirim">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </form>
        </div>
      </section>

      {/* ===== BRIDGE 1 ===== */}
      <section className="relative h-48 md:h-64" style={{ background: 'linear-gradient(180deg, #6d151b 0%, #3c1220 35%, #1d1a29 68%, #0e2233 100%)' }}>
        <Dither />
      </section>

      {/* ===== 4. STATISTIK (data nyata dari /api/public/stats) ===== */}
      <StatsSection />

      {/* ===== BRIDGE 2 ===== */}
      <section className="relative h-56 md:h-72" style={{ background: 'linear-gradient(180deg, #0e2233 0%, #1a2a3a 22%, #35414b 45%, #6e6f68 68%, #b9b3a4 86%, #f2efe6 100%)' }}>
        <Dither />
      </section>

      {/* ===== 5. ALUR ===== */}
      <FlowSection navigateTo={navigateTo} />
    </div>
  );
}