import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function FeatureSection({ navigateTo, goToSection }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.mix-head', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' });
      gsap.utils.toArray('.mix-card').forEach((card, i) => {
        gsap.fromTo(card, { y: 50, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 85%' },
        });
      });
    }, rootRef);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  return (
    <section id="fitur" ref={rootRef} className="bg-[#f2efe6] text-[#12283c] py-28 md:py-32 px-6 lg:px-12">
      <div className="max-w-[1100px] mx-auto">
        {/* HEAD TENGAH */}
        <div className="mix-head text-center">
          <p className="font-mono text-xs font-bold tracking-[0.4em] text-[#12283c]/50 mb-5">MIXTAPE</p>
          <h2 className="font-black tracking-tight leading-[0.95] text-[clamp(2.4rem,6vw,4.8rem)]">
            Yang sedang kami geluti saat ini.
          </h2>
          <button
            onClick={() => navigateTo('tentang')}
            className="mt-9 inline-flex items-center gap-3 bg-[#12283c] text-[#f2efe6] px-8 py-4 rounded-sm text-sm font-bold hover:bg-[#e62b2b] transition-colors"
          >
            Jelajahi Mixtape <span>→</span>
          </button>
        </div>

        {/* KARTU-KARTU */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kartu gelap ala video */}
          <div className="mix-card relative rounded-xl overflow-hidden bg-[#101d2b] min-h-[420px] p-8 flex flex-col justify-end text-[#f2efe6]">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=60"
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e2233]/95 via-[#0e2233]/30 to-transparent" />
            <span className="absolute top-6 left-8 font-mono text-[10px] font-bold tracking-[0.3em] text-[#f2efe6]/70">CERITA KOMUNITAS</span>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-[#f2efe6] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <p className="relative font-serif italic text-2xl md:text-3xl leading-snug">“Orang-orang terbaik... di mana pun.”</p>
          </div>

          {/* Kartu mint */}
          <div className="mix-card md:mt-16 rounded-xl bg-[#c9ecd9] p-8 md:p-10 min-h-[380px] flex flex-col">
            <h3 className="font-black tracking-tight leading-[1.05] text-2xl md:text-3xl">
              CX terbaik bukan menambah fitur, layanan, atau touchpoint.
            </h3>
            <p className="mt-5 text-[#12283c]/70 leading-relaxed">
              Tapi mengenali langkah yang sudah biasa ditoleransi warga — dan punya disiplin untuk menghapusnya.
            </p>
            <button className="mt-auto pt-6 font-bold flex items-center gap-1 hover:gap-2 transition-all text-left">
              Lihat di LinkedIn <span>↗</span>
            </button>
          </div>

          {/* Kartu merah */}
          <div className="mix-card rounded-xl bg-[#e62b2b] text-white p-8 md:p-10 min-h-[380px] flex flex-col">
            <h3 className="font-black tracking-tight leading-[1.05] text-2xl md:text-3xl">
              Gratis untuk komunitas. Berbayar dalam pengalaman.
            </h3>
            <p className="mt-5 text-white/85 leading-relaxed">
              Talenta mendapat portofolio nyata, komunitas mendapat solusi yang benar-benar dipakai sehari-hari.
            </p>
            <button onClick={() => goToSection('alur')} className="mt-auto pt-6 font-bold flex items-center gap-1 hover:gap-2 transition-all text-left">
              Cara kerjanya <span>→</span>
            </button>
          </div>

          {/* Kartu krem kutipan */}
          <div className="mix-card md:mt-16 rounded-xl bg-white/70 border border-[#12283c]/10 p-8 md:p-10 min-h-[380px] flex flex-col justify-between">
            <p className="font-serif italic text-2xl md:text-3xl leading-snug">
              “Akhirnya iuran warga rapi, tidak ada yang tertukar.”
            </p>
            <p className="mt-8 font-mono text-[10px] font-bold tracking-[0.25em] text-[#12283c]/50">
              — IBU SITI AMINAH · PKK RW 05
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}