import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const FLOW_STEPS = [
  { num: '01', title: 'Komunitas Ceritakan Masalahnya', sub: 'Pihak komunitas atau UMKM cukup mengisi formulir singkat menggunakan bahasa sehari-hari melalui website!', tag: 'START' },
  { num: '02', title: 'Pendataan Langsung di Lapangan', sub: 'Kalau komunitas belum familiar dengan website, tim AgenSUSI siap datang langsung ke lokasi untuk membantu mencatatkan masalahmu ke dalam sistem.', tag: '02' },
  { num: '03', title: 'Kebutuhan tampil di Katalog', sub: 'Masalah operasional yang sudah dicatat akan langsung muncul di katalog proyek terbuka agar bisa dilihat oleh para talenta IT.', tag: '03' },
  { num: '04', title: 'Talenta IT Mengajukan Diri', sub: 'Para developer muda atau mahasiswa IT yang tertarik akan memilih proyek yang sesuai dengan keahlian mereka dan mengirimkan lamaran.', tag: '04' },
  { num: '05', title: 'Komunitas Pilih Talenta yang Cocok', sub: 'Pihak komunitas bisa melihat rekam jejak serta portofolio para pelamar, lalu memilih satu talenta yang paling pas untuk menggarap proyeknya.', tag: '05' },
  { num: '06', title: 'Sepakati Batasan & Target Kerja', sub: 'Kedua pihak sama-sama menentukan apa saja yang bakal dibuat dan sepakat mengenai kriteria seperti apa proyek tersebut dianggap "selesai".', tag: '06' },
  { num: '07', title: 'Pengerjaan Dimulai!', sub: 'Kalau sudah saling setuju, proyek akan langsung digarap!', tag: '07' },
  { num: '08', title: 'Proyek selesai? Verifikasi dulu!', sub: 'Setelah proyek rampung, Talenta menandai selesai dan komunitas memberikan konfirmasi serta ulasan.', tag: 'END', dashed: true },
];

