import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Magnetic from '../components/common/Magnetic';
import LogoHero from '../sections/LogoHero';
import FlowSection from '../sections/FlowSection';
import FeatureSection from '../sections/FeatureSection';

export default function HomePage({ navigateTo, goToSection }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .fromTo('.hero-line', { yPercent: 110 }, { yPercent: 0, duration: 1.2, stagger: 0.15 })
        .fromTo('.hero-fade', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, '-=0.6')
        .fromTo('.hero-bar', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut', transformOrigin: 'left center' }, '-=0.4')
        

      gsap.to('.marquee-track', { xPercent: -50, ease: 'none', duration: 25, repeat: -1 });

      gsap.fromTo('.problem-card', { y: 80, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.15, ease: 'power3.out',
        scrollTrigger: { trigger: '.problem-grid', start: 'top 75%' },
      });

      gsap.utils.toArray('.counter').forEach((el) => {
        const target = +el.dataset.target;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target, duration: 2, ease: 'power1.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
          onUpdate: () => { el.textContent = Math.round(obj.val); },
        });
      });

      gsap.fromTo('.usp-card', { y: 80, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.15, ease: 'power3.out',
        scrollTrigger: { trigger: '.usp-grid', start: 'top 75%' },
      });

      
    }, rootRef);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="bg-white text-black">
      <section className="pt-40 pb-24 px-6 lg:px-12 min-h-screen flex items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(black 1px, transparent 1px), linear-gradient(90deg, black 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-[1440px] mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <div className="hero-fade flex items-center gap-4 mb-8"></div>
              <h1 className="text-[clamp(3rem,9vw,9rem)] font-black leading-[0.85] tracking-tighter mb-8">
                <span className="block overflow-hidden"><span className="hero-line block">SUSI</span></span>
                <span className="block overflow-hidden"><span className="hero-line block">COMMU<span className="text-[#FF5733]">NITY</span></span></span>
              </h1>
              <p className="hero-fade text-lg md:text-2xl text-black/70 max-w-2xl leading-relaxed mb-12">
                Platform penghubung antara komunitas di Kota Bandung <span className="font-bold text-black border-b-2 border-[#FF5733]">dengan talenta IT yang butuh pengalaman proyek nyata</span>.
              </p>
              <div className="hero-fade flex flex-wrap gap-4">
                <Magnetic>
                  <button onClick={() => goToSection('alur')} className="group bg-black text-white px-10 py-5 text-sm uppercase tracking-wider font-bold hover:bg-[#FF5733] transition-colors flex items-center gap-3">
                    Lihat Cara Kerjanya <span className="group-hover:translate-x-2 transition-transform">↓</span>
                  </button>
                </Magnetic>
              </div>
            </div>
            <div className="lg:col-span-4">
            <LogoHero />
          </div>
          </div>
          <div className="hero-bar mt-20 h-2 bg-[#FF5733]" />
        </div>
      </section>

      <section className="border-y-2 border-black py-6 overflow-hidden bg-[#FF5733]">
        <div className="marquee-track flex whitespace-nowrap w-max">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 mx-4">
              {['KOMUNITAS CERITA', 'TALENTA MENGAJUKAN', 'TERPERCAYA', 'DIGITALISASI KOMUNITAS', 'POTENSI PENGALAMAN'].map((t, j) => (
                <div key={j} className="flex items-center gap-8">
                  <span className="text-2xl md:text-3xl font-black tracking-tight">{t}</span>
                  <span className="w-3 h-3 bg-black rotate-45" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <FlowSection navigateTo={navigateTo} />

      <section className="py-24 px-6 lg:px-12 bg-black text-white border-y-2 border-black">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-px bg-white/20">
          {[
            { label: 'Proyek Selesai', target: 127 },
            { label: 'Talenta Terdaftar', target: 89 },
            { label: 'Komunitas Terbantu', target: 45 },
          ].map((s, i) => (
            <div key={i} className="bg-black p-12 text-center hover:bg-[#FF5733] transition-colors duration-500">
              <div className="text-7xl md:text-8xl font-black mb-4 tabular-nums"><span className="counter" data-target={s.target}>0</span>+</div>
              <p className="text-xs uppercase tracking-[0.3em] opacity-60 font-bold">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fitur" className="py-32 px-6 lg:px-12">
        <FeatureSection />
      </section>

      <section className="py-32 px-6 lg:px-12 bg-[#FF5733] text-white relative overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 border-2 border-white/20" />
        <div className="absolute bottom-10 right-10 w-48 h-48 border-2 border-white/20" />
        <div className="max-w-[1440px] mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[0.9]">Dua kekurangan.<br />Saling melengkapi.</h2>
          <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto mb-12">Jadi, tunggu apa lagi?</p>
          <Magnetic>
            <button onClick={() => navigateTo('dashboard')} className="bg-black text-white px-14 py-6 text-sm uppercase tracking-wider font-bold hover:bg-white hover:text-black transition-colors">
              Gabung SUSI Community →
            </button>
          </Magnetic>
        </div>
      </section>
    </div>
  );
}