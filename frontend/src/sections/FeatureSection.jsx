import { useState, useEffect } from 'react';
import gsap from 'gsap';

export default function FeatureSection() {
  const [active, setActive] = useState(0);

  const FEATURES = [
    {
      num: '01',
      title: 'Bisa Dibantu Langsung',
      desc: 'Nggak paham cara pakai website? Tenang, ada AgenSUSI yang akan datang langsung buat mendata masalah komunitasmu.',
      fact: 'Fleksibel',
    },
    {
      num: '02',
      title: 'Tidak Ada Klaim Sepihak',
      desc: 'Proyek nggak bisa asal ditandai selesai. Harus ada konfirmasi dari komunitas dulu baru skor reputasi Talenta bertambah.',
      fact: 'Terpercaya',
    },
    {
      num: '03',
      title: 'Sama-Sama Untung!',
      desc: 'Komunitas dapat solusi digital gratis tanpa pusing tarif pasar yang mahal, sementara anak IT dapat pengalaman proyek nyata dan portofolio asli yang bisa dipamerkan!',
      fact: 'GRATIS!',
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.feat-card', { y: 60, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.feat-wrap', start: 'top 78%' },
      });
    });
    return () => ctx.revert();
  }, []);

  // animasi isi kartu saat kartu aktif berganti
  useEffect(() => {
    gsap.fromTo('.feat-open > *', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
  }, [active]);

  return (
    <section id="fitur" className="py-32 px-6 lg:px-12">
      <style>{`
        .feat-vertical { writing-mode: vertical-rl; transform: rotate(180deg); }
        @media (max-width: 767px) { .feat-vertical { writing-mode: horizontal-tb; transform: none; } }
      `}</style>
      <div className="feat-wrap max-w-[1440px] mx-auto">
        <div className="flex items-end justify-between mb-16 flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-black/50 font-bold mb-4">Fitur</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight">Tiga Fitur Utama Kami<span className="text-[#FF5733]">.</span></h2>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:h-[540px]">
          {FEATURES.map((f, i) => {
            const on = active === i;
            return (
              <button
                key={f.num}
                onClick={() => setActive(i)}
                style={{ flexGrow: on ? 3.2 : 1 }}
                className={`feat-card relative border-2 border-black p-7 md:p-8 text-left transition-all duration-700 overflow-hidden ${
                  on ? 'bg-black text-white' : 'bg-white hover:bg-[#FF5733] hover:text-white'
                }`}
              >
                <div className="h-full flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span className={`text-5xl md:text-6xl font-black ${on ? 'text-[#FF5733]' : 'text-black/10'}`}>{f.num}</span>
                    <span className={`w-3 h-3 rotate-45 transition-colors ${on ? 'bg-[#FF5733]' : 'bg-black/20'}`} />
                  </div>

                  {on ? (
                    <div className="feat-open md:max-w-md">
                      <h3 className="text-3xl md:text-4xl font-black tracking-tight mb-4">{f.title}</h3>
                      <p className="text-sm md:text-base opacity-70 leading-relaxed mb-6">{f.desc}</p>
                      <span className="inline-block text-[10px] font-mono font-bold border-2 border-current px-3 py-1.5">{f.fact}</span>
                    </div>
                  ) : (
                    <h3 className="feat-vertical text-xl md:text-2xl font-black tracking-tight">{f.title}</h3>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}