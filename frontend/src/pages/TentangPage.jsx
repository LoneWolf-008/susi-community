import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import GoogleMapsEmbed from '../components/common/GoogleMapsEmbed';
import { MessagesSquare, Mails, Map, Copy, ArrowRight } from 'lucide-react';
import fotoHasby from '../assets/hasby.jpg';
import fotoEzra from '../assets/ezra.jpg';
import fotoRien from '../assets/rien.jpg';
import fotoAlif from '../assets/alif.jpg';

const TEAM_MEMBERS = [
  { i: 'HW', n: 'Hasby Wira Al Muflih', r: 'Ketua Tim', foto: fotoHasby, bio: 'Menjaga visi, ritme, dan timeline tim tetap waras. Percaya produk yang baik dimulai dari mendengar komunitas.', skill: ['Leadership', 'Product Strategy', 'UI Design'], quote: '"Dengar dulu, rancang kemudian."' },
  { i: 'EP', n: 'Ezra Putra Arkana', r: 'Developer', foto: fotoEzra, bio: 'Fokus pada desain interface untuk kenyamanan pengguna.', skill: ['React', 'Tailwind', 'GSAP'], quote: '"Antarmuka yang baik itu tidak terlihat."' },
  { i: 'DA', n: 'Derien Adelio Rhaivan', r: 'Developer', foto: fotoRien, bio: 'Backend yang memastikan data rapi, API stabil, dan tidak ada request yang hilang tanpa jejak.', skill: ['Node.js', 'MySQL', 'REST API'], quote: '"Data adalah janji yang harus ditepati."' },
  { i: 'KA', n: 'Khalifa Aisy Hafiy', r: 'Developer', foto: fotoAlif, bio: 'Memastikan semua fitur pada website berjalan sesuai dengan rencana.', skill: ['Frontend', 'Testing'], quote: '"Bug adalah utang, dan saya tidak suka berutang."' },
];

const VALUES = [
  { n: '01', t: 'Dengar Dulu', d: 'Kami tidak datang dengan jawaban. Kami datang dengan pertanyaan — lalu duduk bersama komunitas sampai akar masalahnya terlihat.' },
  { n: '02', t: 'Bangun yang Dipakai', d: 'Teknologi bagus yang tidak dipakai adalah sia-sia. Kami memilih solusi sederhana yang benar-benar digunakan sehari-hari.' },
  { n: '03', t: 'Tumbuh Bersama', d: 'Talenta dapat portofolio nyata, komunitas dapat solusi yang bertahan. Tidak ada pihak yang kalah dalam siklus ini.' },
];

const HQ = { lat: -6.9075, lng: 107.619, addr: 'Jl. Kliningan No. 4 Kota Bandung, Jawa Barat, 40132, Indonesia' };

