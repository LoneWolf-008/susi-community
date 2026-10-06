import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FlowSection from '../sections/FlowSection';
import StatsSection from '../sections/StatsSection';
import { api } from '../lib/api';
import { PUBLIC_SUGGESTIONS } from '../data/askSuggestions';
import './HomeHero.css';

const VISIT_KEY = 'susi_visit_recorded';

// Latar hero: kolase foto komunitas (2:1), varian di public/images/hero/ (scripts/build-hero-images.mjs).
// Lebar tampil = cover: di layar tegak lebih dari 100vw (tinggi hero ≈ 100vh × rasio 2).
const HERO_WIDTHS = [768, 1280, 1920];
const heroSrcSet = (ext) => HERO_WIDTHS.map((w) => `/images/hero/collage-${w}.${ext} ${w}w`).join(', ');
const HERO_SIZES = '(max-aspect-ratio: 2/1) 200vh, 100vw';
// Saran yang dijamin terjawab basis pengetahuan Tanya SUSI (lihat data/askSuggestions.js).
const QUESTIONS = PUBLIC_SUGGESTIONS;

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const Dither = () => (
  <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: '240px 240px' }} />
);

export default function HomePage({ navigateTo, onAsk }) {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const heroImgRef = useRef(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [askInput, setAskInput] = useState('');

  // Gambar dari cache bisa selesai sebelum onLoad terpasang: cek status complete sekali.
  useEffect(() => {
    if (heroImgRef.current?.complete && heroImgRef.current.naturalWidth > 0) setHeroLoaded(true);
  }, []);

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
      {/* ===== 1. HERO — kolase foto komunitas sebagai latar penuh (lapisan: fallback → gambar → penggelap → teks) ===== */}
      <section
        ref={heroRef}
        className="hero relative isolate min-h-dvh flex items-center justify-center overflow-hidden px-6 pt-36 pb-44"
      >
        <picture>
          <source type="image/avif" srcSet={heroSrcSet('avif')} sizes={HERO_SIZES} />
          <source type="image/webp" srcSet={heroSrcSet('webp')} sizes={HERO_SIZES} />
          <img
            ref={heroImgRef}
            src="/images/hero/collage-1280.webp"
            alt=""
            aria-hidden="true"
            width={1920}
            height={960}
            decoding="async"
            fetchPriority="high"
            onLoad={() => setHeroLoaded(true)}
            className={`hero-bg absolute inset-0 -z-20 w-full h-full object-cover pointer-events-none ${heroLoaded ? 'is-loaded' : ''}`}
          />
        </picture>
        <div aria-hidden="true" className="hero-shade absolute inset-0 -z-10 pointer-events-none" />

        {/* KONTEN UTAMA — parallax saat scroll */}
        <div className="hero-parallax relative z-10 max-w-5xl mx-auto text-center">
          {/* HEADING — dengan glow text-shadow pada kata merah */}
          <h1 className="hero-title font-black tracking-tight leading-[1.08] text-[clamp(2.6rem,7.5vw,7.2rem)]">
            <span className="block overflow-hidden py-1 -my-1.5">
              <span className="hero-line block">Kami adalah</span>
            </span>
            <span className="block overflow-hidden py-3 -my-1.5 relative">
              <span className="hero-line hero-accent block relative">
                solusi digital
              </span>
            </span>
            <span className="block overflow-hidden py-1 -my-1.5">
              <span className="hero-line block">komunitas anda.</span>
            </span>
          </h1>
        </div>

        {/* Scroll indicator — di bawah hero */}
        <div className="hero-scroll hero-muted absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <p className="font-mono text-[9px] font-bold tracking-[0.4em]">SCROLL</p>
          <span className="scroll-arrow hero-muted-line block w-[1px] h-8 relative">
            <span className="hero-muted-arrow absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 border-b border-r rotate-45" />
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