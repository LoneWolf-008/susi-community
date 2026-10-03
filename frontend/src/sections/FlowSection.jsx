import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FLOW_STEPS } from '../data/constants';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function FlowSection({ navigateTo }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const endRef = useRef(null);
  const pctRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const scrub = { trigger: trackRef.current, start: 'top 65%', end: 'bottom 55%', scrub: 0.8 };
      gsap.fromTo('.journey-fill', { height: '0%' }, { height: '100%', ease: 'none', scrollTrigger: scrub });
      gsap.fromTo('.journey-marker', { top: '0%' }, { top: '100%', ease: 'none', scrollTrigger: scrub });
      ScrollTrigger.create({
        ...scrub,
        onUpdate: (self) => { if (pctRef.current) pctRef.current.textContent = String(Math.round(self.progress * 100)).padStart(2, '0'); },
      });

      gsap.fromTo('.flow-head > *', { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1, ease: 'power3.out' });
      gsap.to('.scroll-hint span', { y: 6, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });

      const steps = gsap.utils.toArray('.journey-step');
      steps.forEach((step, i) => {
        ScrollTrigger.create({ trigger: step, start: 'top 60%', onEnter: () => step.classList.add('on'), onLeaveBack: () => step.classList.remove('on') });
        ScrollTrigger.create({ trigger: step, start: 'bottom 45%', onEnter: () => step.classList.add('passed'), onLeaveBack: () => step.classList.remove('passed') });

        const tl = gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 75%' } });
        tl.fromTo(step.querySelector('.journey-content'), { x: i % 2 === 0 ? -56 : 56, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out' })
          .fromTo(step.querySelector('.step-title'), { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
          .fromTo(step.querySelector('.step-sub'), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, '-=0.5');

        const num = step.querySelector('.journey-num');
        if (num) {
          gsap.fromTo(num, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: step, start: 'top 78%' } });
          gsap.fromTo(num, { y: 60 }, { y: -60, ease: 'none', scrollTrigger: { trigger: step, start: 'top bottom', end: 'bottom top', scrub: 1 } });
        }
      });

      /* End: reveal konten saja — background sudah gradient utuh, tanpa class toggle */
      gsap.fromTo('.end-content > *', { y: 44, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: endRef.current, start: 'top 65%' },
      });
    }, rootRef);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  return (
    <section id="alur" ref={rootRef} className="relative bg-[#f2efe6]">
      <style>{`
        .journey-node { transition: transform .45s cubic-bezier(.34,1.56,.64,1), background-color .35s, border-color .35s; }
        .journey-step.on .journey-node, .journey-step.passed .journey-node { background: #e62b2b; border-color: #12283c; transform: rotate(45deg) scale(1.2); }
        .journey-step.on .journey-node.dashed, .journey-step.passed .journey-node.dashed { background: #f2efe6; }
        .journey-tick { transform: scaleX(0); opacity: 0; transition: transform .6s .1s cubic-bezier(.65,0,.35,1), opacity .4s .1s; }
        .journey-step.on .journey-tick, .journey-step.passed .journey-tick { transform: scaleX(1); opacity: 1; }
        .journey-tick.from-right { transform-origin: right center; }
        .journey-tick.from-left { transform-origin: left center; }
      `}</style>

      {/* HEADER */}
      <div className="flow-head px-6 lg:px-12 pt-28 md:pt-36 pb-16 md:pb-24 max-w-[1440px] mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-8">
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] text-[#12283c]">Memahami <span className="text-[#e62b2b]">SUSI</span> Dalam Delapan Langkah<span className="text-[#e62b2b]">.</span></h2>
        </div>
        <div className="scroll-hint mt-10 flex items-center gap-3 text-[#12283c]/50">
        </div>
      </div>

      {/* TRACK */}
      <div ref={trackRef} className="relative max-w-[1200px] mx-auto px-6">
        <div className="absolute left-[27px] md:left-1/2 md:-ml-px top-0 bottom-0 w-0.5 bg-[#12283c]/15" />
        <div className="journey-fill absolute left-[27px] md:left-1/2 md:-ml-px top-0 w-0.5 bg-[#e62b2b]" style={{ height: '0%' }} />
        <div className="journey-marker absolute left-[27px] md:left-1/2 -ml-[9px] w-[18px] h-[18px] bg-[#e62b2b] border-2 border-[#12283c] rotate-45 z-20" style={{ top: '0%' }}>
        </div>

        {FLOW_STEPS.map((s, i) => {
          const isLeft = i % 2 === 0;
          return (
            <div key={i} className="journey-step relative py-12 md:py-16 pl-14 md:pl-0 md:grid md:grid-cols-2 md:gap-24">
              <div className={`journey-node absolute left-4 md:left-1/2 md:-ml-3 top-12 w-6 h-6 border-2 border-[#12283c] bg-[#f2efe6] z-10 ${s.dashed ? 'dashed border-dashed' : ''}`} />
              <div className={`journey-tick hidden md:block absolute top-[57px] h-0.5 w-12 bg-[#e62b2b] ${isLeft ? 'right-1/2 from-right' : 'left-1/2 from-left'}`} />
              <div className={`journey-content ${isLeft ? 'md:col-start-1 md:text-right' : 'md:col-start-2'}`}>
                <div className="overflow-hidden">
                  <h3 className="step-title text-3xl md:text-4xl lg:text-5xl font-black leading-[1.02] tracking-tight mb-4 text-[#12283c]">{s.title}</h3>
                </div>
                <p className={`step-sub text-base md:text-lg text-[#12283c]/60 leading-relaxed max-w-md ${isLeft ? 'md:ml-auto' : ''}`}>{s.sub}</p>
              </div>
              <div className={`hidden md:flex items-center ${isLeft ? 'md:col-start-2 md:row-start-1 justify-start pl-8' : 'md:col-start-1 md:row-start-1 justify-end pr-8'}`}>
                <span className="journey-num text-[9rem] lg:text-[12rem] font-black leading-none text-[#12283c]/[0.07] select-none">{s.num}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== END: SATU GRADIENT UTUH krem → peach → merah → maroon → navy (mulus ke footer) ===== */}
      <div ref={endRef} className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #f2efe6 0%, #e8b7ae 12%, #e62b2b 34%, #c2232b 55%, #57141d 80%, #0e2233 100%)' }} />
        <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: '240px 240px' }} />
        <div className="absolute -top-16 -right-16 w-72 h-72 border-2 border-dashed border-[#f2efe6]/25 rounded-full rot-slow pointer-events-none" />

        <div className="end-content relative z-10 text-center max-w-5xl py-24">
          <h3 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-8 text-[#f2efe6]">
            Nama baik tumbuh.<br />Siklus berulang<span className="text-[#f2efe6]">.</span>
          </h3>
          <p className="text-base md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed text-[#f2efe6]/80">
            Setiap proyek yang selesai menambah poin rekam jejak talenta, dan komunitas terbantu oleh solusi yang benar-benar dipakai.
          </p>
          <button
            onClick={() => navigateTo('dashboard')}
            className="bg-[#f2efe6] text-[#7a1a1f] px-10 py-5 text-sm font-bold rounded-full hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors"
          >
            Mulai Perjalananmu →
          </button>
        </div>
      </div>
    </section>
  );
}