function TeamMember({ m, idx }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="team-member group relative">
      {/* Foto / Placeholder */}
      <div className="relative aspect-[3/4] bg-[#12283c] overflow-hidden">
        {imgOk ? (
          <img
            src={m.foto}
            alt={m.n}
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#12283c] to-[#0e2233]">
            <span className="text-[10rem] font-black text-[#e62b2b]/30 leading-none">{m.i}</span>
          </div>
        )}

        {/* Quote muncul saat hover */}
        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-[#0e2233] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <p className="text-[#f2efe6] text-sm italic leading-relaxed">{m.quote}</p>
        </div>
      </div>

      {/* Info */}
      <div className="pt-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="member-name text-xl md:text-2xl font-black tracking-tight text-[#12283c] leading-tight">
            {m.n}
          </h3>
        </div>
        <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#e62b2b] mb-3">{m.r.toUpperCase()}</p>
        <p className="member-bio text-sm text-[#12283c]/60 leading-relaxed mb-4">{m.bio}</p>
        <div className="flex flex-wrap gap-1.5">
          {m.skill.map((s) => (
            <span key={s} className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#12283c]/50 border border-[#12283c]/15 rounded-full px-2.5 py-1">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TentangPage() {
  const rootRef = useRef(null);
  const contactRef = useRef(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const CONTACTS = [
    { k: 'wa', icon: <MessagesSquare className="w-5 h-5" />, label: 'WhatsApp Tim', value: '+62 812-3456-7890', href: 'https://wa.me/6281234567890' },
    { k: 'mail', icon: <Mails className="w-5 h-5" />, label: 'Email Resmi', value: 'timsusi@smkn4bdg.sch.id', href: 'mailto:timsusi@smkn4bdg.sch.id' },
    { k: 'maps', icon: <Map className="w-5 h-5" />, label: 'Rute Google Maps', value: 'SMKN 4 Bandung', href: 'https://www.google.com/maps/dir/?api=1&destination=SMKN+4+Bandung' },
    { k: 'copy', icon: <Copy className="w-5 h-5" />, label: 'Salin Alamat', value: HQ.addr },
  ];

  const handleContact = (c) => {
    if (c.k === 'copy') {
      if (navigator.clipboard) navigator.clipboard.writeText(c.value);
      setCopiedKey(c.k);
      setTimeout(() => setCopiedKey(''), 2000);
    } else {
      window.open(c.href, '_blank');
    }
  };

  /* ===== ANIMASI ===== */
  useEffect(() => {
    const ctx = gsap.context(() => {
      /* Hero: teks reveal per-baris */
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .fromTo('.hero-label', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.7 })
        .fromTo('.hero-line', { yPercent: 115 }, { yPercent: 0, duration: 1.2, stagger: 0.1 }, '-=0.4')
        .fromTo('.hero-fade', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, '-=0.5');

      /* Angka raksasa parallax */
      gsap.to('.giant-num', {
        y: -120,
        ease: 'none',
        scrollTrigger: { trigger: '.manifesto-section', start: 'top bottom', end: 'bottom top', scrub: 1 },
      });

      /* Manifesto quote reveal */
      gsap.fromTo('.manifesto-quote', { autoAlpha: 0, y: 40 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.manifesto-section', start: 'top 70%' },
      });

      /* Section tim: header + member stagger */
      gsap.fromTo('.team-head > *', { y: 30, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.team-head', start: 'top 80%' },
      });
      gsap.utils.toArray('.team-member').forEach((el, i) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 82%' } });
        tl.fromTo(el, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' })
          .fromTo(el.querySelector('.member-name'),
            { clipPath: 'inset(0 0 100% 0)' },
            { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'power3.out' }, '-=0.5')
          .fromTo(el.querySelector('.member-bio'),
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4');
      });

      /* Values reveal */
      gsap.utils.toArray('.value-card').forEach((el) => {
        gsap.fromTo(el, { y: 50, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%' },
        });
      });

      /* HQ section */
      gsap.fromTo('.hq-block > *', { y: 40, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.hq-block', start: 'top 75%' },
      });
      gsap.to('.bandung-text', {
        y: -60,
        ease: 'none',
        scrollTrigger: { trigger: '.hq-section', start: 'top bottom', end: 'bottom top', scrub: 1 },
      });

      /* Marquee */
      gsap.to('.marquee-track', { xPercent: -50, ease: 'none', duration: 30, repeat: -1 });
    }, rootRef);

    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  /* ===== MODAL KONTAK ===== */
  useEffect(() => {
    if (!contactOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setContactOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const ctx = gsap.context(() => {
      gsap.timeline()
        .fromTo('.contact-backdrop', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
        .fromTo('.contact-card', { y: 40, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, '-=0.15')
        .fromTo('.contact-row', { x: -24, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4, stagger: 0.07 }, '-=0.2');
    }, contactRef);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      ctx.revert();
    };
  }, [contactOpen]);

  return (
    <div ref={rootRef} className="bg-[#f2efe6] text-[#12283c] overflow-hidden">

      {/* ============ 02 · THE WHY (QUOTES) ============ */}
      <section className="relative min-h-screen flex items-center justify-center border-y-2 border-[#12283c]/10 px-6 lg:px-12 bg-[#12283c] text-[#f2efe6]">
        <div className="max-w-[1100px] w-full mx-auto">
          <blockquote className="manifesto-quote text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
            "Produk yang baik
            <br />
            <span className="text-[#f2efe6]/30">tidak lahir di ruang hampa,</span>
            <br />
            ia lahir dari <span className="text-[#e62b2b]">mendengarkan</span>."
          </blockquote>
        </div>
      </section>

      {/* ============ 03 · THE TEAM ============ */}
      <section className="py-24 md:py-32 px-6 lg:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="team-head grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-16 md:mb-24">
            <div className="md:col-span-7">
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9]">
                Orang di Balik<br />
                <span className="text-[#e62b2b]">SUSI</span>.
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {TEAM_MEMBERS.map((m, idx) => (
              <TeamMember key={idx} m={m} idx={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ 06 · HQ ============ */}
      <section className="hq-section relative py-24 md:py-32 px-6 lg:px-12 bg-[#0e2233] text-[#f2efe6] overflow-hidden">
        {/* Tipografi BANDUNG raksasa parallax */}
        <span className="bandung-text absolute bottom-0 left-0 right-0 text-[22vw] font-black leading-[0.8] text-[#f2efe6]/[0.04] select-none pointer-events-none text-center whitespace-nowrap">
          SUSI
        </span>

        <div className="hq-block relative z-10 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] mb-8">
              Dari kelas,<br />
              untuk <span className="text-[#e62b2b]">kota</span>.
            </h2>
            <p className="text-base md:text-lg text-[#f2efe6]/60 leading-relaxed mb-10 max-w-lg">
              Kami bekerja dari SMKN 4 Bandung. Setiap baris kode lahir di sini, di kota yang kami cintai.
            </p>

            <button
              onClick={() => setContactOpen(true)}
              className="group inline-flex items-center gap-4 bg-[#e62b2b] text-white px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-[#f2efe6] hover:text-[#12283c] transition-all duration-300"
            >
              Hubungi Kami
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="lg:col-span-6">
            <div className="relative aspect-square md:aspect-[4/5] bg-[#12283c] border border-white/10 overflow-hidden">
              <div className="absolute inset-0 z-0"><GoogleMapsEmbed lat={HQ.lat} lng={HQ.lng} zoom={15} title="Google Maps SMKN 4 Bandung" /></div>
              <div className="absolute bottom-4 right-4 z-[500] font-mono text-[10px] font-bold text-white/70 bg-[#0e2233]/80 backdrop-blur px-3 py-1.5">
                GOOGLE MAPS
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=SMKN+4+Bandung" target="_blank" rel="noreferrer" className="absolute bottom-4 left-4 z-[500] font-mono text-[10px] font-bold text-white bg-[#0e2233]/80 backdrop-blur px-3 py-1.5 hover:bg-[#e62b2b]">
                BUKA RUTE ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MODAL KONTAK ============ */}
      {contactOpen && (
        <div ref={contactRef} className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="contact-backdrop absolute inset-0 bg-[#0e2233]/90 backdrop-blur-sm" onClick={() => setContactOpen(false)} />
          <div className="contact-card relative w-full max-w-md bg-[#f2efe6] text-[#12283c] border border-[#12283c]/10 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b-2 border-[#12283c]/10">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-[#e62b2b] mb-1">HUBUNGI</p>
                <h3 className="text-2xl font-black tracking-tight">Tim SUSI</h3>
              </div>
              <button
                onClick={() => setContactOpen(false)}
                className="w-10 h-10 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center text-lg font-black hover:bg-[#e62b2b] transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2">
              {CONTACTS.map((c) => (
                <button
                  key={c.k}
                  onClick={() => handleContact(c)}
                  className="contact-row w-full flex items-center gap-4 p-4 text-left hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors group"
                >
                  <span className="w-11 h-11 rounded-full bg-[#e62b2b] text-white flex items-center justify-center shrink-0 group-hover:bg-[#f2efe6] group-hover:text-[#e62b2b] transition-colors">
                    {c.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black">{copiedKey === c.k ? '✓ Tersalin!' : c.label}</p>
                    <p className="font-mono text-[10px] opacity-60 truncate">{c.value}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}