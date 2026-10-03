import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FlowSection from '../sections/FlowSection';

const STATS = [
  { label: 'Proyek Selesai', target: 127 },
  { label: 'Talenta Terdaftar', target: 89 },
  { label: 'Komunitas Terbantu', target: 45 },
];
const PHOTOS = {
  top: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=60',
  left: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=60',
  right: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=700&q=60',
  bottom: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=60',
};
const QUESTIONS = [
  'Apa saja pekerjaan yang SUSI lakukan?',
  'Bagaimana pendekatan SUSI terhadap komunitas?',
  'Tunjukkan proyek yang relevan di sektor saya...',
  'Apa yang membuat SUSI berbeda dari yang lain?',
];

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const Dither = () => (
  <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: '240px 240px' }} />
);

export default function HomePage({ navigateTo, goToSection, onAsk }) {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const [askInput, setAskInput] = useState('');

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

      /* Counter */
      gsap.utils.toArray('.counter').forEach((el) => {
        const target = +el.dataset.target;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target, duration: 2.2, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
          onUpdate: () => { el.textContent = Math.round(obj.val); },
        });
      });

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
        className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 pt-36 pb-44"
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
        <div className="hidden md:block absolute top-24 left-1/2 -ml-[120px] w-[240px] h-[130px] rotate-[-2deg]">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.top} alt="" className="w-full h-full object-cover" /></div>
        </div>
        <div className="hidden md:block absolute top-[30%] -left-8 w-[150px] h-[310px] rotate-[-4deg]">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.left} alt="" className="w-full h-full object-cover" /></div>
        </div>
        <div className="hidden md:block absolute top-[32%] -right-6 w-[190px] h-[230px] rotate-[3deg]">
          <div className="fp w-full h-full overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/5 shadow-2xl"><img src={PHOTOS.right} alt="" className="w-full h-full object-cover" /></div>
        </div>
        <div className="hidden md:block absolute -bottom-16 left-1/2 -ml-[190px] w-[380px] h-[220px] rotate-[2deg]">
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

      {/* ===== 4. STATISTIK ===== */}
      <section className="relative bg-[#0e2233] py-20 md:py-28 px-6 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          <div className="sec-reveal mb-14 flex items-end justify-between flex-wrap gap-6">
            <div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">Angka yang<br />kami <span className="text-[#e62b2b]">banggakan</span>.</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
            {STATS.map((s, i) => (
              <div key={i} className="sec-reveal bg-[#0e2233] p-10 md:p-14 text-center hover:bg-[#e62b2b] transition-colors duration-500 group">
                <div className="text-6xl md:text-8xl font-black tabular-nums text-[#f2efe6]"><span className="counter" data-target={s.target}>0</span>+</div>
                <p className="mt-4 font-mono text-[10px] font-bold tracking-[0.3em] text-[#f2efe6]/50 group-hover:text-white">{s.label.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BRIDGE 2 ===== */}
      <section className="relative h-56 md:h-72" style={{ background: 'linear-gradient(180deg, #0e2233 0%, #1a2a3a 22%, #35414b 45%, #6e6f68 68%, #b9b3a4 86%, #f2efe6 100%)' }}>
        <Dither />
      </section>

      {/* ===== 5. ALUR ===== */}
      <FlowSection navigateTo={navigateTo} />
    </div>
  );
}