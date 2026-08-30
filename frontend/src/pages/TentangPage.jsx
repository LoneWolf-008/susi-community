import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MessagesSquare, Mails, Map, Copy } from 'lucide-react';

function TeamCard({ m, idx }) {
  const [imgOk, setImgOk] = useState(true);
  const flip = idx % 2 === 1;
  return (
    <div className="team-card group grid grid-cols-1 md:grid-cols-12 border-2 border-black bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[10px_10px_0_0_#FF5733]">
      {/* FOTO / MONOGRAM FALLBACK */}
      <div className={`md:col-span-4 relative border-black border-b-2 md:border-b-0 ${flip ? 'md:order-2 md:border-l-2' : 'md:border-r-2'}`}>
        <div className="relative h-72 md:h-full md:min-h-[340px] bg-black overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="absolute inset-6 border-2 border-dashed border-white/15 rounded-full rot-slow" />
            <span className="text-7xl font-black text-[#FF5733]">{m.i}</span>
          </div>
          {imgOk && (
            <img src={m.foto} alt={m.n} onError={() => setImgOk(false)}
              className="absolute inset-0 w-full h-full object-cover object-top grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
          )}
          <span className="absolute top-3 left-3 bg-black text-white text-[10px] font-mono font-bold px-2 py-1">0{idx + 1}</span>
          <span className="absolute bottom-3 right-3 w-3 h-3 bg-[#FF5733] rotate-45 group-hover:rotate-[135deg] transition-transform duration-500" />
        </div>
      </div>
      {/* INFO */}
      <div className={`md:col-span-8 p-8 md:p-10 flex flex-col justify-center ${flip ? 'md:order-1' : ''}`}>
        <h3 className="team-name text-3xl md:text-5xl font-black tracking-tight pb-2">{m.n}</h3>

        <p className="team-meta text-sm opacity-70 leading-relaxed mt-4 max-w-xl">{m.bio}</p>
        <div className="team-meta flex flex-wrap gap-2 mt-5">
          {m.skill.map((s) => (
            <span key={s} className="text-[10px] font-mono font-bold border-2 border-black px-2 py-1 transition-colors group-hover:border-[#FF5733] group-hover:bg-[#FF5733] group-hover:text-white">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TentangPage() {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const contactRef = useRef(null);

  const TEAM = [
    {
      i: 'HW', n: 'Hasby Wira Al Muflih', r: 'Ketua Tim', foto: '/tim/hasby.jpg',
      bio: 'Menjaga visi, ritme, dan timeline tim tetap waras. Percaya produk yang baik dimulai dari mendengar komunitas.',
      skill: ['Leadership', 'Product Strategy', 'UI Design']
    },
    {
      i: 'EP', n: 'Ezra Putra Arkana', r: 'Developer', foto: '/tim/ezra.jpg',
      bio: 'Fokus pada desain interface untuk kenyamanan pengguna.',
      skill: ['React', 'Tailwind', 'GSAP']
    },
    {
      i: 'DA', n: 'Derien Adelio Rhaivan', r: 'Developer', foto: '/tim/derien.jpg',
      bio: 'Backend yang memastikan data rapi, API stabil, dan tidak ada request yang hilang tanpa jejak.',
      skill: ['Node.js', 'MySQL', 'REST API']
    },
    {
      i: 'KA', n: 'Khalifa Aisy Hafiy', r: 'Developer', foto: '/tim/khalifa.jpg',
      bio: 'Memastikan semua fitur pada website berjalan sesuai dengan rencana.',
      skill: []
    },
  ];

  const HQ = { lat: -6.9075, lng: 107.6190, addr: 'Jl. Kliningan No. 4 Kota Bandung, Jawa Barat, 40132, Indonesia' };

  const CONTACTS = [
    { k: 'wa', icon: <MessagesSquare />, label: 'WhatsApp Tim', value: '+62 812-3456-7890', href: 'https://wa.me/6281234567890' },
    { k: 'mail', icon: <Mails />, label: 'Email Resmi', value: 'timsusi@smkn4bdg.sch.id', href: 'mailto:timsusi@smkn4bdg.sch.id' },
    { k: 'maps', icon: <Map />, label: 'Rute Google Maps', value: 'SMKN 4 Bandung', href: 'https://www.google.com/maps/dir/?api=1&destination=SMKN+4+Bandung' },
    { k: 'copy', icon: <Copy />, label: 'Salin Alamat', value: HQ.addr },
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

  useEffect(() => {
    if (!contactOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setContactOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const ctx = gsap.context(() => {
      gsap.timeline()
        .fromTo('.contact-backdrop', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' })
        .fromTo('.contact-card', { y: 70, autoAlpha: 0, scale: 0.94, rotate: -1.5 }, { y: 0, autoAlpha: 1, scale: 1, rotate: 0, duration: 0.55, ease: 'power3.out' }, '-=0.15')
        .fromTo('.contact-row', { x: -36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, stagger: 0.09, ease: 'power2.out' }, '-=0.25');
    }, contactRef);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      ctx.revert();
    };
  }, [contactOpen]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.tentang-reveal', { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.12, ease: 'power3.out' });

      // ✅ REVEAL PER KARTU: kartu naik → nama wipe clip-path → meta stagger (tanpa potong teks)
      gsap.utils.toArray('.team-card').forEach((card) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 82%' } });
        tl.fromTo(card, { y: 70, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out' })
          .fromTo(card.querySelector('.team-name'), { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'power3.out' }, '-=0.45')
          .fromTo(card.querySelectorAll('.team-meta'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.12 }, '-=0.55');
      });

      gsap.fromTo('.hq-card', { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.hq-card', start: 'top 85%' } });
    }, ref);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: false }).setView([HQ.lat, HQ.lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    L.marker([HQ.lat, HQ.lng], {
      icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;background:#FF5733;border:2px solid #000;transform:rotate(45deg);box-shadow:2px 2px 0 rgba(0,0,0,.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).addTo(map);
    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, []);


  return (
    <div ref={ref} className="bg-white text-black pt-32">
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 18s linear infinite; }
        @keyframes rotSlow { to { transform: rotate(360deg); } }
        .rot-slow { animation: rotSlow 14s linear infinite; }
      `}</style>

      {/* HEADER */}
      <section className="px-6 lg:px-12 py-20 border-b-2 border-black">
        <div className="max-w-[1440px] mx-auto flex items-end justify-between flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-black/50 font-bold mb-4">Tentang Kami</p>
            <h1 className="tentang-reveal text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-4">Tim SUSI<span className="text-[#FF5733]">.</span></h1>
            <p className="tentang-reveal text-sm md:text-base opacity-10 max-w-xl leading-relaxed">Kami adalah siswa SMKN 4 Bandung yang tergerak melihat komunitas lokal kesulitan mengakses teknologi, sementara anak IT bingung cari portofolio nyata. Lewat SUSI Community, kami menjembatani keduanya untuk dalam 1 platform yang simpel, dan bermanfaat. Misi kami adalah: membantu komunitas sadar akan dunia digital sekaligus wadahi talenta IT muda untuk bertumbuh!</p>
          </div>

        </div>
      </section>

      {/* MARQUEE */}
      <div className="bg-[#FF5733] text-white border-b-2 border-black overflow-hidden py-3">
        <div className="marquee-track flex w-max whitespace-nowrap">
          {[0, 1].map((k) => (
            <span key={k} className="text-xs font-mono font-bold tracking-widest">
              {Array(6).fill('BUILD THE FUTURE • SUSI COMMUNITY • KOMUNITAS × TALENTA • ').map((s, i) => (<span key={i}>{s}</span>))}
            </span>
          ))}
        </div>
      </div>

      {/* TIM — STACKED DOSSIER CARDS */}
      <section className="px-6 lg:px-12 py-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <h2 className="tentang-reveal text-3xl md:text-5xl font-black tracking-tight">Our Team<span className="text-[#FF5733]">.</span></h2>

          </div>
          <div className="space-y-8">
            {TEAM.map((m, idx) => (<TeamCard key={idx} m={m} idx={idx} />))}
          </div>
        </div>
      </section>

      {/* MARKAS — BOARDING PASS + MINI MAP */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="hq-card grid grid-cols-1 lg:grid-cols-2 border-2 border-black bg-black text-white shadow-[10px_10px_0_0_#FF5733]">
            <div className="p-10 lg:p-14">
              <p className="text-[10px] font-mono font-bold text-[#FF5733] uppercase tracking-widest mb-3">TEMUI KAMI DI:</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-1">SMKN 4 Bandung<span className="text-[#FF5733]">.</span></h2><br />
              <div className="space-y-3 mb-8">
                <div className="flex justify-between gap-4 border-b border-white/15 pb-2">
                  <span className="text-[9px] font-mono opacity-50">ALAMAT</span>
                  <span className="text-xs font-bold text-right">{HQ.addr}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/15 pb-2">
                  <span className="text-[9px] font-mono opacity-50">KOORDINAT</span>
                  <span className="text-xs font-mono font-bold">{HQ.lat.toFixed(4)}, {HQ.lng.toFixed(4)}</span>
                </div>

              </div>

              <div className="flex gap-3 flex-wrap">
                <button onClick={() => setContactOpen(true)} className="flex-1 border-2 border-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
                  ✆ Hubungi Kami
                </button>

              </div>
            </div>
            <div className="relative h-80 lg:h-auto border-t-2 lg:border-t-0 lg:border-l-2 border-white/20">
              <div className="absolute inset-0 z-0"><div ref={mapRef} className="w-full h-full" /></div>
              <span className="absolute top-3 left-3 z-10 bg-white text-black text-[9px] font-mono font-bold px-2 py-1 border-2 border-black">📍 LOKASI KAMI</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== OVERLAY HUBUNGI KAMI ===== */}
      {contactOpen && (
        <div ref={contactRef} className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="contact-backdrop absolute inset-0 bg-black/80" onClick={() => setContactOpen(false)} />
          <div className="contact-card relative w-full max-w-md bg-white border-2 border-black shadow-[10px_10px_0_0_#FF5733]">
            <div className="flex items-center justify-between p-6 border-b-2 border-black bg-black text-white">
              <div>

                <h3 className="text-xl font-black tracking-tight">Hubungi Kami</h3>
              </div>
              <button onClick={() => setContactOpen(false)} className="w-10 h-10 border-2 border-white flex items-center justify-center text-xl font-black hover:bg-[#FF5733] hover:border-[#FF5733] transition-colors">×</button>
            </div>

            <div className="p-6 space-y-3">
              {CONTACTS.map((c) => (
                <button
                  key={c.k}
                  onClick={() => handleContact(c)}
                  className="contact-row w-full flex items-center gap-4 border-2 border-black p-4 text-left group hover:bg-black hover:text-white transition-colors"
                >
                  <span className="w-11 h-11 bg-[#FF5733] text-white flex items-center justify-center text-lg shrink-0 group-hover:rotate-12 transition-transform">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black">{copiedKey === c.k ? '✓ Tersalin!' : c.label}</p>
                    <p className="text-[10px] font-mono opacity-60 truncate">{c.value}</p>
                  </div>
                  <span className="text-lg font-black group-hover:translate-x-1.5 transition-transform">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}