export default function FlowSection({ navigateTo }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const endRef = useRef(null);
  const pctRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const scrub = {
        trigger: trackRef.current,
        start: 'top 70%',
        end: 'bottom 60%',
        scrub: 1.2,
      };

      gsap.fromTo('.journey-fill', { height: '0%' }, { height: '100%', ease: 'none', scrollTrigger: scrub });
      gsap.fromTo('.journey-marker', { top: '0%' }, { top: '100%', ease: 'none', scrollTrigger: scrub });

      // indikator persen live mengikuti scroll
      ScrollTrigger.create({
        ...scrub,
        onUpdate: (self) => {
          if (pctRef.current) pctRef.current.textContent = `${Math.round(self.progress * 100)}%`;
        },
      });

      const steps = gsap.utils.toArray('.journey-step');
      steps.forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step,
          start: 'top 62%',
          onEnter: () => step.classList.add('on'),
          onLeaveBack: () => step.classList.remove('on'),
        });
        gsap.fromTo(
          step.querySelector('.journey-content'),
          { x: i % 2 === 0 ? -60 : 60, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: step, start: 'top 78%' } }
        );
        gsap.fromTo(
          step.querySelector('.journey-num'),
          { scale: 0.5, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.7)', scrollTrigger: { trigger: step, start: 'top 70%' } }
        );
      });

      ScrollTrigger.create({
        trigger: endRef.current,
        start: 'top 60%',
        onEnter: () => rootRef.current.classList.add('end-active'),
        onLeaveBack: () => rootRef.current.classList.remove('end-active'),
      });

      gsap.fromTo('.end-content', { y: 60, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: endRef.current, start: 'top 70%' },
      });

      gsap.fromTo('.flow-head', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out' });
    }, rootRef);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  return (
    <section id="alur" ref={rootRef} className="journey-section relative">
      <style>{`
        .journey-node { transition: transform .4s cubic-bezier(.34,1.56,.64,1), background .3s, border-color .3s; }
        .journey-step.on .journey-node { background: #FF5733; border-color: #000; transform: rotate(45deg) scale(1.25); }
        .journey-step.on .journey-node.dashed { background: #fff; }
        .journey-tick { transform: scaleX(0); opacity: 0; transition: transform .5s .15s, opacity .5s .15s; }
        .journey-step.on .journey-tick { transform: scaleX(1); opacity: 1; }
        .journey-tick.from-right { transform-origin: right center; }
        .journey-tick.from-left { transform-origin: left center; }
        .journey-section { background: #fff; transition: background-color 1.2s ease; }
        .journey-section.end-active { background: #0E7C66; }
        .journey-section .fd { transition: color 1.2s ease, background-color 1.2s ease, border-color 1.2s ease; }
        .end-active .fd-invert { color: #fff !important; }
        .end-active .fd-soft { color: rgba(255,255,255,.75) !important; }
        .end-active .fd-cta { background: #fff !important; color: #0E7C66 !important; }
      `}</style>

      <div className="flow-head px-6 lg:px-12 pt-32 pb-24 max-w-[1440px] mx-auto">
        <p className="text-xs uppercase tracking-[0.4em] text-black/50 font-bold mb-4">Memahami Bagaimana Cara Kami Bekerja Dalam</p>
        <div className="flex items-end justify-between flex-wrap gap-6">
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9]">Delapan Langkah<span className="text-[#FF5733]">.</span></h2>
          <div className="text-right">
            <p className="fd text-[10px] font-mono opacity-40 mb-1">PROGRES SCROLL</p>
            <p ref={pctRef} className="fd fd-invert text-4xl md:text-5xl font-black text-[#FF5733] tabular-nums">0%</p>
          </div>
        </div>
      </div>

      <div ref={trackRef} className="relative max-w-[1200px] mx-auto px-6">
        {/* GARIS PUNGGUNG TENGAH */}
        <div className="fd absolute left-[27px] md:left-1/2 md:-ml-px top-0 bottom-0 w-0.5 bg-black/10" />
        <div className="journey-fill absolute left-[27px] md:left-1/2 md:-ml-px top-0 w-0.5 bg-[#FF5733]" style={{ height: '0%' }} />
        <div className="journey-marker fd absolute left-[27px] md:left-1/2 -ml-[7px] w-3.5 h-3.5 bg-black rotate-45 z-20" style={{ top: '0%' }} />

        {FLOW_STEPS.map((s, i) => {
          const leftSide = i % 2 === 0;
          return (
            <div key={i} className="journey-step relative py-10 md:py-14 pl-14 md:pl-0 md:grid md:grid-cols-2 md:gap-24">
              {/* NODE */}
              <div className={`journey-node absolute left-4 md:left-1/2 md:-ml-3 top-10 w-6 h-6 border-2 border-black bg-white z-10 ${s.dashed ? 'dashed border-dashed' : ''}`} />

              {/* LENGAN PENGHUBUNG */}
              <div className={`journey-tick hidden md:block absolute top-[51px] h-0.5 w-12 bg-[#FF5733] ${leftSide ? 'right-1/2 from-right' : 'left-1/2 from-left'}`} />

              {/* KONTEN */}
              <div className={`journey-content ${leftSide ? 'md:col-start-1 md:text-right' : 'md:col-start-2'}`}>
                <span className="inline-block text-[10px] font-mono font-bold border-2 border-black bg-white px-3 py-1 mb-4">{s.tag}</span>
                <h3 className="text-3xl md:text-4xl lg:text-5xl font-black leading-[0.95] tracking-tight mb-4">{s.title}</h3>
                <p className="text-base md:text-lg opacity-60 mb-5 leading-relaxed">{s.sub}</p>
              </div>

              {/* NOMOR BESAR */}
              <div className={`hidden md:flex items-center ${leftSide ? 'md:col-start-2 md:row-start-1 justify-start pl-8' : 'md:col-start-1 md:row-start-1 justify-end pr-8'}`}>
                <span className="journey-num text-[10rem] font-black leading-none text-black/5">{s.num}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={endRef} className="min-h-screen flex items-center justify-center px-6 relative">
        <div className="end-content text-center max-w-5xl">
          <p className="fd fd-soft text-xs font-mono font-bold uppercase tracking-[0.4em] mb-8 opacity-60">Apa Dampaknya?</p>
          <h3 className="fd fd-invert text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-8">Nama baik tumbuh.<br />Siklus berulang<span className="text-[#FF5733]">.</span></h3>
          <p className="fd fd-soft text-base md:text-xl opacity-60 mb-12 max-w-2xl mx-auto leading-relaxed">Setiap proyek yang selesai akan menambah poin rekam jejak talenta, dan komunitas akan terbantu dengan proyek yang dikerjakan.</p>
          <button onClick={() => navigateTo('dashboard')} className="fd fd-cta bg-black text-white px-10 py-5 text-sm uppercase tracking-wider font-bold hover:bg-[#FF5733] hover:text-white transition-colors">Gabung Sekarang →</button>
        </div>
      </div>
    </section>
  );
}