import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { UserRound, Shield, ThumbsUp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export default function FeatureSection() {
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);

  const FEATURES = [
    {
      num: '01',
      title: 'Bisa Dibantu Langsung',
      tagline: 'Gak Pake Ribet.',
      desc: 'Nggak paham cara pakai website? Tenang AgenSUSI akan datang langsung buat mencatat masalah komunitasmu.',
      chips: ['KUNJUNGAN LAPANGAN', 'FLEKSIBEL'],
      bg: 'bg-white', ink: 'text-black',
      iconBg: 'bg-[#FF5733] text-white',
      chipCls: 'bg-[#F4F4F2] border-black/20 text-black',
      icon: UserRound,
    },
    {
      num: '02',
      title: 'Tidak Ada Klaim Sepihak',
      tagline: 'Lewat konfirmasi dua arah.',
      desc: 'Proyek yang sudah selesai ngga bisa asal ditandai selesai. Harus ada konfirmasi dari komunitas dulu baru proyek dianggap selesai.',
      chips: ['KONFIRMASI GANDA'],
      bg: 'bg-[#FF5733]', ink: 'text-white',
      iconBg: 'bg-black text-white',
      chipCls: 'bg-black/15 border-white/40 text-white',
      icon: Shield,
    },
    {
      num: '03',
      title: 'Sama-Sama Untung',
      tagline: 'Komunitas hemat uang, talenta mendapat peluang!',
      desc: 'Komunitas dapat solusi digital tanpa biaya mahal. Talenta mendapatkan pengalaman nyata & portofolio yang bisa dipamerkan.',
      chips: ['GRATIS!'],
      bg: 'bg-[#0E7C66]', ink: 'text-white',
      iconBg: 'bg-white text-[#0E7C66]',
      chipCls: 'bg-white/15 border-white/40 text-white',
      icon: ThumbsUp,
    },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.featstack-head', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' });

      ScrollTrigger.matchMedia({
        "(min-width: 768px)": () => {
          const cards = gsap.utils.toArray('.stack-card');
          cards.forEach((card, i) => {
            // Indikator aktif
            ScrollTrigger.create({
              trigger: card,
              start: 'top 55%',
              end: 'bottom 45%',
              onEnter: () => setActive(i),
              onEnterBack: () => setActive(i),
            });

            // Chips animation
            gsap.fromTo(card.querySelectorAll('.chip'), { y: 16, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out',
              scrollTrigger: { trigger: card, start: 'top 65%', toggleActions: 'play none none reverse' },
            });

            // Efek kartu sebelumnya mengecil saat tertutup
            if (i > 0) {
              gsap.fromTo(cards[i - 1],
                { scale: 1, y: 0 },
                {
                  scale: 0.94,
                  y: -15,
                  transformOrigin: 'top center',
                  ease: 'none',
                  scrollTrigger: {
                    trigger: card,
                    start: 'top 95%',
                    end: 'top 45%',
                    scrub: 1 // scrub: 1 membuat transisi lebih halus dan mencegah jitter
                  },
                }
              );
            }
          });
        },

        // === MOBILE (Vertical List / Bukan Stacked) ===
        // === MOBILE (Vertical List / Bukan Stacked) ===
        "(max-width: 767px)": () => {
          const cards = gsap.utils.toArray('.stack-card');

          // 1. Set initial state dulu biar gak stuck di autoAlpha: 0 saat load
          gsap.set(cards, { y: 40, autoAlpha: 0 });
          gsap.set(cards.map(c => c.querySelectorAll('.chip')), { y: 16, autoAlpha: 0 });

          cards.forEach((card, i) => {
            // 2. Animasi Card (Gunakan .to() bukan .fromTo())
            gsap.to(card, {
              y: 0,
              autoAlpha: 1,
              duration: 0.8,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 90%', // Dibuat sedikit lebih awal agar pasti trigger di mobile
                toggleActions: 'play none none none', // Hanya main sekali, tidak hilang saat scroll ke atas
              }
            });

            // 3. Animasi Chips
            gsap.to(card.querySelectorAll('.chip'), {
              y: 0,
              autoAlpha: 1,
              duration: 0.5,
              stagger: 0.08,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none none',
              },
            });
          });
        }
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // Fungsi klik indikator untuk smooth scroll
  const jump = (i) => {
    const cards = rootRef.current.querySelectorAll('.stack-card');
    if (window.innerWidth >= 768) {
      gsap.to(window, { scrollTo: { y: cards[i], offsetY: 110 + i * 22 }, duration: 0.9, ease: 'power2.inOut' });
    } else {
      gsap.to(window, { scrollTo: { y: cards[i], offsetY: 40 }, duration: 0.9, ease: 'power2.inOut' });
    }
  };

  return (
    <section id="fitur" ref={rootRef} className="py-28 md:py-32 px-6 lg:px-12 text-black">
      <div className="max-w-[1100px] mx-auto">
        <div className="featstack-head flex items-end justify-between flex-wrap gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-black/50 font-bold mb-4">02 / Fitur</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight">Tiga Fitur Utama<span className="text-[#FF5733]">.</span></h2>
          </div>
          {/* INDIKATOR */}
          <div className="flex items-center gap-2">
            {FEATURES.map((f, i) => (
              <button
                key={f.num}
                onClick={() => jump(i)}
                aria-label={f.title}
                className={`h-2.5 rounded-full transition-all duration-500 ${active === i ? 'w-12 bg-[#FF5733]' : 'w-5 bg-black/20 hover:bg-black/40'}`}
              />
            ))}
          </div>
        </div>

        {/* STACKED CARDS */}
        <div className="flex flex-col gap-8 md:gap-16 md:pb-8">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.num}
                className={`stack-card rounded-[2rem] border-2 border-black overflow-hidden ${f.bg} ${f.ink} shadow-[0_18px_50px_rgba(0,0,0,0.15)] md:sticky will-change-transform`}
                style={{ top: `${96 + i * 22}px` }}
              >
                <div className="p-8 md:p-12 min-h-[380px] md:min-h-[420px] flex flex-col justify-between gap-8">
                  <div className="flex items-start justify-between gap-4">
                    <span className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shrink-0 ${f.iconBg}`}>
                      <Icon className="w-6 h-6 md:w-7 md:h-7" />
                    </span>
                    <span className="text-6xl md:text-8xl font-black leading-none opacity-10 select-none">{f.num}</span>
                  </div>

                  <div>
                    <h3 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-3">{f.title}</h3>
                    <p className="text-xs md:text-sm font-bold opacity-70 uppercase tracking-widest mb-5">{f.tagline}</p>
                    <p className="text-sm md:text-base font-medium leading-relaxed opacity-90 max-w-2xl mb-6">{f.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {f.chips.map((c) => (
                        <span key={c} className={`chip text-[9px] font-mono font-bold border rounded-full px-3 py-1.5 ${f.chipCls}`}>{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}