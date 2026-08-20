import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import L from 'leaflet';                
import 'leaflet/dist/leaflet.css'; 

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* ============ DATA ============ */
const FLOW_STEPS = [
  { num: '01', title: 'Komunitas cerita masalahnya', sub: 'Ceritakan Masalah Yang Kamu Hadapi', tag: 'START' },
  { num: '02', title: 'Talenta melihat & melamar', sub: 'Memilih masalah yang ingin dibantu', tag: '02' },
  { num: '03', title: 'Komunitas pilih orangnya', sub: 'Sepakati apa yang akan dikerjakan', tag: '03' },
  { num: '04', title: 'Talenta bilang setuju', sub: 'Baru pekerjaan boleh dimulai', tag: '04' },
  { num: '05', title: 'Pekerjaan dikerjakan', sub: 'Ngobrol lewat WhatsApp, bukan di sistem', tag: '05' },
  { num: '06', title: 'Talenta bilang sudah selesai', sub: 'Menunggu komunitas membenarkan', tag: '06' },
  { num: '07', title: 'Komunitas membenarkan', sub: 'Sambil kasih ulasan singkat', tag: '07'},
  { num: '08', title: 'Nama baik talenta bertambah', sub: 'Karena kedua pihak sama-sama setuju', tag: 'END', success: true },
];

const AUTH_ROLES = [
  { num: '01', id: 'requester', label: 'Komunitas', desc: 'Pengurus RT/RW, PKK, UMKM, karang taruna, atau kepanitiaan yang punya persoalan sehari-hari.', field: 'Nama Komunitas / Usaha', ph: 'Mis. PKK RW 03, Warung Bu Ani', fallback: 'Pengurus PKK RW 03' },
  { num: '02', id: 'talent', label: 'Talenta', desc: 'Mahasiswa, fresh graduate, career switcher, atau engineer yang ingin pengalaman proyek nyata.', field: 'Keahlian Utama', ph: 'Mis. React, Node.js, UI/UX', fallback: 'Derien Adelio' },
  { num: '03', id: 'agensusi', label: 'AgenSUSI', desc: 'Anggota inti SUSI yang melakukan kunjungan lapangan dan mencatat kebutuhan komunitas.', field: 'Wilayah Operasi', ph: 'Mis. Bandung Utara', fallback: 'Hasby Wira Al Muflih' },
  { num: '04', id: 'admin', label: 'Admin', desc: 'Pengelola platform: moderasi, penanganan sengketa, dan keberlanjutan sistem.', field: 'Kode Akses', ph: 'Kode internal tim SUSI', fallback: 'Admin SUSI' },
];

/* ============ FLOW SECTION ============ */
function FlowSection({ navigateTo }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const endRef = useRef(null);

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
          <p className="text-[10px] font-mono opacity-40 pb-2">▼ IKUTI GARISNYA SAMPAI SELESAI</p>
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
              {/* NODE: tepat di tengah garis */}
              <div className={`journey-node absolute left-4 md:left-1/2 md:-ml-3 top-10 w-6 h-6 border-2 border-black bg-white z-10 ${s.dashed ? 'dashed border-dashed' : ''}`} />

              {/* LENGAN PENGHUBUNG: node ↔ konten, sejajar tengah node */}
              <div className={`journey-tick hidden md:block absolute top-[51px] h-0.5 w-12 bg-[#FF5733] ${leftSide ? 'right-1/2 from-right' : 'left-1/2 from-left'}`} />

              {/* KONTEN */}
              <div className={`journey-content ${leftSide ? 'md:col-start-1 md:text-right' : 'md:col-start-2'}`}>
                <span className="inline-block text-[10px] font-mono font-bold border-2 border-black bg-white px-3 py-1 mb-4">{s.tag}</span>
                <h3 className="text-3xl md:text-4xl lg:text-5xl font-black leading-[0.95] tracking-tight mb-4">{s.title}</h3>
                <p className="text-base md:text-lg opacity-60 mb-5 leading-relaxed">{s.sub}</p>
                <p className={`text-xs md:text-sm font-mono opacity-70 leading-relaxed border-t-2 border-black/20 pt-4 max-w-md ${leftSide ? 'md:ml-auto' : ''}`}>{s.detail}</p>
              </div>

              {/* NOMOR: penyeimbang simetris di sisi berlawanan */}
              <div className={`hidden md:flex items-center ${leftSide ? 'md:col-start-2 md:row-start-1 justify-start pl-8' : 'md:col-start-1 md:row-start-1 justify-end pr-8'}`}>
                <span className="journey-num text-[10rem] font-black leading-none text-black/5">{s.num}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={endRef} className="min-h-screen flex items-center justify-center px-6 relative">
        <div className="end-content text-center max-w-5xl">
          <p className="fd fd-soft text-xs font-mono font-bold uppercase tracking-[0.4em] mb-8 opacity-60">08 / 08 — Verifikasi Lengkap</p>
          <h3 className="fd fd-invert text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-8">Nama baik tumbuh.<br />Siklus berulang<span className="text-[#FF5733]">.</span></h3>
          <p className="fd fd-soft text-base md:text-xl opacity-60 mb-12 max-w-2xl mx-auto leading-relaxed">Setiap proyek selesai menurunkan reputasi — komunitas berikutnya cukup melihat rekam jejak, bukan menebak-nebak.</p>
          <button onClick={() => navigateTo('dashboard')} className="fd fd-cta bg-black text-white px-10 py-5 text-sm uppercase tracking-wider font-bold hover:bg-[#FF5733] hover:text-white transition-colors">Mulai Langkah 01 →</button>
        </div>
      </div>
    </section>
  );
}

/* ============ MAGNETIC BUTTON ============ */
function Magnetic({ children, className = '', onClick, strength = 0.35 }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    gsap.to(ref.current, { x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength, duration: 0.3 });
  };
  const onLeave = () => gsap.to(ref.current, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick} className={`inline-block ${className}`}>
      {children}
    </div>
  );
}

/* ============ CUSTOM CURSOR ============ */
function Cursor() {
  const ring = useRef(null);
  const dot = useRef(null);
  useEffect(() => {
    const xTo = gsap.quickTo(ring.current, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(ring.current, 'y', { duration: 0.5, ease: 'power3.out' });
    const dxTo = gsap.quickTo(dot.current, 'x', { duration: 0.08 });
    const dyTo = gsap.quickTo(dot.current, 'y', { duration: 0.08 });
    const move = (e) => { xTo(e.clientX); yTo(e.clientY); dxTo(e.clientX); dyTo(e.clientY); };
    const over = (e) => { if (e.target.closest('a,button,[data-hover]')) gsap.to(ring.current, { scale: 2.2, backgroundColor: 'rgba(255,87,51,0.15)', duration: 0.3 }); };
    const out = (e) => { if (e.target.closest('a,button,[data-hover]')) gsap.to(ring.current, { scale: 1, backgroundColor: 'transparent', duration: 0.3 }); };
    window.addEventListener('mousemove', move);
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    return () => { window.removeEventListener('mousemove', move); document.removeEventListener('mouseover', over); document.removeEventListener('mouseout', out); };
  }, []);
  return (
    <>
      <div ref={ring} className="fixed left-0 top-0 w-10 h-10 border-2 border-black rounded-full pointer-events-none z-[300] -ml-5 -mt-5 hidden md:block" />
      <div ref={dot} className="fixed left-0 top-0 w-2 h-2 bg-[#FF5733] rounded-full pointer-events-none z-[300] -ml-1 -mt-1 hidden md:block" />
    </>
  );
}

/* ============ NAVIGATION ============ */
function Navigation({ currentPage, navigateTo, goToSection, menuOpen, setMenuOpen, user, onLogout }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav className={`fixed z-[100] left-1/2 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? 'top-4 w-[min(1100px,94%)] h-16 rounded-full bg-white/60 backdrop-blur-2xl border border-black/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] scale-[0.97]'
          : 'top-0 w-full h-20 rounded-none bg-white border-b-2 border-black scale-100'
      }`}>
        <div className="h-full px-5 md:px-8 flex items-center justify-between">
          <button onClick={() => navigateTo('home')} className={`font-black tracking-tighter hover:text-[#FF5733] transition-all duration-500 ${scrolled ? 'text-2xl' : 'text-3xl'}`}>
            SUSI<span className="text-[#FF5733]">.</span>
          </button>

          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => goToSection('alur')} className="text-xs uppercase tracking-[0.25em] font-bold hover:text-[#FF5733] transition-colors">Cara Kerja</button>
            <button onClick={() => goToSection('fitur')} className="text-xs uppercase tracking-[0.25em] font-bold hover:text-[#FF5733] transition-colors">Fitur</button>
            <button onClick={() => navigateTo('tentang')} className={`text-xs uppercase tracking-[0.25em] font-bold transition-colors ${currentPage === 'tentang' ? 'text-[#FF5733]' : 'hover:text-[#FF5733]'}`}>Tentang Kami</button>

            {user ? (
              <div className="flex items-center gap-3">
                <button onClick={() => navigateTo('dashboard')} className="flex items-center gap-2 border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors">
                  <span className="w-5 h-5 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user.name.charAt(0).toUpperCase()}</span>
                  <span className="text-xs font-bold">{user.name.split(' ')[0]}</span>
                </button>
                <button onClick={onLogout} className="text-xs font-mono font-bold hover:text-[#FF5733] transition-colors">KELUAR</button>
              </div>
            ) : (
              <Magnetic>
                <button onClick={() => navigateTo('dashboard')} className={`text-xs uppercase tracking-wider font-bold transition-all duration-500 ${
                  scrolled ? 'bg-black text-white hover:bg-[#FF5733] px-6 py-2.5 rounded-full' : 'bg-black text-white hover:bg-[#FF5733] px-8 py-3 rounded-none'
                }`}>Mulai →</button>
              </Magnetic>
            )}
          </div>

          <button className="lg:hidden w-10 h-10 flex flex-col justify-center items-center gap-1.5" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={`block w-6 h-0.5 bg-black transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-black transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-black transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      <div className={`lg:hidden fixed z-[99] left-1/2 -translate-x-1/2 w-[94%] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        menuOpen ? 'top-24 opacity-100 scale-100' : 'top-16 opacity-0 scale-95 pointer-events-none'
      } rounded-3xl bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden`}>
        <div className="px-8 py-6 flex flex-col gap-4">
          <button onClick={() => { goToSection('alur'); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 border-b border-black/10 hover:text-[#FF5733] transition-colors">Cara Kerja</button>
          <button onClick={() => { goToSection('fitur'); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 border-b border-black/10 hover:text-[#FF5733] transition-colors">Fitur</button>
          <button onClick={() => { navigateTo('tentang'); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 hover:text-[#FF5733] transition-colors">Tentang</button>
          {user && <button onClick={() => { onLogout(); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 text-[#FF5733]">Keluar</button>}
        </div>
      </div>
    </>
  );
}

/* ============ DASHBOARD AGEN SUSI (LIAISON) ============ */
function DashboardLiaison({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [visitFilter, setVisitFilter] = useState('SEMUA');
  const [visits, setVisits] = useState([
    { id: 1, comm: 'PKK RW 03 Cijerah', sec: 'BARAT–SELATAN', date: 'HARI INI', time: '09.00', addr: 'Jl. Cijerah II No. 12', lat: -6.9210, lng: 107.5900, status: 'DIRENCANAKAN', note: 'Ibu ketua ingin konsultasi rekap iuran warga.' },
    { id: 2, comm: 'Karang Taruna Cibuntu', sec: 'BARAT–SELATAN', date: 'HARI INI', time: '13.30', addr: 'Sekretariat KT, Jl. Cibuntu Raya', lat: -6.9280, lng: 107.5820, status: 'BERLANGSUNG', note: 'Survei kebutuhan website galeri kegiatan pemuda.' },
    { id: 3, comm: 'Paguyuban Pedagang Pasar', sec: 'TIMUR–UTARA', date: 'KEMARIN', time: '10.00', addr: 'Blok C Pasar Antapani', lat: -6.9020, lng: 107.6600, status: 'TERDATA', note: 'Katalog produk online. Sudah masuk katalog kebutuhan.' },
    { id: 4, comm: 'Posyandu Melati', sec: 'TIMUR–UTARA', date: 'BESOK', time: '08.00', addr: 'Posyandu Melati, Jl. Antapani Tengah', lat: -6.9080, lng: 107.6680, status: 'DIRENCANAKAN', note: 'Kader ingin data penimbangan tidak manual.' },
  ]);
  const [form, setForm] = useState({ nama: '', tipe: 'PKK', leader: '', issue: '', cat: 'PENCATATAN', addr: '' });
  const [coords, setCoords] = useState(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifs, setNotifs] = useState([
    { id: 1, type: 'kunjungan', title: 'Agenda hari ini: 2 kunjungan', sub: 'PKK RW 03 Cijerah · 09.00', read: false },
    { id: 2, type: 'intake', title: 'Kebutuhan Anda terdata di katalog', sub: 'Katalog UMKM · Paguyuban Pedagang', read: false },
    { id: 3, type: 'sistem', title: 'Laporan mingguan siap', sub: 'Unduh di tab Laporan', read: true },
  ]);
  const formMapEl = useRef(null); const formMapInst = useRef(null); const formMarker = useRef(null);
  const areaMapEl = useRef(null); const areaMapInst = useRef(null); const areaMarkers = useRef(null);
  const rootRef = useRef(null);

  const NOTIF_META = {
    kunjungan: { c: '#FF5733', l: 'KUNJUNGAN' },
    intake: { c: '#0E7C66', l: 'INTAKE' },
    sistem: { c: '#9CA3AF', l: 'SISTEM' },
  };
  const unread = notifs.filter((n) => !n.read).length;
  const markAll = () => setNotifs(notifs.map((n) => ({ ...n, read: true })));
  const markOne = (id) => setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const ACCOMPANIED = [
    { n: 'PKK RW 05', v: '12 AGU 2026', need: 'Rekap Iuran Digital', s: 'TERHUBUNG' },
    { n: 'KT Mekar', v: '08 AGU 2026', need: 'Website Galeri', s: 'PROYEK BERJALAN' },
    { n: 'Paguyuban Pedagang', v: '02 AGU 2026', need: 'Katalog UMKM', s: 'TERDATA' },
  ];

  useEffect(() => {
    const onClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (notifOpen) gsap.fromTo('.notif-panel', { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
  }, [notifOpen]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => {
        const t = +el.dataset.target; const o = { val: 0 };
        gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } });
      });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, sent]);

  /* ===== MAP FORM (CATAT) ===== */
  useEffect(() => {
    if (tab !== 'catat' || sent || !formMapEl.current || formMapInst.current) return;
    const map = L.map(formMapEl.current).setView([-6.9147, 107.6096], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    map.on('click', (e) => placeFormMarker(e.latlng.lat, e.latlng.lng));
    formMapInst.current = map;
    return () => { map.remove(); formMapInst.current = null; formMarker.current = null; };
  }, [tab, sent]);

  /* ===== MAP WILAYAH ===== */
  useEffect(() => {
    if (tab !== 'map' || !areaMapEl.current || areaMapInst.current) return;
    const map = L.map(areaMapEl.current).setView([-6.9147, 107.6096], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    areaMarkers.current = L.layerGroup().addTo(map);
    areaMapInst.current = map;
    return () => { map.remove(); areaMapInst.current = null; areaMarkers.current = null; };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'map' || !areaMarkers.current) return;
    areaMarkers.current.clearLayers();
    const makeIcon = (bg, border, label) => L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;background:${bg};border:2px solid ${border};transform:rotate(45deg);display:flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 rgba(0,0,0,.4)"><span style="transform:rotate(-45deg);font-family:monospace;font-weight:700;font-size:10px;color:${bg === '#fff' ? '#000' : '#fff'}">${label}</span></div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
    visits.forEach((v) => {
      const icon = v.status === 'TERDATA' ? makeIcon('#0E7C66', '#000', v.comm.charAt(0))
        : v.status === 'BERLANGSUNG' ? makeIcon('#FDE047', '#000', v.comm.charAt(0))
        : makeIcon('#fff', '#000', v.comm.charAt(0));
      const m = L.marker([v.lat, v.lng], { icon }).addTo(areaMarkers.current);
      m.on('click', () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`, '_blank'));
    });
  }, [tab, visits]);

  const placeFormMarker = (lat, lng) => {
    if (!formMapInst.current) return;
    if (formMarker.current) formMarker.current.setLatLng([lat, lng]);
    else formMarker.current = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', html: '<div style="width:20px;height:20px;background:#FF5733;border:2px solid #000;transform:rotate(45deg);box-shadow:2px 2px 0 rgba(0,0,0,.4)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
    }).addTo(formMapInst.current);
    setCoords({ lat, lng });
  };

  const grabGPS = () => {
    setGpsMsg('MENCARI GPS...');
    if (!navigator.geolocation) { setGpsMsg('GPS TIDAK DIDUKUNG — KLIK MAP MANUAL'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { placeFormMarker(p.coords.latitude, p.coords.longitude); setGpsMsg('GPS TERTANGKAP ✓'); },
      () => { placeFormMarker(-6.9147, 107.6096); setGpsMsg('GPS GAGAL — TITIK TENGAH BANDUNG. KLIK MAP UNTUK GESER.'); },
    );
  };

  const quadrantOf = (loc) => `${loc.lng < 107.6191 ? 'BARAT' : 'TIMUR'}–${loc.lat > -6.9175 ? 'UTARA' : 'SELATAN'}`;
  const openRoute = (v) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`, '_blank');
  const setVisitStatus = (id, status) => setVisits((v) => v.map((x) => (x.id === id ? { ...x, status } : x)));
  const recordResult = (v) => {
    setForm((f) => ({ ...f, nama: v.comm, addr: v.addr }));
    setCoords({ lat: v.lat, lng: v.lng });
    setSent(false);
    setTab('catat');
  };
  const submitIntake = () => {
    if (!form.nama.trim() || !form.issue.trim() || !coords) return;
    setVisits((v) => [...v, { id: Date.now(), comm: form.nama, sec: quadrantOf(coords), date: 'HARI INI', time: 'SEKARANG', addr: form.addr || '—', lat: coords.lat, lng: coords.lng, status: 'TERDATA', note: form.issue }]);
    setSent(true);
  };

  const visitBadge = (s) => {
    const m = { DIRENCANAKAN: 'bg-white text-black border-2 border-black', BERLANGSUNG: 'bg-yellow-300 text-black', TERDATA: 'bg-[#0E7C66] text-white' };
    return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
  };
  const accBadge = (s) => {
    const m = { TERHUBUNG: 'bg-[#0E7C66] text-white', 'PROYEK BERJALAN': 'bg-yellow-300 text-black', TERDATA: 'bg-black text-white' };
    return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
  };

  const first = (user?.name || 'Agen').split(' ')[0];
  const NAV = [
    { id: 'beranda', n: '01', l: 'BERANDA' },
    { id: 'kunjungan', n: '02', l: 'KUNJUNGAN' },
    { id: 'catat', n: '03', l: 'CATAT KEBUTUHAN' },
    { id: 'map', n: '04', l: 'MAP WILAYAH' },
    { id: 'laporan', n: '05', l: 'LAPORAN' },
  ];
  const agenda = visits.filter((v) => v.date === 'HARI INI' && v.status !== 'TERDATA');
  const filteredVisits = visitFilter === 'SEMUA' ? visits : visits.filter((v) => v.status === visitFilter);

  return (
    <div ref={rootRef} className="bg-[#F4F4F2] text-black min-h-screen">
      {/* TOPBAR */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-white border-b-2 border-black z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('home')} className="text-2xl font-black tracking-tighter hover:text-[#FF5733] transition-colors shrink-0">
            SUSI<span className="text-[#FF5733]">.</span>
          </button>
          <div className="flex-1" />
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className={`relative w-10 h-10 border-2 border-black flex items-center justify-center transition-colors ${notifOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="w-5 h-5">
                <path d="M12 3v2" /><path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3v-4z" /><path d="M10 20h4" />
              </svg>
              {unread > 0 && (
                <>
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#FF5733] animate-ping" />
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-[#FF5733] text-white text-[9px] font-black flex items-center justify-center border-2 border-black px-0.5">{unread}</span>
                </>
              )}
            </button>
            {notifOpen && (
              <div className="notif-panel absolute right-0 top-12 w-[340px] md:w-[380px] bg-white border-2 border-black shadow-[6px_6px_0_0_#000] z-[60]">
                <div className="flex items-center justify-between p-4 border-b-2 border-black">
                  <div>
                    <p className="text-sm font-black">NOTIFIKASI</p>
                    <p className="text-[9px] font-mono opacity-50">{unread} BELUM DIBACA</p>
                  </div>
                  <button onClick={markAll} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">TANDAI SEMUA</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => markOne(n.id)} className={`w-full text-left p-4 border-b-2 border-black/10 last:border-b-0 flex gap-3 transition-colors ${n.read ? 'opacity-50 hover:opacity-80' : 'bg-[#FF5733]/5 hover:bg-[#FF5733]/10'}`}>
                      <span className="w-2 h-2 mt-1.5 shrink-0 rotate-45" style={{ background: NOTIF_META[n.type].c }} />
                      <div className="flex-1 min-w-0">
                        <span className="inline-block text-[8px] font-mono font-bold px-1.5 py-0.5 text-white mb-0.5" style={{ background: NOTIF_META[n.type].c }}>{NOTIF_META[n.type].l}</span>
                        <p className="text-xs font-black leading-snug">{n.title}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{n.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-2 border-black px-3 py-2 bg-white">
            <span className="w-6 h-6 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-black">{first}</p>
              <p className="text-[9px] font-mono text-[#FF5733] font-bold mt-0.5">AGEN SUSI</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">KELUAR</button>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white border-r-2 border-black z-40 flex-col justify-between">
        <div className="p-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dasbor Lapangan</p>
          <div className="space-y-2">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setTab(n.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${tab === n.id ? 'bg-black text-white shadow-[4px_4px_0_0_#FF5733]' : 'hover:bg-black/5'}`}>
                <span className={`text-[10px] font-mono font-bold ${tab === n.id ? 'text-[#FF5733]' : 'opacity-40'}`}>{n.n}</span>
                <span className="text-xs font-black uppercase tracking-wider">{n.l}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t-2 border-black">
          <p className="text-[10px] font-mono opacity-50 leading-relaxed">F2 · ASSISTED INTAKE<br />WILAYAH: KOTA BANDUNG</p>
        </div>
      </aside>

      {/* NAV MOBILE */}
      <div className="lg:hidden fixed top-20 left-0 right-0 z-40 bg-white border-b-2 border-black overflow-x-auto">
        <div className="flex px-4 py-3 gap-2 w-max">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`shrink-0 px-4 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${tab === n.id ? 'bg-black text-white border-black' : 'border-black/20'}`}>
              {n.l}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="pt-40 lg:pt-28 lg:pl-64 pb-16">
        <div className="px-5 lg:px-10 max-w-[1200px]">

          {/* ===== TAB: BERANDA ===== */}
          {tab === 'beranda' && (
            <>
              <div className="dash-item border-2 border-black bg-white p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#FF5733]">F2 · ASSISTED INTAKE</span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, Agen {first}.</h1>
                  <p className="text-sm opacity-60 max-w-xl leading-relaxed">{agenda.length} agenda kunjungan hari ini. Jemput bola — datangkan SUSI ke komunitas yang terkendala perangkat & pengetahuan.</p>
                </div>
                <button onClick={() => { setSent(false); setTab('catat'); }} className="bg-[#FF5733] text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-black transition-all">
                  + Catat Kebutuhan
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black border-2 border-black mb-6">
                {[
                  { t: 23, l: 'Kunjungan bulan ini' },
                  { t: 19, l: 'Kebutuhan terdata' },
                  { t: 11, l: 'Terhubung ke talenta' },
                  { t: 8, l: 'Komunitas didampingi' },
                ].map((s, i) => (
                  <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                    <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8">
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <div className="flex justify-between items-start mb-5">
                      <h3 className="text-xl font-black">Agenda Hari Ini</h3>
                      <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-1">{agenda.length} KUNJUNGAN</span>
                    </div>
                    <div className="space-y-4">
                      {agenda.map((v) => (
                        <div key={v.id} className="border-2 border-black/15 hover:border-black p-5 transition-colors">
                          <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-black font-mono">{v.time}</span>
                              <h4 className="font-black">{v.comm}</h4>
                            </div>
                            {visitBadge(v.status)}
                          </div>
                          <p className="text-[10px] font-mono opacity-50 mb-2">📍 {v.addr} · SEKTOR {v.sec}</p>
                          <p className="text-xs opacity-60 mb-4">{v.note}</p>
                          <div className="flex gap-2 flex-wrap">
                            {v.status === 'DIRENCANAKAN' && (
                              <button onClick={() => setVisitStatus(v.id, 'BERLANGSUNG')} className="flex-1 bg-black text-white py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5733] transition-colors">Mulai Kunjungan →</button>
                            )}
                            {v.status === 'BERLANGSUNG' && (
                              <button onClick={() => recordResult(v)} className="flex-1 bg-[#0E7C66] text-white py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Catat Hasil →</button>
                            )}
                            <button onClick={() => openRoute(v)} className="flex-1 border-2 border-black py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"> Rute</button>
                          </div>
                        </div>
                      ))}
                      {agenda.length === 0 && <p className="text-center text-xs font-mono opacity-50 py-6">TIDAK ADA AGENDA HARI INI.</p>}
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-6">
                  <div className="dash-item border-2 border-black bg-black text-white p-7">
                    <span className="text-[10px] font-mono font-bold text-[#FF5733]">TARGET BULANAN</span>
                    <h3 className="text-xl font-black mt-1 mb-5">Progres Agen</h3>
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>KUNJUNGAN</span><span>23 / 30</span></div>
                    <div className="h-3 bg-white/15 border-2 border-white/30 mb-5"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '76%' }} /></div>
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>INTAKE TERDATA</span><span>19 / 25</span></div>
                    <div className="h-3 bg-white/15 border-2 border-white/30"><div className="bar-h h-full bg-[#0E7C66]" style={{ width: '76%' }} /></div>
                  </div>
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <h3 className="text-xl font-black mb-4">Tips Lapangan</h3>
                    <p className="text-sm opacity-70 leading-relaxed">Catat masalah dengan <span className="font-black">bahasa warga</span>, bukan istilah teknis. Contoh: "iuran sering hilang" — bukan "butuh sistem database".</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: KUNJUNGAN ===== */}
          {tab === 'kunjungan' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Kunjungan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">DIRENCANAKAN → BERLANGSUNG → TERDATA</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['SEMUA', 'DIRENCANAKAN', 'BERLANGSUNG', 'TERDATA'].map((s) => (
                    <button key={s} onClick={() => setVisitFilter(s)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${visitFilter === s ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {filteredVisits.map((v) => (
                  <div key={v.id} className="dash-item border-2 border-black bg-white p-6">
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
                      <div>
                        <h4 className="font-black text-lg">{v.comm}</h4>
                        <p className="text-[10px] font-mono opacity-50 mt-1">{v.date} · {v.time} · 📍 {v.addr} · SEKTOR {v.sec}</p>
                      </div>
                      {visitBadge(v.status)}
                    </div>
                    <p className="text-xs opacity-60 mb-4">{v.note}</p>
                    <div className="flex gap-2 flex-wrap">
                      {v.status === 'DIRENCANAKAN' && (
                        <button onClick={() => setVisitStatus(v.id, 'BERLANGSUNG')} className="flex-1 bg-black text-white py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5733] transition-colors">Mulai Kunjungan →</button>
                      )}
                      {v.status === 'BERLANGSUNG' && (
                        <button onClick={() => recordResult(v)} className="flex-1 bg-[#0E7C66] text-white py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Catat Hasil →</button>
                      )}
                      {v.status === 'TERDATA' && (
                        <span className="flex-1 text-center border-2 border-black/20 py-2.5 text-[10px] font-mono font-bold opacity-60">MASUK KATALOG KEBUTUHAN ✓</span>
                      )}
                      <button onClick={() => openRoute(v)} className="flex-1 border-2 border-black py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">🧭 Rute</button>
                    </div>
                  </div>
                ))}
                {filteredVisits.length === 0 && <p className="dash-item border-2 border-black bg-white p-8 text-center text-xs font-mono opacity-50">TIDAK ADA KUNJUNGAN DENGAN STATUS INI.</p>}
              </div>
            </>
          )}

          {/* ===== TAB: CATAT KEBUTUHAN ===== */}
          {tab === 'catat' && (
            sent ? (
              <div className="dash-item border-2 border-black bg-white p-14 text-center max-w-2xl mx-auto">
                <div className="inline-flex w-24 h-24 bg-[#0E7C66] text-white items-center justify-center text-5xl font-black mb-6">✓</div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Kebutuhan terdata.</h1>
                <p className="text-sm opacity-60 leading-relaxed mb-8">Masuk katalog kebutuhan terbuka dengan label <span className="font-mono font-black bg-black text-white px-2 py-0.5">SUMBER: ASSISTED</span>. Talenta akan melihat & melamar — komunitas tidak perlu pegang HP.</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={() => { setSent(false); setForm({ nama: '', tipe: 'PKK', leader: '', issue: '', cat: 'PENCATATAN', addr: '' }); setCoords(null); setGpsMsg(''); }} className="bg-[#FF5733] text-white px-8 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">+ Catat Lagi</button>
                  <button onClick={() => setTab('kunjungan')} className="border-2 border-black px-8 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Ke Kunjungan →</button>
                </div>
              </div>
            ) : (
              <>
                <div className="dash-item mb-6">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Catat Kebutuhan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">FORM ASSISTED INTAKE — ATAS NAMA KOMUNITAS</p>
                </div>
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-6 space-y-6">
                    <div className="dash-item border-2 border-black bg-white p-7 space-y-5">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">A · DATA KOMUNITAS</span>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Nama Komunitas</label>
                        <input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] bg-transparent" placeholder="Mis. PKK RW 03 Cijerah" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Jenis Komunitas</label>
                        <div className="flex flex-wrap gap-1">
                          {['PKK', 'RT/RW', 'KARANG TARUNA', 'UMKM', 'LAINNYA'].map((t) => (
                            <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tipe: t }))} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${form.tipe === t ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{t}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Nama Pengurus (PIC)</label>
                        <input value={form.leader} onChange={(e) => setForm((f) => ({ ...f, leader: e.target.value }))} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] bg-transparent" placeholder="Mis. Ibu Siti Aminah" />
                      </div>
                    </div>
                    <div className="dash-item border-2 border-black bg-white p-7 space-y-5">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">B · MASALAH (BAHASA WARGA)</span>
                      <textarea value={form.issue} onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value }))} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] bg-transparent h-28 resize-none" placeholder='Contoh: "iuran warga sering hilang, susah direkap tiap bulan"' />
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Kategori Kebutuhan</label>
                        <div className="flex flex-wrap gap-1">
                          {['PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                            <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, cat: c }))} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${form.cat === c ? 'bg-[#FF5733] text-white border-[#FF5733]' : 'border-black/20 hover:border-black'}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-6">
                    <div className="dash-item border-2 border-black bg-white p-7">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">C · LOKASI KOMUNITAS</span>
                      <div className="flex gap-2 my-4">
                        <button type="button" onClick={grabGPS} className="flex-1 bg-black text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#0E7C66] transition-colors">📡 Gunakan GPS Saya</button>
                      </div>
                      {gpsMsg && <p className="text-[9px] font-mono font-bold mb-3">{gpsMsg}</p>}
                      <div className="relative z-0 border-2 border-black h-[280px] mb-4">
                        <div ref={formMapEl} className="w-full h-full" />
                      </div>
                      <p className="text-[10px] font-mono font-bold bg-black text-white inline-block px-2 py-1 mb-4">{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} · ${quadrantOf(coords)}` : 'BELUM ADA TITIK — GPS / KLIK MAP'}</p>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Alamat / Patokan</label>
                        <input value={form.addr} onChange={(e) => setForm((f) => ({ ...f, addr: e.target.value }))} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] bg-transparent" placeholder="Mis. Balai RW 03, sebelah pos ronda" />
                      </div>
                      <button onClick={submitIntake} disabled={!form.nama.trim() || !form.issue.trim() || !coords} className={`w-full mt-6 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${form.nama.trim() && form.issue.trim() && coords ? 'bg-[#FF5733] text-white hover:bg-black' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}>
                        Simpan ke Katalog →
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )
          )}

          {/* ===== TAB: MAP WILAYAH ===== */}
          {tab === 'map' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Map Wilayah</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">KLIK MARKER UNTUK BUKA RUTE GOOGLE MAPS</p>
                </div>
                <div className="dash-item border-2 border-black bg-white p-3 flex items-center gap-5 text-[9px] font-mono font-bold">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 bg-white border-2 border-black rotate-45"></span> DIRENCANAKAN</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-300 border-2 border-black rotate-45"></span> BERLANGSUNG</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-3 bg-[#0E7C66] border-2 border-black rotate-45"></span> TERDATA</span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  {visits.map((v) => (
                    <div key={v.id} className="dash-item border-2 border-black bg-white p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-sm truncate">{v.comm}</p>
                        <p className="text-[9px] font-mono opacity-50">{v.date} · {v.time} · SEKTOR {v.sec}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {visitBadge(v.status)}
                        <button onClick={() => openRoute(v)} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">🧭</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="col-span-12 lg:col-span-8">
                  <div className="dash-item relative h-[520px] border-2 border-black bg-white overflow-hidden">
                    <div className="absolute inset-0 z-0"><div ref={areaMapEl} className="w-full h-full" /></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: LAPORAN ===== */}
          {tab === 'laporan' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Laporan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">KINERJA AGEN · AGUSTUS 2026</p>
                </div>
                <button className="border-2 border-black px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">⬇ Unduh Laporan (PDF)</button>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="dash-item col-span-12 lg:col-span-5 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Kunjungan / Minggu</h3>
                  <MiniBars data={[{ l: 'M1', v: 5 }, { l: 'M2', v: 7 }, { l: 'M3', v: 6 }, { l: 'M4', v: 5 }]} />
                  <div className="mt-6">
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>INTAKE ASSISTED DARI TOTAL</span><span>42%</span></div>
                    <div className="h-2 bg-black/10"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '42%' }} /></div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-7 border-2 border-black bg-white p-7 dash-item">
                  <h3 className="text-xl font-black mb-5">Komunitas Didampingi</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-black text-[10px] font-mono uppercase tracking-widest">
                          <th className="py-3 pr-4">Komunitas</th>
                          <th className="py-3 pr-4">Kunjungan</th>
                          <th className="py-3 pr-4">Kebutuhan</th>
                          <th className="py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        {ACCOMPANIED.map((a, i) => (
                          <tr key={i} className="hover:bg-black/5 transition-colors">
                            <td className="py-4 pr-4 font-bold">{a.n}</td>
                            <td className="py-4 pr-4 text-xs opacity-70">{a.v}</td>
                            <td className="py-4 pr-4 text-xs opacity-70">{a.need}</td>
                            <td className="py-4 text-right">{accBadge(a.s)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ============ HELPER BADGE ADMIN ============ */
function ModBadge({ t }) {
  const m = { KEBUTUHAN: 'bg-[#FF5733] text-white', TALENTA: 'bg-black text-white', TESTIMONI: 'bg-[#0E7C66] text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[t]}`}>{t}</span>;
}
function CaseBadge({ s }) {
  const m = { MEDIASI: 'bg-yellow-300 text-black', ESKALASI: 'bg-black text-white', SELESAI: 'bg-[#0E7C66] text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
}

/* ============ DASHBOARD ADMIN ============ */
function DashboardAdmin({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('ringkasan');
  const [modFilter, setModFilter] = useState('SEMUA');
  const [modStats, setModStats] = useState({ approve: 12, reject: 2 });
  const [queue, setQueue] = useState([
    { id: 1, type: 'KEBUTUHAN', t: 'Aplikasi Absensi Pemuda', by: 'Karang Taruna Mekar', date: 'HARI INI', d: 'Butuh form absensi kegiatan pemuda via HP, biar tidak rekap manual.' },
    { id: 2, type: 'TALENTA', t: 'Pendaftaran: Salsabila R.', by: 'Career switcher', date: 'HARI INI', d: 'Klaim skill React + Firebase, portofolio 2 proyek pribadi.' },
    { id: 3, type: 'TESTIMONI', t: 'Testimoni untuk Ezra P.', by: 'PKK RW 05', date: 'KEMARIN', d: '"Pengerjaan rapi dan sabar mengajarkan pengurus."' },
    { id: 4, type: 'KEBUTUHAN', t: 'Website Katalog UMKM', by: 'Paguyuban Pedagang', date: 'KEMARIN', d: 'Katalog produk 54 pedagang agar bisa dilihat online.' },
  ]);
  const [cases, setCases] = useState([
    { id: 1, t: 'Sistem Inventaris PKK', comm: 'PKK RW 05', talent: 'Derien A.', days: 6, status: 'MEDIASI', note: 'Komunitas belum konfirmasi 6 hari setelah talenta menandai selesai.' },
    { id: 2, t: 'Website Galeri', comm: 'KT Mekar', talent: 'Ezra P.', days: 12, status: 'ESKALASI', note: 'Komunitas mengklaim hasil belum sesuai kesepakatan lingkup.' },
  ]);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [userFilter, setUserFilter] = useState('SEMUA');
  const [users, setUsers] = useState([
    { id: 1, n: 'Ibu Siti Aminah', role: 'KOMUNITAS', join: 'MEI 2026', rep: '—', status: 'AKTIF' },
    { id: 2, n: 'Derien Adelio', role: 'TALENTA', join: 'JUN 2026', rep: 12, status: 'AKTIF' },
    { id: 3, n: 'Hasby Wira', role: 'LIAISON', join: 'MEI 2026', rep: '—', status: 'AKTIF' },
    { id: 4, n: 'Ezra P.', role: 'TALENTA', join: 'JUL 2026', rep: 9, status: 'AKTIF' },
    { id: 5, n: 'Akun Uji Coba', role: 'TALENTA', join: 'AGU 2026', rep: 0, status: 'DITANGGUHKAN' },
  ]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifs, setNotifs] = useState([
    { id: 1, type: 'moderasi', title: '4 item menunggu moderasi', sub: '2 kebutuhan · 1 talenta · 1 testimoni', read: false },
    { id: 2, type: 'sengketa', title: 'Sengketa dieskalasi', sub: 'Website Galeri · KT Mekar × Ezra P.', read: false },
    { id: 3, type: 'sistem', title: 'Backup harian berhasil', sub: 'Database · 03.00 WIB', read: true },
  ]);
  const rootRef = useRef(null);

  const NOTIF_META = {
    moderasi: { c: '#FF5733', l: 'MODERASI' },
    sengketa: { c: '#000000', l: 'SENGKETA' },
    sistem: { c: '#9CA3AF', l: 'SISTEM' },
  };
  const unread = notifs.filter((n) => !n.read).length;
  const markAll = () => setNotifs(notifs.map((n) => ({ ...n, read: true })));
  const markOne = (id) => setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: true } : n)));

  useEffect(() => {
    const onClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (notifOpen) gsap.fromTo('.notif-panel', { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
  }, [notifOpen]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => {
        const t = +el.dataset.target; const o = { val: 0 };
        gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } });
      });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, [tab]);

  const first = (user?.name || 'Admin').split(' ')[0];

  const NAV = [
    { id: 'ringkasan', n: '01', l: 'RINGKASAN' },
    { id: 'moderasi', n: '02', l: 'MODERASI' },
    { id: 'sengketa', n: '03', l: 'SENGKETA' },
    { id: 'pengguna', n: '04', l: 'PENGGUNA' },
    { id: 'liaison', n: '05', l: 'LIAISON' },
  ];

  const filteredQueue = modFilter === 'SEMUA' ? queue : queue.filter((q) => q.type === modFilter);
  const filteredUsers = userFilter === 'SEMUA' ? users : users.filter((u) => u.role === userFilter);

  const modAction = (id, action) => {
    setQueue((q) => q.filter((x) => x.id !== id));
    setModStats((m) => ({ ...m, [action]: m[action] + 1 }));
  };

  const resolveCase = (id, decision) => {
    setCases((cs) => cs.map((c) => c.id === id
      ? { ...c, status: decision === 'perpanjang' ? 'MEDIASI' : 'SELESAI', days: decision === 'perpanjang' ? 0 : c.days }
      : c));
    setResolveTarget(null);
  };

  const toggleSuspend = (id) => setUsers((u) => u.map((x) => x.id === id ? { ...x, status: x.status === 'AKTIF' ? 'DITANGGUHKAN' : 'AKTIF' } : x));

  const openCases = cases.filter((c) => c.status !== 'SELESAI').length;

  return (
    <div ref={rootRef} className="bg-[#F4F4F2] text-black min-h-screen">
      {/* TOPBAR */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-white border-b-2 border-black z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('home')} className="text-2xl font-black tracking-tighter hover:text-[#FF5733] transition-colors shrink-0">
            SUSI<span className="text-[#FF5733]">.</span>
          </button>
          <div className="flex-1" />
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className={`relative w-10 h-10 border-2 border-black flex items-center justify-center transition-colors ${notifOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="w-5 h-5">
                <path d="M12 3v2" /><path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3v-4z" /><path d="M10 20h4" />
              </svg>
              {unread > 0 && (
                <>
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#FF5733] animate-ping" />
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-[#FF5733] text-white text-[9px] font-black flex items-center justify-center border-2 border-black px-0.5">{unread}</span>
                </>
              )}
            </button>
            {notifOpen && (
              <div className="notif-panel absolute right-0 top-12 w-[340px] md:w-[380px] bg-white border-2 border-black shadow-[6px_6px_0_0_#000] z-[60]">
                <div className="flex items-center justify-between p-4 border-b-2 border-black">
                  <div>
                    <p className="text-sm font-black">NOTIFIKASI</p>
                    <p className="text-[9px] font-mono opacity-50">{unread} BELUM DIBACA</p>
                  </div>
                  <button onClick={markAll} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">TANDAI SEMUA</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => markOne(n.id)} className={`w-full text-left p-4 border-b-2 border-black/10 last:border-b-0 flex gap-3 transition-colors ${n.read ? 'opacity-50 hover:opacity-80' : 'bg-[#FF5733]/5 hover:bg-[#FF5733]/10'}`}>
                      <span className="w-2 h-2 mt-1.5 shrink-0 rotate-45" style={{ background: NOTIF_META[n.type].c }} />
                      <div className="flex-1 min-w-0">
                        <span className="inline-block text-[8px] font-mono font-bold px-1.5 py-0.5 text-white mb-0.5" style={{ background: NOTIF_META[n.type].c }}>{NOTIF_META[n.type].l}</span>
                        <p className="text-xs font-black leading-snug">{n.title}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{n.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-2 border-black px-3 py-2 bg-white">
            <span className="w-6 h-6 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-black">{first}</p>
              <p className="text-[9px] font-mono text-[#FF5733] font-bold mt-0.5">ADMIN</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">KELUAR</button>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white border-r-2 border-black z-40 flex-col justify-between">
        <div className="p-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Meja Kendali</p>
          <div className="space-y-2">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setTab(n.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${tab === n.id ? 'bg-black text-white shadow-[4px_4px_0_0_#FF5733]' : 'hover:bg-black/5'}`}>
                <span className={`text-[10px] font-mono font-bold ${tab === n.id ? 'text-[#FF5733]' : 'opacity-40'}`}>{n.n}</span>
                <span className="text-xs font-black uppercase tracking-wider">{n.l}</span>
                {n.id === 'moderasi' && queue.length > 0 && <span className="ml-auto text-[9px] font-mono font-black bg-[#FF5733] text-white px-1.5 py-0.5">{queue.length}</span>}
                {n.id === 'sengketa' && openCases > 0 && <span className="ml-auto text-[9px] font-mono font-black bg-black text-white px-1.5 py-0.5">{openCases}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t-2 border-black">
          <p className="text-[10px] font-mono opacity-50 leading-relaxed">F1 · PERAN: ADMIN<br />AKSES PENUH PLATFORM.</p>
        </div>
      </aside>

      {/* NAV MOBILE */}
      <div className="lg:hidden fixed top-20 left-0 right-0 z-40 bg-white border-b-2 border-black overflow-x-auto">
        <div className="flex px-4 py-3 gap-2 w-max">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`shrink-0 px-4 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${tab === n.id ? 'bg-black text-white border-black' : 'border-black/20'}`}>
              {n.l}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="pt-40 lg:pt-28 lg:pl-64 pb-16">
        <div className="px-5 lg:px-10 max-w-[1200px]">

          {/* ===== TAB: RINGKASAN ===== */}
          {tab === 'ringkasan' && (
            <>
              <div className="dash-item border-2 border-black bg-white p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#FF5733]">F1 · AKSES PENUH</span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, {first}.</h1>
                  <p className="text-sm opacity-60 max-w-xl leading-relaxed">Pantau kesehatan platform, moderasi konten, dan sengketa — semua dari satu meja kendali.</p>
                </div>
                <div className="flex items-center gap-2 border-2 border-black px-4 py-3 bg-[#0E7C66] text-white">
                  <span className="w-2 h-2 bg-white animate-pulse" />
                  <span className="text-[10px] font-mono font-black">SEMUA SISTEM NORMAL</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[
                  { t: 181, l: 'Pengguna aktif' },
                  { t: 20, l: 'Kebutuhan terbuka' },
                  { t: 8, l: 'Projek berjalan' },
                  { t: 127, l: 'Selesai terverifikasi' },
                  { t: queue.length, l: 'Antrean moderasi' },
                  { t: openCases, l: 'Sengketa terbuka' },
                ].map((s, i) => (
                  <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                    <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="dash-item col-span-12 lg:col-span-5 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Intake Mingguan</h3>
                  <MiniBars data={[{ l: 'M1', v: 9 }, { l: 'M2', v: 12 }, { l: 'M3', v: 8 }, { l: 'M4', v: 14 }, { l: 'M5', v: 11 }, { l: 'M6', v: 16 }]} />
                  <p className="text-[10px] font-mono opacity-50 mt-4">F2 · GABUNGAN MANDIRI + ASSISTED</p>
                </div>

                <div className="dash-item col-span-12 lg:col-span-4 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Distribusi Peran</h3>
                  <div className="space-y-4">
                    {[
                      { l: 'KOMUNITAS', v: 45 },
                      { l: 'TALENTA', v: 40 },
                      { l: 'LIAISON', v: 10 },
                      { l: 'ADMIN', v: 5 },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] font-mono font-bold mb-1.5"><span>{s.l}</span><span>{s.v}%</span></div>
                        <div className="h-2 bg-black/10"><div className="bar-h h-full bg-black" style={{ width: `${s.v}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dash-item col-span-12 lg:col-span-3 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Status Sistem</h3>
                  <div className="space-y-3">
                    {[
                      { l: 'API', s: 'OK' },
                      { l: 'DATABASE', s: 'OK' },
                      { l: 'MAP TILES', s: 'OK' },
                      { l: 'NOTIFIKASI', s: 'OK' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between border-2 border-black/15 px-3 py-2">
                        <span className="text-[10px] font-mono font-bold">{s.l}</span>
                        <span className="flex items-center gap-1.5 text-[9px] font-mono font-black text-[#0E7C66]">
                          <span className="w-2 h-2 bg-[#0E7C66] animate-pulse" />{s.s}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dash-item col-span-12 lg:col-span-7 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-4">Aktivitas Platform</h3>
                  <ActivityFeed items={[
                    { c: 'bg-[#FF5733]', t: 'Pengaduan baru masuk moderasi', s: 'Website Katalog UMKM · Paguyuban Pedagang', time: '2J' },
                    { c: 'bg-black', t: 'Sengketa dieskalasi', s: 'Website Galeri · KT Mekar × Ezra P.', time: '5J' },
                    { c: 'bg-[#0E7C66]', t: 'Verifikasi dua arah selesai', s: 'Galeri Foto · reputasi +1', time: '1H' },
                    { c: 'bg-black', t: 'Talenta baru mendaftar', s: 'Salsabila R. · menunggu moderasi', time: '3H' },
                  ]} />
                </div>

                <div className="dash-item col-span-12 lg:col-span-5 border-2 border-black bg-black text-white p-7">
                  <span className="text-[10px] font-mono font-bold text-[#FF5733]">F6 · PAPAN REPUTASI</span>
                  <h3 className="text-xl font-black mt-1 mb-5">Talenta Teratas</h3>
                  <div className="space-y-4">
                    {[
                      { n: 'Derien A.', v: 12 },
                      { n: 'Ezra P.', v: 9 },
                      { n: 'Khalifa H.', v: 7 },
                    ].map((l, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-2xl font-black text-[#FF5733]">0{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs font-bold mb-1"><span>{l.n}</span><span className="font-mono">{l.v} PROYEK</span></div>
                          <div className="h-1.5 bg-white/15"><div className="bar-h h-full bg-[#FF5733]" style={{ width: `${(l.v / 12) * 100}%` }} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono opacity-50 mt-6 leading-relaxed">REPUTASI = NILAI TURUNAN KONFIRMASI GANDA. TIDAK BISA DIKLAIM SEPIHAK.</p>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: MODERASI ===== */}
          {tab === 'moderasi' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Moderasi</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">ITEM MENUNGGU KEPUTUSAN ANDA</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['SEMUA', 'KEBUTUHAN', 'TALENTA', 'TESTIMONI'].map((s) => (
                    <button key={s} onClick={() => setModFilter(s)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${modFilter === s ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[
                  { t: queue.length, l: 'Menunggu' },
                  { t: modStats.approve, l: 'Disetujui' },
                  { t: modStats.reject, l: 'Ditolak' },
                ].map((s, i) => (
                  <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                    <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {filteredQueue.map((q) => (
                  <div key={q.id} className="dash-item border-2 border-black bg-white p-6">
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <ModBadge t={q.type} />
                        <span className="text-[9px] font-mono opacity-50">{q.date}</span>
                      </div>
                    </div>
                    <h4 className="font-black text-lg mb-1">{q.t}</h4>
                    <p className="text-[10px] font-mono opacity-50 mb-3">OLEH: {q.by}</p>
                    <p className="text-sm opacity-70 leading-relaxed mb-5">{q.d}</p>
                    <div className="flex gap-3">
                      <button onClick={() => modAction(q.id, 'approve')} className="flex-1 bg-[#0E7C66] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">✓ Setujui</button>
                      <button onClick={() => modAction(q.id, 'reject')} className="flex-1 border-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Tolak</button>
                    </div>
                  </div>
                ))}
                {filteredQueue.length === 0 && (
                  <div className="dash-item border-2 border-black bg-white p-10 text-center">
                    <p className="text-3xl font-black mb-2">✓</p>
                    <p className="text-xs font-mono opacity-50">ANTREAN KOSONG — SEMUA SUDAH DIMODERASI.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== TAB: SENGKETA ===== */}
          {tab === 'sengketa' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Sengketa</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">VERIFIKASI MACET YANG BUTUH KEPUTUSAN ADMIN</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-black text-white px-3 py-2">{openCases} TERBUKA</span>
              </div>

              <div className="space-y-4">
                {cases.map((c) => (
                  <div key={c.id} className={`dash-item border-2 border-black p-6 ${c.status === 'SELESAI' ? 'bg-white opacity-60' : 'bg-white'}`}>
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
                      <h4 className="font-black text-lg">{c.t}</h4>
                      <CaseBadge s={c.status} />
                    </div>
                    <p className="text-[10px] font-mono opacity-50 mb-3">{c.comm} × {c.talent} · {c.days} HARI TERBUKA</p>
                    <p className="text-sm opacity-70 leading-relaxed mb-5">{c.note}</p>
                    {c.status !== 'SELESAI' && (
                      <div className="flex gap-3 flex-wrap">
                        <button className="flex-1 border-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Hubungi Kedua Pihak</button>
                        <button onClick={() => setResolveTarget(c)} className="flex-1 bg-[#FF5733] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Putuskan →</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== TAB: PENGGUNA ===== */}
          {tab === 'pengguna' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Pengguna</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">SEMUA AKUN TERDAFTAR · {users.length} AKUN</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['SEMUA', 'KOMUNITAS', 'TALENTA', 'LIAISON'].map((s) => (
                    <button key={s} onClick={() => setUserFilter(s)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${userFilter === s ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="dash-item border-2 border-black bg-white p-7">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-black text-[10px] font-mono uppercase tracking-widest">
                        <th className="py-3 pr-4">Nama</th>
                        <th className="py-3 pr-4">Peran</th>
                        <th className="py-3 pr-4">Bergabung</th>
                        <th className="py-3 pr-4">Reputasi</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-black/5 transition-colors">
                          <td className="py-4 pr-4 font-bold">{u.n}</td>
                          <td className="py-4 pr-4"><span className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1">{u.role}</span></td>
                          <td className="py-4 pr-4 text-xs opacity-70">{u.join}</td>
                          <td className="py-4 pr-4 font-mono font-bold">{u.rep}</td>
                          <td className="py-4 pr-4">
                            <span className={`text-[9px] font-mono font-bold px-2 py-1 ${u.status === 'AKTIF' ? 'bg-[#0E7C66] text-white' : 'bg-black text-white'}`}>{u.status}</span>
                          </td>
                          <td className="py-4 text-right">
                            <button onClick={() => toggleSuspend(u.id)} className={`text-[10px] font-mono font-bold border-2 px-3 py-1.5 transition-colors ${u.status === 'AKTIF' ? 'border-black hover:bg-black hover:text-white' : 'border-[#0E7C66] text-[#0E7C66] hover:bg-[#0E7C66] hover:text-white'}`}>
                              {u.status === 'AKTIF' ? 'TANGGUHKAN' : 'AKTIFKAN'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: LIAISON ===== */}
          {tab === 'liaison' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Liaison</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">KINERJA PENDAMPING LAPANGAN · F2 ASSISTED</p>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="dash-item col-span-12 lg:col-span-5 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Intake Assisted / Minggu</h3>
                  <MiniBars data={[{ l: 'M1', v: 4 }, { l: 'M2', v: 6 }, { l: 'M3', v: 5 }, { l: 'M4', v: 8 }]} />
                  <p className="text-[10px] font-mono opacity-50 mt-4">42% DARI TOTAL INTAKE MASUK VIA LIAISON</p>
                </div>

                <div className="col-span-12 lg:col-span-7 space-y-4">
                  {[
                    { n: 'Hasby Wira Al Muflih', visits: 23, assisted: 19, sector: 'UTARA' },
                    { n: 'Tim Lapangan 02', visits: 15, assisted: 12, sector: 'SELATAN' },
                  ].map((l, i) => (
                    <div key={i} className="dash-item border-2 border-black bg-white p-6 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <span className="w-12 h-12 bg-[#FF5733] text-white flex items-center justify-center text-lg font-black">{l.n.charAt(0)}</span>
                        <div>
                          <p className="font-black">{l.n}</p>
                          <p className="text-[10px] font-mono opacity-50">SEKTOR {l.sector} · {l.visits} KUNJUNGAN · {l.assisted} INTAKE</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-[#0E7C66] text-white px-2 py-1">AKTIF</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL PUTUSAN SENGKETA */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md border-2 border-[#FF5733] p-8 relative">
            <button onClick={() => setResolveTarget(null)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white transition-colors">×</button>
            <span className="text-[10px] font-mono font-bold text-[#FF5733]">KEPUTUSAN ADMIN</span>
            <h3 className="text-2xl font-black mt-2 mb-1">{resolveTarget.t}</h3>
            <p className="text-[10px] font-mono opacity-50 mb-6">{resolveTarget.comm} × {resolveTarget.talent}</p>
            <div className="space-y-3">
              <button onClick={() => resolveCase(resolveTarget.id, 'komunitas')} className="w-full border-2 border-black p-4 text-left hover:bg-black hover:text-white transition-colors">
                <p className="text-[10px] font-black uppercase tracking-widest">Menangkan Komunitas</p>
                <p className="text-[10px] opacity-60 mt-1">Projek ditandai TIDAK SELESAI · talenta tidak dapat reputasi.</p>
              </button>
              <button onClick={() => resolveCase(resolveTarget.id, 'talenta')} className="w-full border-2 border-black p-4 text-left hover:bg-black hover:text-white transition-colors">
                <p className="text-[10px] font-black uppercase tracking-widest">Menangkan Talenta</p>
                <p className="text-[10px] opacity-60 mt-1">Projek ditandai SELESAI · reputasi talenta +1.</p>
              </button>
              <button onClick={() => resolveCase(resolveTarget.id, 'perpanjang')} className="w-full border-2 border-black p-4 text-left hover:bg-black hover:text-white transition-colors">
                <p className="text-[10px] font-black uppercase tracking-widest">Perpanjang Deadline 7 Hari</p>
                <p className="text-[10px] opacity-60 mt-1">Kasus kembali ke MEDIASI · kedua pihak diberi waktu.</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ FEATURE SECTION (INTERAKTIF · VERSI BESAR) ============ */
function FeatureSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [intake, setIntake] = useState('MANDIRI');

  const FEATURES = [
    {
      num: '01', tag: 'F2 · DUA JALUR MASUK', title: 'Assisted Intake',
      desc: 'SUSI tidak menunggu komunitas mendaftar sendiri. AgenSUSI mendatangi komunitas secara langsung dan mencatatkan kebutuhan mereka ke sistem — komunitas yang belum melek digital pun tetap terjangkau.',
    },
    {
      num: '02', tag: 'F3–F4 · PENCOCOKAN', title: 'Menjembatani Dua Kekosongan',
      desc: 'Komunitas butuh solusi digital yang tak sanggup mereka bayar. Talenta butuh pengalaman nyata yang tak bisa mereka beli. SUSI mempertemukan keduanya dalam satu sistem yang saling menguatkan.',
    },
    {
      num: '03', tag: 'F6 · REPUTASI', title: 'Modal Berbasis Pengalaman',
      desc: 'Talenta dibayar dengan portofolio, bukan uang. Komunitas tanpa anggaran tetap terlayani — sesuatu yang mustahil terjadi di marketplace komersial.',
    },
  ];

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % FEATURES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    gsap.fromTo('.feat-anim', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
  }, [active]);

  const f = FEATURES[active];

  return (
    <section id="fitur" className="py-40 px-6 lg:px-12">
      <style>{`
        @keyframes featprog { from { width: 0% } to { width: 100% } }
        .feat-prog { animation: featprog 6s linear forwards; }
        @keyframes bridgepulse { 0%,100% { transform: translateX(-8px) } 50% { transform: translateX(8px) } }
        .bridge-arrow { animation: bridgepulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between mb-14 flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-black/50 font-bold mb-4">02 / Fitur</p>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight">Tiga Pembeda<span className="text-[#FF5733]">.</span></h2>
          </div>
          <p className="text-[10px] font-mono text-black/40 font-bold">KLIK UNTUK MENJELAJAH · AUTO-ROTATE 6 DETIK</p>
        </div>

        {/* PANEL BESAR */}
        <div
          className="grid grid-cols-1 lg:grid-cols-12 border-2 border-black bg-white lg:min-h-[680px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* LIST KIRI */}
          <div className="col-span-1 lg:col-span-4 lg:border-r-2 border-black border-b-2 lg:border-b-0">
            {FEATURES.map((ft, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`relative w-full text-left p-8 lg:p-10 transition-colors ${i > 0 ? 'border-t-2 border-black' : ''} ${active === i ? 'bg-black text-white' : 'hover:bg-black/5'}`}
              >
                <div className="flex items-center gap-5">
                  <span className={`text-4xl lg:text-5xl font-black ${active === i ? 'text-[#FF5733]' : 'text-black/15'}`}>{ft.num}</span>
                  <span className="font-black uppercase tracking-wider text-base lg:text-xl">{ft.title}</span>
                </div>
                {active === i && !paused && <span className="feat-prog absolute bottom-0 left-0 h-1 bg-[#FF5733]" />}
              </button>
            ))}
          </div>

          {/* DETAIL KANAN */}
          <div className="col-span-1 lg:col-span-8 p-10 lg:p-16 relative overflow-hidden">
            <span className="absolute -top-10 -right-6 text-[14rem] lg:text-[20rem] font-black leading-none text-black/5 select-none">{f.num}</span>

            <span className="feat-anim inline-block text-[10px] font-mono font-bold border-2 border-black px-3 py-1.5 mb-6">{f.tag}</span>
            <h3 className="feat-anim text-4xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[0.95] mb-6">{f.title}</h3>
            <p className="feat-anim text-base md:text-xl opacity-70 leading-relaxed mb-10 max-w-3xl">{f.desc}</p>

            {/* DEMO 01: DUA JALUR INTAKE */}
            {active === 0 && (
              <div className="feat-anim">
                <div className="grid grid-cols-2 gap-px bg-black border-2 border-black mb-6">
                  {['MANDIRI', 'ASSISTED'].map((m) => (
                    <button key={m} type="button" onClick={() => setIntake(m)} className={`py-4 text-[11px] font-mono font-bold transition-colors ${intake === m ? 'bg-[#FF5733] text-white' : 'bg-white hover:bg-black hover:text-white'}`}>
                      JALUR {m}
                    </button>
                  ))}
                </div>
                <div className="border-2 border-black p-6 lg:p-8 bg-[#FAFAFA]">
                  <p className="text-base md:text-lg leading-relaxed">
                    {intake === 'MANDIRI'
                      ? 'Komunitas mengisi formulir sendiri lewat dasbor — bahasa sehari-hari, tanpa istilah teknis.'
                      : 'AgenSUSI mendatangi komunitas yang gaptek, lalu mencatatkan kebutuhan atas nama mereka.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-6 flex-wrap">
                  {['CERITA', 'TERCATAT', 'MASUK KATALOG'].map((s, i) => (
                    <span key={s} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono font-bold border-2 border-black px-3 py-1.5">{i + 1}. {s}</span>
                      {i < 2 && <span className="text-[#FF5733] text-lg">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* DEMO 02: JEMBATAN */}
            {active === 1 && (
              <div className="feat-anim grid grid-cols-[1fr_auto_1fr] items-stretch border-2 border-black">
                <div className="p-6 lg:p-8">
                  <p className="text-[10px] font-mono font-bold mb-3">KOMUNITAS</p>
                  <p className="text-base md:text-lg font-bold leading-snug">"Butuh solusi yang tak sanggup kami bayar."</p>
                </div>
                <div className="bg-black text-[#FF5733] flex items-center justify-center px-4 lg:px-6">
                  <span className="bridge-arrow text-3xl font-black">⇄</span>
                </div>
                <div className="p-6 lg:p-8">
                  <p className="text-[10px] font-mono font-bold mb-3">TALENTA</p>
                  <p className="text-base md:text-lg font-bold leading-snug">"Butuh pengalaman yang tak bisa kami beli."</p>
                </div>
              </div>
            )}

            {/* DEMO 03: REPUTASI */}
            {active === 2 && (
              <div className="feat-anim">
                <div className="flex justify-between text-[11px] font-mono font-bold mb-3">
                  <span>REPUTASI TALENTA</span>
                  <span>12 / 20</span>
                </div>
                <div className="h-4 border-2 border-black bg-white">
                  <div className="h-full bg-[#FF5733]" style={{ width: '60%' }} />
                </div>
                <div className="grid grid-cols-3 gap-px bg-black border-2 border-black border-t-0">
                  {['PEMULA · 0–5', 'TALENTA MUDA · 5–15', 'TERPERCAYA · 15+'].map((l, i) => (
                    <div key={l} className={`p-4 lg:p-5 text-[10px] lg:text-[11px] font-mono font-bold text-center ${i === 1 ? 'bg-[#FF5733] text-white' : 'bg-white'}`}>{l}</div>
                  ))}
                </div>
                <p className="text-[11px] font-mono opacity-50 mt-4">REPUTASI NAIK HANYA JIKA KOMUNITAS MEMBENARKAN HASIL — F5.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
/* ============ HOME PAGE ============ */
function HomePage({ navigateTo, goToSection }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .fromTo('.hero-line', { yPercent: 110 }, { yPercent: 0, duration: 1.2, stagger: 0.15 })
        .fromTo('.hero-fade', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, '-=0.6')
        .fromTo('.hero-bar', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut', transformOrigin: 'left center' }, '-=0.4')
        .fromTo('.hero-geo', { autoAlpha: 0, scale: 0.8, rotation: -10 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 1, stagger: 0.1, ease: 'back.out(1.5)' }, '-=0.6');

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

      gsap.to('.parallax-slow', { y: -100, ease: 'none', scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom top', scrub: 1 } });
    }, rootRef);
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="bg-white text-black">
      <section className="pt-40 pb-24 px-6 lg:px-12 min-h-screen flex items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(black 1px, transparent 1px), linear-gradient(90deg, black 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="parallax-slow absolute top-40 right-10 w-40 h-40 border-2 border-[#FF5733]/30 hidden lg:block" />
        <div className="max-w-[1440px] mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <div className="hero-fade flex items-center gap-4 mb-8"></div>
              <h1 className="text-[clamp(3rem,9vw,9rem)] font-black leading-[0.85] tracking-tighter mb-8">
                <span className="block overflow-hidden"><span className="hero-line block">SUSI</span></span>
                <span className="block overflow-hidden"><span className="hero-line block">COMMU<span className="text-[#FF5733]">NITY</span></span></span>
              </h1>
              <p className="hero-fade text-lg md:text-2xl text-black/70 max-w-2xl leading-relaxed mb-12">
                Karena setiap masalah layak mendapatkan solusi, <span className="font-bold text-black border-b-2 border-[#FF5733]">bukan hanya yang mampu bayar mahal</span>.
              </p>
              <div className="hero-fade flex flex-wrap gap-4">
                <Magnetic>
                  <button onClick={() => goToSection('alur')} className="group bg-black text-white px-10 py-5 text-sm uppercase tracking-wider font-bold hover:bg-[#FF5733] transition-colors flex items-center gap-3">
                    Lihat Cara Kerjanya <span className="group-hover:translate-x-2 transition-transform">↓</span>
                  </button>
                </Magnetic>
              </div>
            </div>
            <div className="lg:col-span-4 hidden lg:block">
              <div className="relative w-full aspect-square">
                <div className="hero-geo absolute top-0 right-0 w-72 h-72 border-2 border-black" />
                <div className="hero-geo absolute top-16 right-16 w-72 h-72 bg-[#FF5733]/10 border-2 border-[#FF5733]" />
                <div className="hero-geo absolute top-8 right-8 w-16 h-16 bg-[#FF5733]" />
                <div className="hero-geo absolute bottom-0 left-0 w-48 h-px bg-black" />
                <div className="hero-geo absolute bottom-0 left-0 w-px h-48 bg-black" />
              </div>
            </div>
          </div>
          <div className="hero-bar mt-20 h-2 bg-[#FF5733]" />
        </div>
      </section>

      <section className="border-y-2 border-black py-6 overflow-hidden bg-[#FF5733]">
        <div className="marquee-track flex whitespace-nowrap w-max">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 mx-4">
              {['KOMUNITAS CERITA', 'TALENTA MELAMAR', 'SEPAKAT DUA ARAH', 'TERPERCAYA', 'VERIFIKASI BERSAMA', 'NAMA BAIK BERTAMBAH'].map((t, j) => (
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
          <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto mb-12">Komunitas butuh solusi yang tak sanggup mereka bayar. Talenta butuh pengalaman yang tak dapat mereka beli.</p>
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

/* ============ WIDGET PEMBANTU ============ */
function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`bento-card border-2 border-black p-6 hover:shadow-[6px_6px_0_0_#000] hover:-translate-y-1 transition-all duration-300 ${accent ? 'bg-[#FF5733] text-white' : 'bg-white'}`}>
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60">{label}</p>
      <div className="text-5xl font-black mt-2 tabular-nums">{value}</div>
      <p className="text-xs mt-2 opacity-70">{sub}</p>
    </div>
  );
}

function MiniBars({ data, height = 110 }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group">
          <div className="bar-v w-full bg-black group-hover:bg-[#FF5733] transition-colors" style={{ height: `${(d.v / max) * 100}%` }} />
          <span className="text-[9px] font-mono opacity-50">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

function Pipeline({ stages }) {
  return (
    <div className="flex items-center overflow-x-auto pb-2">
      {stages.map((s, i) => (
        <div key={i} className="flex items-center flex-1 min-w-[100px]">
          <div className="flex-1 border-2 border-black p-3 text-center hover:bg-black hover:text-white transition-colors cursor-default">
            <div className="text-2xl font-black tabular-nums">{s.n}</div>
            <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">{s.l}</div>
          </div>
          {i < stages.length - 1 && <span className="px-1 opacity-40 text-sm">→</span>}
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ items }) {
  return (
    <div className="divide-y-2 divide-black/10">
      {items.map((a, i) => (
        <div key={i} className="feed-item flex gap-4 items-start py-3 px-2 hover:bg-black/5 transition-colors">
          <span className={`mt-1.5 w-2 h-2 shrink-0 ${a.c}`} />
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight">{a.t}</p>
            <p className="text-xs opacity-60 mt-0.5">{a.s}</p>
          </div>
          <span className="text-[10px] font-mono opacity-50 shrink-0">{a.time}</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ type }) {
  const map = {
    selesai: 'bg-[#0E7C66] text-white',
    proses: 'bg-yellow-300 text-black',
    tunggu: 'bg-black text-white',
    buka: 'bg-white text-black border-2 border-black',
  };
  const label = { selesai: 'SELESAI', proses: 'PROSES', tunggu: 'MENUNGGU', buka: 'TERBUKA' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${map[type]}`}>{label[type]}</span>;
}


function ProjectTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-black text-[10px] font-mono uppercase tracking-widest">
            <th className="py-3 pr-4">Proyek</th>
            <th className="py-3 pr-4">Pihak</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-black/5 transition-colors">
              <td className="py-4 pr-4 font-bold">{r.p}</td>
              <td className="py-4 pr-4 text-xs opacity-70">{r.o}</td>
              <td className="py-4 pr-4"><Badge type={r.s} /></td>
              <td className="py-4 text-right">
                <button className="text-[10px] font-mono font-bold border-2 border-black px-3 py-1.5 hover:bg-[#FF5733] hover:border-[#FF5733] hover:text-white transition-colors">{r.a}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

 const SetToggle = ({ on, onClick, label, sub }) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-5 border-2 transition-colors text-left group ${on ? 'border-[#0E7C66] bg-[#0E7C66]/5' : 'border-black/15 hover:border-black'}`}>
      <div className="flex-1 pr-4">
        <p className="text-sm font-black">{label}</p>
        <p className="text-[10px] opacity-60 mt-0.5 leading-relaxed">{sub}</p>
      </div>
      <span className={`w-11 h-6 border-2 border-black relative transition-colors shrink-0 ${on ? 'bg-[#0E7C66]' : 'bg-white'}`}>
        <span className={`absolute top-0.5 w-3 h-3 bg-black transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );

function Toggle({ on, onClick, label, sub }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 border-2 transition-colors ${on ? 'border-[#0E7C66] bg-[#0E7C66]/10' : 'border-black/20 hover:border-black'}`}>
      <div className="text-left">
        <p className="text-sm font-black">{label}</p>
        <p className="text-[10px] opacity-60">{sub}</p>
      </div>
      <span className={`w-10 h-6 border-2 border-black relative transition-colors ${on ? 'bg-[#0E7C66]' : 'bg-white'}`}>
        <span className={`absolute top-0.5 w-3 h-3 bg-black transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function VerifyWidget() {
  const [talentDone, setTalentDone] = useState(true);
  const [communityOk, setCommunityOk] = useState(false);
  const done = talentDone && communityOk;

  useEffect(() => {
    if (done) gsap.fromTo('.rep-pop', { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(2.5)' });
  }, [done]);

  return (
    <div className="space-y-3">
      <Toggle on={talentDone} onClick={() => setTalentDone(!talentDone)} label="Talenta: Sudah Selesai" sub="Langkah 06" />
      <Toggle on={communityOk} onClick={() => setCommunityOk(!communityOk)} label="Komunitas: Membenarkan" sub="Langkah 07" />
      <div className={`p-4 border-2 text-center transition-colors ${done ? 'bg-[#0E7C66] border-[#0E7C66] text-white' : 'bg-yellow-100 border-yellow-400 text-yellow-900'}`}>
        {done ? (
          <div className="rep-pop">
            <p className="font-black uppercase text-sm">✓ Selesai Terverifikasi</p>
            <p className="text-[10px] font-mono mt-1">LANGKAH 08 · REPUTASI TALENTA +1</p>
          </div>
        ) : (
          <div>
            <p className="font-black uppercase text-sm">Status Menggantung</p>
            <p className="text-[10px] font-mono mt-1">REPUTASI TIDAK BERUBAH</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ AUTH PAGE — SWISS STYLE ============ */
function AuthPage({ onLogin, goToHome, goAdmin }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('requester');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const rootRef = useRef(null);
  const PUBLIC_ROLES = AUTH_ROLES.filter((r) => r.id !== 'admin');
  const active = AUTH_ROLES.find((r) => r.id === role);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .fromTo('.auth-line', { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.12 })
        .fromTo('.auth-fade', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.08 }, '-=0.5');
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    gsap.fromTo('.form-anim', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out' });
    gsap.fromTo('.role-display', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
  }, [mode, role]);

  const submit = (e) => {
    e.preventDefault();
    onLogin({ role, name: extra || name || active.fallback });
  };

  const inputCls = 'w-full border-b-2 border-black/20 bg-transparent p-3 text-sm font-medium outline-none focus:border-[#FF5733] transition-colors placeholder:text-black/30';

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-black">
      <div className="max-w-[1440px] mx-auto px-4 md:px-12 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 border-2 border-black min-h-[calc(100vh-8rem)]">
          {/* PANEL KIRI: HITAM */}
          <div className="lg:col-span-5 bg-black text-white p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 border-2 border-[#FF5733]/40" />
            <div className="absolute bottom-8 right-8 w-10 h-10 bg-[#FF5733]" />
            <div className="relative z-10">
              <button onClick={goToHome} className="auth-fade text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#FF5733] transition-all">
                ← Kembali ke beranda
              </button>
            </div>
            <div className="relative z-10 my-16">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85]">
                <span className="block overflow-hidden"><span className="auth-line block">{mode === 'login' ? 'MASUK.' : 'DAFTAR.'}</span></span>
                <span className="block overflow-hidden"><span className="auth-line block text-white/20">SUSI.</span></span>
              </h1>
            </div>
            <div className="relative z-10 border-t-2 border-white/20 pt-6">
              <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 mb-3">Peran dipilih</p>
              <div key={role} className="role-display flex items-end gap-5">
                <span className="text-6xl lg:text-7xl font-black text-[#FF5733] leading-none">{active.num}</span>
                <div>
                  <p className="text-2xl font-black uppercase tracking-tight">{active.label}</p>
                  <p className="text-xs opacity-60 mt-2 max-w-xs leading-relaxed">{active.desc}</p>
                </div>
              </div>
            </div>
          </div>

          {/* PANEL KANAN: FORM */}
          <div className="lg:col-span-7 bg-white p-10 lg:p-14">
            <div className="form-anim grid grid-cols-2 border-2 border-black mb-10">
              <button onClick={() => setMode('login')} className={`py-4 text-xs font-black uppercase tracking-[0.25em] transition-colors ${mode === 'login' ? 'bg-black text-white' : 'bg-white hover:bg-black/5'}`}>Masuk</button>
              <button onClick={() => setMode('register')} className={`py-4 text-xs font-black uppercase tracking-[0.25em] border-l-2 border-black transition-colors ${mode === 'register' ? 'bg-black text-white' : 'bg-white hover:bg-black/5'}`}>Daftar</button>
            </div>

            <form onSubmit={submit} className="space-y-8">
              {mode === 'register' && (
                <div className="form-anim">
                  <label className="text-xs font-black uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nama kamu" required />
                </div>
              )}

              <div className="form-anim">
                <label className="text-xs font-black uppercase tracking-widest mb-2 block">Email</label>
                <input type="email" className={inputCls} placeholder="nama@email.com" required />
              </div>

              <div className="form-anim">
                <label className="text-xs font-black uppercase tracking-widest mb-2 block">Kata Sandi</label>
                <div className="flex items-center">
                  <input type={showPass ? 'text' : 'password'} className={inputCls} placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="shrink-0 border-2 border-black px-3 py-2 text-[10px] font-mono font-bold hover:bg-black hover:text-white transition-colors">
                    {showPass ? 'TUTUP' : 'LIHAT'}
                  </button>
                </div>
              </div>

              {/* PILIHAN PERAN — HANYA 3 PERAN PUBLIK (ADMIN TERPISAH) */}
              <div className="form-anim">
                <p className="text-xs font-black uppercase tracking-widest mb-3">{mode === 'register' ? 'Daftar sebagai' : 'Masuk sebagai'}</p>
                <div className="grid grid-cols-3 gap-px bg-black border-2 border-black">
                  {PUBLIC_ROLES.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`p-5 text-left transition-colors duration-300 ${role === r.id ? 'bg-[#FF5733] text-white' : 'bg-white hover:bg-black hover:text-white'}`}
                    >
                      <span className="text-[10px] font-mono font-bold block mb-2">{r.num}</span>
                      <span className="font-black uppercase tracking-wider text-sm">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'register' && (
                <div className="form-anim">
                  <label className="text-xs font-black uppercase tracking-widest mb-2 block">{active.field}</label>
                  <input value={extra} onChange={(e) => setExtra(e.target.value)} className={inputCls} placeholder={active.ph} />
                </div>
              )}

              <button type="submit" className="form-anim group w-full bg-black text-white py-5 text-sm uppercase tracking-wider font-black hover:bg-[#FF5733] transition-colors flex items-center justify-center gap-3">
                {mode === 'login' ? 'Masuk' : 'Buat Akun'}
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </button>

              {/* LINK KE LOGIN ADMIN (HALAMAN TERPISAH) */}
              <div className="form-anim flex items-center gap-3">
                <div className="h-px bg-black/10 flex-1" />
                <span className="text-[9px] font-mono opacity-40">ATAU</span>
                <div className="h-px bg-black/10 flex-1" />
              </div>
              <button
                type="button"
                onClick={goAdmin}
                className="form-anim w-full border-2 border-black py-3.5 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                🔒 Masuk sebagai Admin →
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ============ ADMIN LOGIN PAGE (HALAMAN TERPISAH) ============ */
function AdminLoginPage({ onLogin, goToAuth }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const ADMIN_CODE = 'SUSI2026'; // ← ganti kode akses di sini

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.adm-fade', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (code.trim().toUpperCase() !== ADMIN_CODE) {
      setError('KODE AKSES SALAH — AREA INI KHUSUS ADMIN.');
      gsap.fromTo('.adm-card', { x: 0 }, { x: 14, duration: 0.07, repeat: 5, yoyo: true, clearProps: 'x' });
      return;
    }
    onLogin({ role: 'admin', name: 'Admin SUSI' });
  };

  const inputCls = 'w-full border-b-2 border-white/20 bg-transparent p-3 text-sm font-medium outline-none focus:border-[#FF5733] transition-colors placeholder:text-white/30';
  const locked = code.trim() === '';

  return (
    <div ref={rootRef} className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute -top-16 -left-16 w-64 h-64 border-2 border-[#FF5733]/40" />
      <div className="absolute bottom-10 right-10 w-12 h-12 bg-[#FF5733]" />

      <div className="adm-card w-full max-w-md border-2 border-white/20 p-8 md:p-10 relative z-10">
        <button onClick={goToAuth} className="adm-fade absolute -top-12 left-0 text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#FF5733] transition-all">
          ← Kembali ke halaman masuk
        </button>
        <span className="adm-fade inline-block text-[9px] font-mono font-bold bg-[#FF5733] text-white px-2 py-1 mb-4">⚠ AREA TERBATAS</span>
        <h1 className="adm-fade text-5xl md:text-6xl font-black tracking-tighter leading-[0.85] mb-3">ADMIN.</h1>
        <p className="adm-fade text-xs opacity-60 leading-relaxed mb-8">Meja kendali platform SUSI. Wajib kode akses internal — percobaan asal-asalan akan ditolak.</p>

        <form onSubmit={submit} className="space-y-6">
          <div className="adm-fade">
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="admin@susi.id" required />
          </div>
          <div className="adm-fade">
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Kata Sandi</label>
            <div className="flex items-center">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} className={inputCls} placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPass(!showPass)} className="shrink-0 border-2 border-white/30 px-3 py-2 text-[10px] font-mono font-bold hover:bg-white hover:text-black transition-colors">
                {showPass ? 'TUTUP' : 'LIHAT'}
              </button>
            </div>
          </div>
          <div className="adm-fade">
            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Kode Akses Internal</label>
            <input value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} className={`${inputCls} ${error ? 'border-[#FF5733]' : ''}`} placeholder="Kode khusus tim SUSI" required />
            {error && <p className="text-[10px] font-mono font-bold text-[#FF5733] mt-2">⚠ {error}</p>}
          </div>
          <button
            type="submit"
            disabled={locked}
            className={`adm-fade w-full py-4 text-sm uppercase tracking-wider font-black transition-colors flex items-center justify-center gap-3 ${
              locked ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-[#FF5733] text-white hover:bg-white hover:text-black'
            }`}
          >
            Masuk ke Meja Kendali →
          </button>
          <p className="adm-fade text-[9px] font-mono opacity-40 text-center">DEMO: KODE AKSES = SUSI2026</p>
        </form>
      </div>
    </div>
  );
}

/* ============ DASHBOARD PAGE ============ */
/* ============ PETA SEKTOR BANDUNG (ABSTRAK SWISS) ============ */
function SectorMap() {
  const sectors = [
    { l: 'BARAT–UTARA', n: 7 },
    { l: 'TIMUR–UTARA', n: 4 },
    { l: 'BARAT–SELATAN', n: 6 },
    { l: 'TIMUR–SELATAN', n: 3 },
  ];
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-px bg-black border-2 border-black">
        {sectors.map((s, i) => (
          <div key={i} className="bg-white p-5 hover:bg-[#FF5733] hover:text-white transition-colors duration-300 group cursor-default">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black tabular-nums">{s.n}</span>
              <span className="w-2 h-2 bg-[#FF5733] group-hover:bg-white rotate-45 transition-colors" />
            </div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest mt-2 opacity-60 group-hover:opacity-90">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-black text-white flex items-center justify-center rotate-45 border-2 border-black">
        <span className="-rotate-45 text-[8px] font-mono font-bold">KOTA</span>
      </div>
    </div>
  );
}


/* ============ DASHBOARD BERANDA (PAPAN KENDALI) ============ */
function DashboardPage({ user, onLogout, navigateTo }) {
  const role = user?.role || 'requester';
  const [applied, setApplied] = useState([]);
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.bento-card', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => {
        const target = +el.dataset.target;
        const obj = { val: 0 };
        gsap.to(obj, { val: target, duration: 1.6, ease: 'power1.out', delay: 0.3, onUpdate: () => { el.textContent = Math.round(obj.val); } });
      });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.5 });
      gsap.fromTo('.feed-item', { x: -20, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.06, delay: 0.4 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const first = (user?.name || 'Warga').split(' ')[0];
  const roleLabel = { requester: 'KOMUNITAS', talent: 'TALENTA', agensusi: 'AGENSUSI', admin: 'ADMIN' }[role];
  const cta = role === 'liaison' ? 'CATAT PENGADUAN WARGA' : 'AJUKAN PENGADUAN';

  const needs = [
    { t: 'Rekap iuran warga RW 05', cat: 'PENCATATAN', sec: 'BARAT–UTARA', time: '2J' },
    { t: 'Website galeri karang taruna', cat: 'WEBSITE', sec: 'TIMUR–SELATAN', time: '5J' },
    { t: 'Aplikasi inventaris PKK', cat: 'APLIKASI', sec: 'BARAT–SELATAN', time: '1H' },
  ];
  const leaders = [
    { n: 'Derien A.', v: 12 },
    { n: 'Ezra P.', v: 9 },
    { n: 'Khalifa H.', v: 7 },
  ];

  return (
    <div ref={rootRef} className="bg-[#F4F4F2] text-black pt-20 min-h-screen">
      {/* TOP BAR */}
      <div className="bg-white border-b-2 border-black px-6 lg:px-12 py-4">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest">
            SUSI / BERANDA / <span className="text-[#FF5733]">{roleLabel}</span>
          </p>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-mono font-bold hidden md:block">KAMIS · 20 AGU 2026</p>
            <button onClick={onLogout} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors">KELUAR</button>
            <div className="flex items-center gap-2 border-2 border-black px-3 py-1.5 bg-white">
              <span className="w-5 h-5 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
              <span className="text-xs font-bold max-w-[140px] truncate">{user?.name || 'User'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* HEADER + CTA PENGADUAN */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/50 mb-3">
              DASBOR · {roleLabel} · SUMBER INTAKE: {role === 'liaison' ? 'ASSISTED' : 'MANDIRI'}
            </p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight">Halo, {first}.</h1>
            <p className="text-sm opacity-60 mt-3 max-w-xl leading-relaxed">
              Pantau kebutuhan digital Kota Bandung — atau mulai Langkah 01 dengan menceritakan masalahmu.
            </p>
          </div>
          <button 
            className="bg-[#FF5733] text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-black transition-all"
            onClick={() => navigateTo('request')}
          >
            + {cta}
          </button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* PETA SEKTOR */}
          <div className="bento-card col-span-12 lg:col-span-5 bg-white border-2 border-black p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black">Peta Kebutuhan</h3>
                <p className="text-[10px] font-mono opacity-50 mt-1">SEKTOR · KOTA BANDUNG</p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-1">20 AKTIF</span>
            </div>
            <SectorMap />
          </div>

          {/* STATISTIK */}
          <div className="bento-card col-span-12 md:col-span-6 lg:col-span-4 grid grid-cols-3 lg:grid-cols-1 gap-px bg-black border-2 border-black">
            {[
              { t: 20, l: 'Kebutuhan terbuka' },
              { t: 8, l: 'Sedang dikerjakan' },
              { t: 127, l: 'Selesai terverifikasi' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                <div className="text-4xl lg:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
              </div>
            ))}
          </div>

          {/* SUMBER INTAKE */}
          <div className="bento-card col-span-12 md:col-span-6 lg:col-span-3 bg-white border-2 border-black p-8 flex flex-col justify-between">
            <h3 className="text-xl font-black mb-6">Sumber Intake</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>MANDIRI</span><span>58%</span></div>
                <div className="h-2 bg-black/10"><div className="bar-h h-full bg-black" style={{ width: '58%' }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>ASSISTED · LIAISON</span><span>42%</span></div>
                <div className="h-2 bg-black/10"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '42%' }} /></div>
              </div>
            </div>
            <p className="text-[10px] font-mono opacity-50 mt-6 leading-relaxed">F2 · DUA JALUR MASUK — KOMUNITAS GAPTEK TETAP TERLAYANI.</p>
          </div>

          {/* KATALOG TERBARU */}
          <div className="bento-card col-span-12 lg:col-span-7 bg-white border-2 border-black p-8">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-black">Kebutuhan Terbaru</h3>
              <span className="text-[10px] font-mono font-bold border-2 border-black px-2 py-1">F3 · KATALOG</span>
            </div>
            <div className="space-y-3">
              {needs.map((n, i) => (
                <div key={i} className="border-2 border-black/15 hover:border-black p-5 flex items-center gap-4 flex-wrap transition-colors">
                  <div className="flex-1 min-w-[200px]">
                    <h4 className="font-black">{n.t}</h4>
                    <p className="text-[10px] font-mono opacity-50 mt-1">{n.cat} · SEKTOR {n.sec} · {n.time}</p>
                  </div>
                  {role === 'talent' ? (
                    <button
                      onClick={() => setApplied((a) => (a.includes(i) ? a : [...a, i]))}
                      className={`px-4 py-2 text-[10px] font-mono font-bold border-2 transition-colors ${applied.includes(i) ? 'bg-[#0E7C66] border-[#0E7C66] text-white' : 'border-black hover:bg-black hover:text-white'}`}
                    >
                      {applied.includes(i) ? '✓ TERKIRIM' : 'LAMAR →'}
                    </button>
                  ) : (
                    <Badge type="buka" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PAPAN REPUTASI */}
          <div className="bento-card col-span-12 lg:col-span-5 bg-black text-white border-2 border-black p-8">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-black">Papan Reputasi</h3>
              <span className="text-[10px] font-mono font-bold text-[#FF5733]">F6 · TERVERIFIKASI</span>
            </div>
            <div className="space-y-5">
              {leaders.map((l, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-2xl font-black text-[#FF5733]">0{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-bold mb-1"><span>{l.n}</span><span className="font-mono">{l.v} PROYEK</span></div>
                    <div className="h-1.5 bg-white/15"><div className="bar-h h-full bg-[#FF5733]" style={{ width: `${(l.v / 12) * 100}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-mono opacity-50 mt-6 leading-relaxed">REPUTASI = NILAI TURUNAN KONFIRMASI GANDA. TIDAK BISA DIKLAIM SEPIHAK.</p>
          </div>

          {/* STATUS ANDA (ROLE-AWARE) */}
          <div className="bento-card col-span-12 lg:col-span-7 bg-white border-2 border-black p-8">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-black">Status Anda</h3>
              <span className="text-[10px] font-mono font-bold text-[#FF5733]">{roleLabel}</span>
            </div>
            {role === 'requester' && <VerifyWidget />}
            {role === 'talent' && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>REPUTASI</span><span>12/20</span></div>
                  <div className="h-2 bg-black/10"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '60%' }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Lamaran" value={applied.length + 3} sub="Terkirim" />
                  <StatCard label="Diterima" value="2" sub="Menunggu kesepakatan" />
                </div>
              </div>
            )}
            {role === 'liaison' && (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <StatCard label="Kunjungan" value="23" sub="Bulan ini" accent />
                  <StatCard label="Tercatat" value="19" sub="Kebutuhan masuk" />
                </div>
                <MiniBars data={[{ l: 'M1', v: 4 }, { l: 'M2', v: 6 }, { l: 'M3', v: 5 }, { l: 'M4', v: 8 }]} height={80} />
              </div>
            )}
            {role === 'admin' && (
              <ProjectTable rows={[
                { p: 'Aplikasi Iuran Warga', o: 'KT Maju × Derien A.', s: 'tunggu', a: 'MODERASI' },
                { p: 'Website Karang Taruna', o: 'KT Mekar × Ezra P.', s: 'proses', a: 'DETAIL' },
                { p: 'Galeri Fotografi', o: 'Hobi Foto × Khalifa H.', s: 'selesai', a: 'LIHAT' },
              ]} />
            )}
          </div>

          {/* AKTIVITAS */}
          <div className="bento-card col-span-12 lg:col-span-5 bg-white border-2 border-black p-8">
            <h3 className="text-xl font-black mb-4">Aktivitas Platform</h3>
            <ActivityFeed items={[
              { c: 'bg-[#FF5733]', t: 'Pengaduan baru masuk', s: 'RW 05 · sektor Barat–Utara · mandiri', time: '2J' },
              { c: 'bg-black', t: 'AgenSUSI mencatat kebutuhan', s: 'PKK Cijerah · assisted', time: '4J' },
              { c: 'bg-[#0E7C66]', t: 'Verifikasi dua arah selesai', s: 'Galeri Fotografi · reputasi +1', time: '1H' },
              { c: 'bg-black', t: 'Talenta baru mendaftar', s: 'Career switcher · Bandung Timur', time: '3H' },
            ]} />
          </div>
        </div>
      </div>


    </div>
  );
}

/* ============ TENTANG PAGE ============ */
function TentangPage() {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.tentang-reveal', { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} className="bg-white text-black pt-32">
      <section className="px-6 lg:px-12 py-20 border-b-2 border-black">
        <div className="max-w-[1440px] mx-auto">
          <p className="text-xs uppercase tracking-[0.4em] text-black/50 font-bold mb-4">04 / TENTANG KAMI</p>
          <h1 className="tentang-reveal text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8">Tim SUSI<span className="text-[#FF5733]">.</span></h1>
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-black mb-20">
            {[
              { n: 'Hasby Wira Al Muflih', r: 'Ketua Tim', i: 'HW' },
              { n: 'Derien Adelio Rhaivan', r: 'Developer', i: 'DA' },
              { n: 'Mohammad Ezra Putra Arkana', r: 'Developer', i: 'ME' },
              { n: 'Muhammad Khalifa Aisy Hafiy', r: 'Developer', i: 'MK' },
            ].map((m, idx) => (
              <div key={idx} className="tentang-reveal bg-white p-10 group hover:bg-[#FF5733] hover:text-white transition-colors duration-500">
                <div className="w-20 h-20 border-2 border-black group-hover:border-white flex items-center justify-center text-2xl font-black mb-6 transition-transform group-hover:rotate-12">{m.i}</div>
                <h4 className="font-black text-lg mb-2">{m.n}</h4>
                <p className="text-xs font-mono font-bold uppercase tracking-wider opacity-60">{m.r}</p>
              </div>
            ))}
          </div>
          <div className="tentang-reveal border-2 border-black p-10 md:p-16 text-center">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">SMKN 4 Bandung · SATU CREANOVA 2026</h2>
            <p className="text-black/60 max-w-2xl mx-auto">Jl. Ambon No.11 Kota Bandung, Jawa Barat, 40132</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============ HELPER: BADGE & STEPS (LEVEL ATAS) ============ */
function AppBadge({ s }) {
  const m = { MENUNGGU: 'bg-yellow-300 text-black', DITERIMA: 'bg-[#0E7C66] text-white', DITOLAK: 'bg-black text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
}

function ProjSteps({ status }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  const labels = [
    { n: '04', l: 'SETUJU' },
    { n: '05', l: 'GARAP' },
    { n: '06', l: 'SELESAI' },
    { n: '07', l: 'VERIFIKASI' },
  ];
  const curIdx = status === 'PROSES' ? 1 : status === 'VERIFIKASI' ? 3 : 0;
  const pct = status === 'PROSES' ? 50 : status === 'VERIFIKASI' ? 83 : 10;

  return (
    <div>
      {/* Header: label + persen */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-60">Progress Projek</p>
        <p className="text-[10px] font-mono font-black text-[#FF5733]">{pct}%</p>
      </div>

      {/* Track + fill + node wajik */}
      <div className="relative mx-2">
        <div className="h-3 border-2 border-black bg-white overflow-hidden">
          <div
            className="h-full bg-[#FF5733] transition-all duration-1000 ease-out"
            style={{ width: mounted ? `${pct}%` : '0%' }}
          />
        </div>
        {labels.map((s, i) => (
          <span
            key={s.n}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-45 border-2 border-black transition-colors ${
              i < curIdx ? 'bg-[#0E7C66]' : i === curIdx ? 'bg-[#FF5733] animate-pulse' : 'bg-white'
            }`}
            style={{ left: `${(i / 3) * 100}%` }}
          />
        ))}
      </div>

      {/* Label langkah */}
      <div className="relative mx-2 mt-2 h-7">
        {labels.map((s, i) => (
          <span
            key={s.n}
            className={`absolute text-[8px] font-mono font-bold leading-tight ${
              i === 0 ? 'left-0' : i === 3 ? 'right-0 text-right' : '-translate-x-1/2 text-center'
            } ${i === curIdx ? 'text-[#FF5733]' : 'opacity-50'}`}
            style={i === 1 || i === 2 ? { left: `${(i / 3) * 100}%` } : undefined}
          >
            {s.n} {s.l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============ DASHBOARD TALENTA ============ */
function DashboardTalent({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('jelajahi');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('SEMUA');
  const [appliedIds, setAppliedIds] = useState([11]);
  const [selectedNeed, setSelectedNeed] = useState(null);
  const [applyMsg, setApplyMsg] = useState('');
  const [histFilter, setHistFilter] = useState('SEMUA');
  const [agreeTarget, setAgreeTarget] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifs, setNotifs] = useState([
    { id: 1, type: 'verifikasi', title: 'PKK RW 05 belum mengonfirmasi', sub: 'Formulir Pendaftaran · menunggu langkah 07', read: false },
    { id: 2, type: 'talenta', title: 'Lamaran Anda dilihat', sub: 'Katalog Inventaris PKK · 3 jam lalu', read: false },
    { id: 3, type: 'diskusi', title: 'PKK RW 05 membalas diskusi Anda', sub: 'Forum Diskusi · 1 hari lalu', read: false },
    { id: 4, type: 'sistem', title: 'Reputasi Anda: 12 / 20', sub: '2 proyek lagi menuju level berikutnya', read: true },
  ]);
  const [projects, setProjects] = useState([
    { id: 1, t: 'Aplikasi Iuran Warga', comm: 'PKK RW 05', scope: 'Form rekap iuran + dashboard sederhana, akses via HP.', deadline: '30 AGU 2026', status: 'PROSES' },
    { id: 2, t: 'Website Galeri Karang Taruna', comm: 'Karang Taruna Mekar', scope: 'Landing page + galeri foto kegiatan.', deadline: '12 SEP 2026', status: 'KESEPAKATAN' },
    { id: 3, t: 'Formulir Pendaftaran Digital', comm: 'Forum Warga Bandung', scope: 'Form pendaftaran warga baru.', deadline: '01 AGU 2026', status: 'VERIFIKASI' },
  ]);
  const [applications, setApplications] = useState([
    { id: 1, t: 'Aplikasi Iuran Warga', comm: 'PKK RW 05', date: '02 AGU 2026', status: 'DITERIMA' },
    { id: 2, t: 'Website Galeri', comm: 'KT Mekar', date: '05 AGU 2026', status: 'DITERIMA' },
    { id: 3, t: 'Katalog Inventaris PKK', comm: 'PKK RW 05', date: '10 AGU 2026', status: 'MENUNGGU' },
    { id: 4, t: 'Sistem Absensi Pemuda', comm: 'KT Mekar', date: '28 JUL 2026', status: 'DITOLAK' },
  ]);
  const detailMapEl = useRef(null);
  const detailMapInst = useRef(null);
  const rootRef = useRef(null);

  const NOTIF_META = {
    talenta: { c: '#FF5733', l: 'LAMARAN' },
    verifikasi: { c: '#0E7C66', l: 'VERIFIKASI' },
    diskusi: { c: '#000000', l: 'DISKUSI' },
    sistem: { c: '#9CA3AF', l: 'SISTEM' },
  };
  const unread = notifs.filter((n) => !n.read).length;
  const markAll = () => setNotifs(notifs.map((n) => ({ ...n, read: true })));
  const markOne = (id) => setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: true } : n)));

  /* ===== DATA KEBUTUHAN (dengan detail + lokasi) ===== */
  const NEEDS = [
    {
      id: 10, t: 'Rekap Iuran Warga RW 05', comm: 'PKK RW 05', leader: 'Ibu Siti Aminah', m: 48,
      cat: 'PENCATATAN', sec: 'BARAT–UTARA', apps: 3, time: '2J',
      d: 'Iuran masih dicatat di buku tulis, sering hilang & susah direkap.',
      full: 'Setiap bulan pengurus PKK harus merekap iuran dari 48 kepala keluarga secara manual. Buku catatan sering tertukar atau hilang, sehingga sulit mengetahui siapa yang sudah dan belum membayar. Kami butuh cara sederhana supaya warga bisa cek iuran sendiri lewat HP.',
      addr: 'Balai RW 05, Kel. Sukajadi', lat: -6.8850, lng: 107.5750,
      skill: ['PENCATATAN', 'WEB SEDERHANA'],
    },
    {
      id: 11, t: 'Website Galeri Karang Taruna', comm: 'Karang Taruna Mekar', leader: 'Budi Santoso', m: 65,
      cat: 'WEBSITE', sec: 'TIMUR–SELATAN', apps: 5, time: '5J',
      d: 'Butuh tempat pamer kegiatan & foto biar warga makin terlibat.',
      full: 'Dokumentasi kegiatan pemuda menumpuk di folder WhatsApp dan tidak pernah dilihat lagi. Kami ingin ada website galeri sederhana supaya warga tahu kegiatan kami dan tertarik bergabung.',
      addr: 'Sekretariat KT Mekar, Jl. Mekar Sari', lat: -6.9350, lng: 107.6650,
      skill: ['WEBSITE', 'DESAIN'],
    },
    {
      id: 12, t: 'Aplikasi Inventaris PKK', comm: 'PKK RW 05', leader: 'Ibu Siti Aminah', m: 48,
      cat: 'APLIKASI', sec: 'BARAT–SELATAN', apps: 2, time: '1H',
      d: 'Data barang pinjaman warga berantakan di grup WhatsApp.',
      full: 'PKK punya barang pinjaman (tenda, kursi, sound system) yang sering dipinjam warga. Catatannya berantakan di grup WhatsApp, jadi sering ada barang yang tidak kembali. Kami butuh aplikasi sederhana untuk mencatat peminjaman.',
      addr: 'Rumah Ketua PKK, RW 05', lat: -6.9250, lng: 107.5850,
      skill: ['APLIKASI', 'PENCATATAN'],
    },
    {
      id: 13, t: 'Formulir Pendaftaran Digital', comm: 'Forum Warga Bandung', leader: 'Haji Rahmat', m: 54,
      cat: 'LAINNYA', sec: 'TIMUR–UTARA', apps: 1, time: '3J',
      d: 'Pendaftaran warga baru masih pakai kertas fotokopian.',
      full: 'Setiap ada warga baru, mereka harus mengisi kertas fotokopian yang sering salah tulis. Kami ingin formulir digital yang datanya langsung rapi tersimpan.',
      addr: 'Pos Warga, Jl. Warga Baru', lat: -6.8950, lng: 107.6550,
      skill: ['FORM DIGITAL'],
    },
  ];

  const TPROFILE = {
    bio: 'Fresh graduate teknik informatika yang ingin membangun portofolio nyata sambil membantu komunitas Bandung.',
    skills: ['React', 'Node.js', 'MySQL', 'Figma', 'Laravel'],
    reputasi: 12, target: 20, level: 'TALENTA MUDA',
    joinDate: 'JUN 2026', wa: '+62 812-****-4321', sektor: 'TIMUR–SELATAN',
    track: [
      { date: 'JUL 2026', t: 'Formulir Pendaftaran Digital', comm: 'Forum Warga Bandung', testi: '"Pengerjaan cepat, komunikasi jelas."' },
      { date: 'JUN 2026', t: 'Katalog UMKM', comm: 'Paguyuban Pedagang', testi: '"Sangat membantu, mudah dipakai anggota."' },
    ],
  };

  useEffect(() => {
    const onClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (notifOpen) gsap.fromTo('.notif-panel', { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
  }, [notifOpen]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => {
        const t = +el.dataset.target; const o = { val: 0 };
        gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } });
      });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selectedNeed]);

  /* ===== PETA LOKASI DI HALAMAN DETAIL ===== */
  useEffect(() => {
    if (!selectedNeed || !detailMapEl.current || detailMapInst.current) return;
    const map = L.map(detailMapEl.current).setView([selectedNeed.lat, selectedNeed.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    L.marker([selectedNeed.lat, selectedNeed.lng], {
      icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;background:#FF5733;border:2px solid #000;transform:rotate(45deg);box-shadow:2px 2px 0 rgba(0,0,0,.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).addTo(map);
    detailMapInst.current = map;
    return () => { map.remove(); detailMapInst.current = null; };
  }, [selectedNeed]);

  const first = (user?.name || 'Talenta').split(' ')[0];

  const NAV = [
    { id: 'jelajahi', n: '01', l: 'JELAJAHI KEBUTUHAN' },
    { id: 'histori', n: '02', l: 'HISTORI PENGAJUAN' },
    { id: 'projek', n: '03', l: 'PROJEK SAYA' },
    { id: 'profil', n: '04', l: 'PROFIL' },
  ];

  const filteredNeeds = NEEDS.filter((n) => {
    const q = search.toLowerCase();
    const matchQ = !q || n.t.toLowerCase().includes(q) || n.comm.toLowerCase().includes(q) || n.d.toLowerCase().includes(q);
    const matchC = catFilter === 'SEMUA' || n.cat === catFilter;
    return matchQ && matchC;
  });

  const filteredHist = histFilter === 'SEMUA' ? applications : applications.filter((a) => a.status === histFilter);

  const submitApply = () => {
    if (!selectedNeed) return;
    setAppliedIds((a) => [...a, selectedNeed.id]);
    setApplications((a) => [{ id: Date.now(), t: selectedNeed.t, comm: selectedNeed.comm, date: 'HARI INI', status: 'MENUNGGU' }, ...a]);
    setApplyMsg('');
  };

  const setProjStatus = (id, status) => setProjects((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));

  return (
    <div ref={rootRef} className="bg-[#F4F4F2] text-black min-h-screen">
      {/* TOPBAR */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-white border-b-2 border-black z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('home')} className="text-2xl font-black tracking-tighter hover:text-[#FF5733] transition-colors shrink-0">
            SUSI<span className="text-[#FF5733]">.</span>
          </button>
          <div className="flex-1" />
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className={`relative w-10 h-10 border-2 border-black flex items-center justify-center transition-colors ${notifOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="w-5 h-5">
                <path d="M12 3v2" /><path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3v-4z" /><path d="M10 20h4" />
              </svg>
              {unread > 0 && (
                <>
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#FF5733] animate-ping" />
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-[#FF5733] text-white text-[9px] font-black flex items-center justify-center border-2 border-black px-0.5">{unread}</span>
                </>
              )}
            </button>
            {notifOpen && (
              <div className="notif-panel absolute right-0 top-12 w-[340px] md:w-[380px] bg-white border-2 border-black shadow-[6px_6px_0_0_#000] z-[60]">
                <div className="flex items-center justify-between p-4 border-b-2 border-black">
                  <div>
                    <p className="text-sm font-black">NOTIFIKASI</p>
                    <p className="text-[9px] font-mono opacity-50">{unread} BELUM DIBACA</p>
                  </div>
                  <button onClick={markAll} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">TANDAI SEMUA</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => markOne(n.id)} className={`w-full text-left p-4 border-b-2 border-black/10 last:border-b-0 flex gap-3 transition-colors ${n.read ? 'opacity-50 hover:opacity-80' : 'bg-[#FF5733]/5 hover:bg-[#FF5733]/10'}`}>
                      <span className="w-2 h-2 mt-1.5 shrink-0 rotate-45" style={{ background: NOTIF_META[n.type].c }} />
                      <div className="flex-1 min-w-0">
                        <span className="inline-block text-[8px] font-mono font-bold px-1.5 py-0.5 text-white mb-0.5" style={{ background: NOTIF_META[n.type].c }}>{NOTIF_META[n.type].l}</span>
                        <p className="text-xs font-black leading-snug">{n.title}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{n.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-2 border-black px-3 py-2 bg-white">
            <span className="w-6 h-6 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-black">{first}</p>
              <p className="text-[9px] font-mono text-[#FF5733] font-bold mt-0.5">TALENTA</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">KELUAR</button>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white border-r-2 border-black z-40 flex-col justify-between">
        <div className="p-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dasbor Talenta</p>
          <div className="space-y-2">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => { setTab(n.id); setSelectedNeed(null); }} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${tab === n.id ? 'bg-black text-white shadow-[4px_4px_0_0_#FF5733]' : 'hover:bg-black/5'}`}>
                <span className={`text-[10px] font-mono font-bold ${tab === n.id ? 'text-[#FF5733]' : 'opacity-40'}`}>{n.n}</span>
                <span className="text-xs font-black uppercase tracking-wider">{n.l}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t-2 border-black">
          <p className="text-[10px] font-mono opacity-50 leading-relaxed">F1 · PERAN: TALENTA<br />HAK AKSES DITEGAKKAN DI SERVER.</p>
        </div>
      </aside>

      {/* NAV MOBILE */}
      <div className="lg:hidden fixed top-20 left-0 right-0 z-40 bg-white border-b-2 border-black overflow-x-auto">
        <div className="flex px-4 py-3 gap-2 w-max">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => { setTab(n.id); setSelectedNeed(null); }} className={`shrink-0 px-4 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${tab === n.id ? 'bg-black text-white border-black' : 'border-black/20'}`}>
              {n.l}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="pt-40 lg:pt-28 lg:pl-64 pb-16">
        <div className="px-5 lg:px-10 max-w-[1200px]">

          {/* ===== TAB: JELAJAHI (LIST) ===== */}
          {tab === 'jelajahi' && !selectedNeed && (
            <>
              <div className="dash-item border-2 border-black bg-white p-8 md:p-10 mb-6">
                <span className="text-[10px] font-mono font-bold text-[#FF5733]">F3 · KATALOG TERBUKA</span>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, {first}.</h1>
                <p className="text-sm opacity-60 max-w-xl leading-relaxed mb-6">Klik "Ajukan Diri" untuk membaca detail masalah komunitas sebelum mengirim pengajuan.</p>
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] bg-transparent mb-4" placeholder="Cari: judul, komunitas, atau masalah..." />
                <div className="flex flex-wrap gap-1">
                  {['SEMUA', 'PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                    <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${catFilter === c ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{c}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[{ t: NEEDS.length, l: 'Kebutuhan terbuka' }, { t: applications.length, l: 'Pengajuan terkirim' }, { t: 2, l: 'Projek selesai' }].map((s, i) => (
                  <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                    <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredNeeds.map((n) => (
                  <div key={n.id} className="dash-item relative border-2 border-black bg-white p-6 pt-8 hover:shadow-[6px_6px_0_0_#FF5733] hover:-translate-y-1 transition-all">
                    <span className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-[#FF5733] border-2 border-black rotate-45" />
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1">{n.cat}</span>
                      <span className="text-[9px] font-mono opacity-50">{n.time} · {n.apps} PELAMAR</span>
                    </div>
                    <h4 className="font-black text-lg leading-tight mb-1">{n.t}</h4>
                    <p className="text-[10px] font-mono opacity-50 mb-3">{n.comm} · SEKTOR {n.sec}</p>
                    <p className="text-xs opacity-60 leading-relaxed mb-5">{n.d}</p>
                    <button
                      onClick={() => setSelectedNeed(n)}
                      className={`w-full py-3 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${appliedIds.includes(n.id) ? 'bg-[#0E7C66] border-[#0E7C66] text-white' : 'border-black hover:bg-black hover:text-white'}`}
                    >
                      {appliedIds.includes(n.id) ? '✓ Terkirim — Lihat Detail' : 'Ajukan Diri →'}
                    </button>
                  </div>
                ))}
                {filteredNeeds.length === 0 && (
                  <p className="dash-item col-span-full border-2 border-black bg-white p-8 text-center text-xs font-mono opacity-50">TIDAK ADA HASIL UNTUK PENCARIAN INI.</p>
                )}
              </div>
            </>
          )}

          {/* ===== TAB: JELAJAHI (HALAMAN DETAIL) ===== */}
          {tab === 'jelajahi' && selectedNeed && (() => {
            const n = selectedNeed;
            const applied = appliedIds.includes(n.id);
            return (
              <>
                <div className="dash-item mb-6">
                  <button onClick={() => setSelectedNeed(null)} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← KEMBALI KE DAFTAR</button>
                </div>

                {/* HEADER: MASALAH */}
                <div className="dash-item border-2 border-black bg-white p-8 md:p-10 mb-6">
                  <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                    <span className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1">{n.cat}</span>
                    <span className="text-[9px] font-mono opacity-50">{n.time} LALU · {n.apps} PELAMAR</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-6">{n.t}</h1>
                  <p className="text-[10px] font-mono font-bold text-[#FF5733] uppercase mb-3">MASALAH YANG DIALAMI KOMUNITAS</p>
                  <p className="text-sm md:text-base leading-relaxed opacity-80 max-w-3xl mb-6">{n.full}</p>
                  <div className="flex flex-wrap gap-2">
                    {n.skill.map((s) => (
                      <span key={s} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-6 mb-6">
                  {/* KOMUNITAS PENGADU */}
                  <div className="col-span-12 lg:col-span-5">
                    <div className="dash-item bg-black text-white border-2 border-black p-7 h-full">
                      <p className="text-[10px] font-mono text-[#FF5733] font-bold uppercase mb-4">KOMUNITAS PENGADU</p>
                      <div className="w-16 h-16 bg-[#FF5733] flex items-center justify-center text-2xl font-black mb-4">{n.comm.charAt(0)}</div>
                      <h3 className="text-2xl font-black leading-tight">{n.comm}</h3>
                      <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest mt-1">PIC: {n.leader}</p>
                      <div className="mt-5 pt-5 border-t-2 border-white/20 text-xs font-mono opacity-70 space-y-2">
                        <p>SEKTOR: {n.sec}</p>
                        <p>{n.m} ANGGOTA</p>
                      </div>
                    </div>
                  </div>

                  {/* LOKASI */}
                  <div className="col-span-12 lg:col-span-7">
                    <div className="dash-item border-2 border-black bg-white p-7 h-full">
                      <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest">LOKASI KOMUNITAS</p>
                        <span className="text-[9px] font-mono bg-black text-white px-2 py-1">{n.lat.toFixed(3)}, {n.lng.toFixed(3)}</span>
                      </div>
                      <div className="relative z-0 border-2 border-black h-[240px]">
                        <div ref={detailMapEl} className="w-full h-full" />
                      </div>
                      <p className="text-[10px] font-mono opacity-60 mt-3">📍 {n.addr} · SEKTOR {n.sec}</p>
                    </div>
                  </div>
                </div>

                {/* PENGAJUAN */}
                <div className="dash-item border-2 border-black bg-white p-7">
                  {applied ? (
                    <div className="text-center py-6">
                      <div className="inline-flex w-16 h-16 bg-[#0E7C66] text-white items-center justify-center text-3xl font-black mb-4">✓</div>
                      <h3 className="text-xl font-black mb-1">PENGAJUAN TERKIRIM</h3>
                      <p className="text-xs opacity-60 mb-5">Menunggu respon dari {n.comm}. Pantau statusnya di Histori Pengajuan.</p>
                      <button onClick={() => setTab('histori')} className="border-2 border-black px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">LIHAT HISTORI →</button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] font-mono font-bold text-[#FF5733] uppercase mb-2">F3 · PENGAJUAN DIRI</p>
                      <h3 className="text-xl font-black mb-4">Ajukan Diri untuk Projek Ini</h3>
                      <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Pesan Pengantar</label>
                      <textarea value={applyMsg} onChange={(e) => setApplyMsg(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] h-28 resize-none mb-4" placeholder="Jelaskan kenapa Anda cocok & bagaimana pendekatan Anda..." />
                      <button onClick={submitApply} className="w-full bg-[#FF5733] text-white py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">KIRIM PENGAJUAN →</button>
                    </>
                  )}
                </div>
              </>
            );
          })()}

          {/* ===== TAB: HISTORI PENGAJUAN ===== */}
          {tab === 'histori' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Histori Pengajuan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">SEMUA PENGAJUAN YANG PERNAH ANDA KIRIM</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['SEMUA', 'MENUNGGU', 'DITERIMA', 'DITOLAK'].map((s) => (
                    <button key={s} onClick={() => setHistFilter(s)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${histFilter === s ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[
                  { t: applications.filter((a) => a.status === 'MENUNGGU').length, l: 'Menunggu' },
                  { t: applications.filter((a) => a.status === 'DITERIMA').length, l: 'Diterima' },
                  { t: applications.filter((a) => a.status === 'DITOLAK').length, l: 'Ditolak' },
                ].map((s, i) => (
                  <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                    <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="dash-item border-2 border-black bg-white p-7">
                <div className="space-y-0">
                  {filteredHist.map((a) => (
                    <div key={a.id} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-black/10 last:border-transparent">
                      <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-black ${a.status === 'DITERIMA' ? 'bg-[#0E7C66]' : a.status === 'MENUNGGU' ? 'bg-yellow-300' : 'bg-black'}`} />
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="text-[10px] font-mono font-bold">{a.date}</span>
                        <AppBadge s={a.status} />
                      </div>
                      <h4 className="font-black text-base mb-1">{a.t}</h4>
                      <p className="text-[10px] font-mono opacity-50">{a.comm}</p>
                      {a.status === 'DITERIMA' && (
                        <button onClick={() => setTab('projek')} className="mt-2 text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">LIHAT DI PROJEK SAYA →</button>
                      )}
                    </div>
                  ))}
                  {filteredHist.length === 0 && <p className="text-center text-xs font-mono opacity-50 py-6">BELUM ADA PENGADUAN DENGAN STATUS INI.</p>}
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: PROJEK SAYA ===== */}
          {tab === 'projek' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Projek Saya</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">PROGRES SETIAP PROJEK · LANGKAH 04–08</p>
                </div>
              </div>
              <div className="space-y-6">
                {projects.map((p) => (
                  <div key={p.id} className="dash-item border-2 border-black bg-white p-7">
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-5">
                      <div>
                        <h3 className="text-2xl font-black leading-tight">{p.t}</h3>
                        <p className="text-[10px] font-mono opacity-50 mt-1">{p.comm} · DEADLINE {p.deadline}</p>
                      </div>
                      {p.status === 'VERIFIKASI' && <span className="text-[9px] font-mono font-bold bg-yellow-300 text-black px-2 py-1">MENUNGGU KOMUNITAS · LANGKAH 07</span>}
                      {p.status === 'PROSES' && <span className="text-[9px] font-mono font-bold bg-black text-white px-2 py-1">SEDANG DIGARAP · LANGKAH 05</span>}
                      {p.status === 'KESEPAKATAN' && <span className="text-[9px] font-mono font-bold bg-[#FF5733] text-white px-2 py-1">AKSI DIBUTUHKAN · LANGKAH 04</span>}
                    </div>
                    <div className="grid grid-cols-12 gap-6 items-start">
                      <div className="col-span-12 lg:col-span-7">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2">Lingkup Pekerjaan</p>
                        <p className="text-sm opacity-70 leading-relaxed mb-4">{p.scope}</p>
                        <p className="text-[10px] font-mono opacity-50 leading-relaxed">💬 KOMUNIKASI HARIAN VIA WHATSAPP — DI LUAR SISTEM (LANGKAH 05).</p>
                      </div>
                      <div className="col-span-12 lg:col-span-5">
                        <ProjSteps status={p.status} />
                        <div className="mt-4">
                          {p.status === 'KESEPAKATAN' && (
                            <button onClick={() => setAgreeTarget(p)} className="w-full bg-[#FF5733] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Lihat Kesepakatan & Setuju →</button>
                          )}
                          {p.status === 'PROSES' && (
                            <button onClick={() => setProjStatus(p.id, 'VERIFIKASI')} className="w-full bg-black text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#0E7C66] transition-colors">Tandai Selesai · Langkah 06 →</button>
                          )}
                          {p.status === 'VERIFIKASI' && (
                            <p className="w-full text-center border-2 border-black/20 py-3 text-[10px] font-mono font-bold opacity-60">REPUTASI +1 SAAT KOMUNITAS MEMBENARKAN</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== TAB: PROFIL ===== */}
          {tab === 'profil' && (
            <>
              <div className="dash-item border-2 border-black bg-black text-white p-8 md:p-10 mb-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 border-2 border-[#FF5733]/30" />
                <div className="absolute bottom-0 right-20 w-20 h-20 bg-[#FF5733]" />
                <div className="grid grid-cols-12 gap-6 relative z-10">
                  <div className="col-span-12 md:col-span-4 flex flex-col items-center md:items-start gap-4">
                    <div className="w-28 h-28 bg-[#FF5733] flex items-center justify-center text-5xl font-black">{user?.name?.charAt(0).toUpperCase()}</div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">{user?.name}</h2>
                      <p className="text-[10px] font-mono text-[#FF5733] font-bold mt-1">TALENTA · {TPROFILE.level}</p>
                      <p className="text-[10px] font-mono opacity-50 mt-2">BERGABUNG {TPROFILE.joinDate}</p>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-8">
                    <p className="text-sm leading-relaxed opacity-80 mb-6">{TPROFILE.bio}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
                      {[
                        { v: TPROFILE.reputasi, l: 'REPUTASI' },
                        { v: applications.length, l: 'PENGAJUAN' },
                        { v: projects.length, l: 'PROJEK AKTIF' },
                        { v: 2, l: 'SELESAI' },
                      ].map((s, i) => (
                        <div key={i} className="bg-black p-4">
                          <div className="text-3xl font-black tabular-nums text-[#FF5733]">{s.v}</div>
                          <p className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-5 space-y-6">
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <span className="text-[10px] font-mono font-bold text-[#FF5733]">DATA PRIBADI</span>
                    <h3 className="text-xl font-black mt-1 mb-5">Informasi Talenta</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b-2 border-black/10 pb-2"><span className="text-[10px] font-mono opacity-50">EMAIL</span><span className="font-bold">{user?.name?.toLowerCase().replace(' ', '.')}@susi.id</span></div>
                      <div className="flex justify-between border-b-2 border-black/10 pb-2"><span className="text-[10px] font-mono opacity-50">WHATSAPP</span><span className="font-bold">{TPROFILE.wa}</span></div>
                      <div className="flex justify-between border-b-2 border-black/10 pb-2"><span className="text-[10px] font-mono opacity-50">SEKTOR</span><span className="font-bold">{TPROFILE.sektor}</span></div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-6 mb-3">Keahlian</p>
                    <div className="flex flex-wrap gap-2">
                      {TPROFILE.skills.map((s) => (
                        <span key={s} className="text-[10px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors cursor-default">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <span className="text-[10px] font-mono font-bold text-[#FF5733]">PROGRESS LEVEL</span>
                    <h3 className="text-xl font-black mt-1 mb-5">Menuju Level Berikutnya</h3>
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2">
                      <span>{TPROFILE.level}</span>
                      <span>{TPROFILE.reputasi} / {TPROFILE.target}</span>
                    </div>
                    <div className="h-3 bg-black/10 border-2 border-black">
                      <div className="bar-h h-full bg-[#FF5733]" style={{ width: `${(TPROFILE.reputasi / TPROFILE.target) * 100}%` }} />
                    </div>
                    <p className="text-[10px] font-mono opacity-50 mt-3 leading-relaxed">{TPROFILE.target - TPROFILE.reputasi} PROYEK TERVERIFIKASI LAGI MENUJU "TALENTA TERPERCAYA".</p>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-7">
                  <div className="dash-item border-2 border-black bg-[#0E7C66] text-white p-7">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <span className="text-[10px] font-mono font-bold opacity-80">F6 · REKAM JEJAK</span>
                        <h3 className="text-xl font-black mt-1">Projek Terverifikasi</h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold">{TPROFILE.track.length}</span>
                    </div>
                    <div className="space-y-5">
                      {TPROFILE.track.map((t, i) => (
                        <div key={i} className="border-b-2 border-white/20 pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <span className="text-[10px] font-mono font-bold">{t.date}</span>
                            <span className="text-[9px] font-mono font-bold bg-white text-[#0E7C66] px-2 py-0.5">✓ SELESAI</span>
                          </div>
                          <h4 className="font-black text-base mb-1">{t.t}</h4>
                          <p className="text-[10px] font-mono opacity-70 mb-2">{t.comm}</p>
                          <p className="text-sm italic leading-relaxed">{t.testi}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL KESEPAKATAN */}
      {agreeTarget && (
        <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl border-2 border-[#FF5733] p-8 relative">
            <button onClick={() => setAgreeTarget(null)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white transition-colors">×</button>
            <span className="text-[10px] font-mono font-bold text-[#FF5733]">F4 · KESEPAKATAN LINGKUP</span>
            <h3 className="text-2xl font-black mt-2 mb-5">{agreeTarget.t}</h3>
            <div className="space-y-3 mb-6">
              <div className="p-4 border-2 border-black bg-[#FAFAFA]"><p className="text-[10px] font-mono font-bold uppercase mb-1">Lingkup</p><p className="text-sm">{agreeTarget.scope}</p></div>
              <div className="p-4 border-2 border-black bg-[#FAFAFA]"><p className="text-[10px] font-mono font-bold uppercase mb-1">Definisi "SELESAI"</p><p className="text-sm">Disepakati dua arah dengan komunitas sebelum pengerjaan (Langkah 04).</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAgreeTarget(null)} className="flex-1 border-2 border-black py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Nanti Dulu</button>
              <button onClick={() => { setProjStatus(agreeTarget.id, 'PROSES'); setAgreeTarget(null); }} className="flex-1 bg-[#0E7C66] text-white py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Setuju & Mulai →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ DASHBOARD REQUESTER ============ */
function DashboardRequester({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [filter, setFilter] = useState('SEMUA');
  const [supports, setSupports] = useState({});
  const [sets, setSets] = useState({ email: true, lokasi: true, whatsapp: false, notifTalenta: true, notifDiskusi: true, notifPengaduan: true, darkMode: false, bahasa: 'ID' });
  const [selectedComm, setSelectedComm] = useState(null);
  const [discussions, setDiscussions] = useState([
    { id: 1, user: 'Budi Santoso', comm: 'Karang Taruna Mekar', time: '2J', text: 'Ada yang pernah bikin aplikasi absensi digital?', replies: [
      { user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '1J', text: 'Kami pernah pakai Google Forms + spreadsheet.' },
    ]},
    { id: 2, user: 'Ibu Siti Aminah', comm: 'PKK RW 05', time: '5J', text: 'Mau tanya, ada komunitas yang sudah bikin website profil?', replies: []},
  ]);
  const [newDiscussion, setNewDiscussion] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const rootRef = useRef(null);

  /* ===== STATE MAP ===== */
  const [mapComm, setMapComm] = useState(null);
  const [markMode, setMarkMode] = useState(false);
  const markModeRef = useRef(false);
  const [tempLoc, setTempLoc] = useState(null);
  const [myCommName, setMyCommName] = useState('');
  const [myCommCat, setMyCommCat] = useState('KELUARGA');
  const [myComms, setMyComms] = useState([]);
  const mapEl = useRef(null);
  const mapInst = useRef(null);
  const markersLayer = useRef(null);
  const tempMarker = useRef(null);

  /* ===== STATE NOTIFIKASI ===== */
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifs, setNotifs] = useState([
    { id: 1, type: 'talenta', title: 'Derien A. melamar kebutuhan Anda', sub: 'Aplikasi Iuran Warga · 2 jam lalu', read: false },
    { id: 2, type: 'verifikasi', title: 'Proyek menunggu verifikasi Anda', sub: 'Rekap Iuran Digital · 5 jam lalu', read: false },
    { id: 3, type: 'diskusi', title: 'Budi Santoso membalas diskusi Anda', sub: 'Forum Diskusi · 1 hari lalu', read: false },
    { id: 4, type: 'sistem', title: 'Selamat datang di SUSI Community', sub: 'Lengkapi profil komunitas Anda · 2 hari lalu', read: true },
  ]);

  const NOTIF_META = {
    talenta: { c: '#FF5733', l: 'TALENTA' },
    verifikasi: { c: '#0E7C66', l: 'VERIFIKASI' },
    diskusi: { c: '#000000', l: 'DISKUSI' },
    sistem: { c: '#9CA3AF', l: 'SISTEM' },
  };

  const unread = notifs.filter((n) => !n.read).length;
  const markAll = () => setNotifs(notifs.map((n) => ({ ...n, read: true })));
  const markOne = (id) => setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: true } : n)));

  /* ===== STATE SETTING ===== */
  const [settingsTab, setSettingsTab] = useState('profil');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { markModeRef.current = markMode; }, [markMode]);

  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (notifOpen) gsap.fromTo('.notif-panel', { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
  }, [notifOpen]);

  useEffect(() => {
    if (tab !== 'map' || !mapEl.current || mapInst.current) return;
    const map = L.map(mapEl.current).setView([-6.9147, 107.6096], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    map.on('click', (e) => { if (markModeRef.current) setTempLoc({ lat: e.latlng.lat, lng: e.latlng.lng }); });
    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; markersLayer.current = null; tempMarker.current = null; };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'map' || !markersLayer.current) return;
    markersLayer.current.clearLayers();
    const makeIcon = (bg, label) => L.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;background:${bg};border:2px solid #000;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 rgba(0,0,0,.4)"><span style="transform:rotate(-45deg);font-family:monospace;font-weight:700;font-size:10px;color:#fff">${label}</span></div>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
    COMMUNITIES.forEach((c) => {
      const m = L.marker([c.lat, c.lng], { icon: makeIcon('#FF5733', c.leader.i) }).addTo(markersLayer.current);
      m.on('click', () => setMapComm({ ...c, mine: false }));
    });
    myComms.forEach((c) => {
      const m = L.marker([c.lat, c.lng], { icon: makeIcon('#0E7C66', '★') }).addTo(markersLayer.current);
      m.on('click', () => setMapComm({ ...c, mine: true }));
    });
  }, [tab, myComms]);

  useEffect(() => {
    if (!mapInst.current) return;
    if (tempMarker.current) { mapInst.current.removeLayer(tempMarker.current); tempMarker.current = null; }
    if (tempLoc) {
      tempMarker.current = L.marker([tempLoc.lat, tempLoc.lng], {
        icon: L.divIcon({ className: '', html: '<div style="width:26px;height:26px;background:#000;border:2px dashed #fff;transform:rotate(45deg)"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(mapInst.current);
    }
  }, [tempLoc]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => {
        const t = +el.dataset.target; const o = { val: 0 };
        gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } });
      });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selectedComm, settingsTab]);

  const first = (user?.name || 'Warga').split(' ')[0];

  const NAV = [
    { id: 'beranda', n: '01', l: 'BERANDA' },
    { id: 'komunitas', n: '02', l: 'KOMUNITAS' },
    { id: 'map', n: '03', l: 'MAP' },
    { id: 'profile', n: '04', l: 'PROFIL' },
    { id: 'setting', n: '05', l: 'SETTING' },
  ];

  const BOARD = [
    { t: 'Rekap iuran warga RW 05', cat: 'PENCATATAN', sec: 'BARAT–UTARA', d: 'Iuran masih dicatat di buku tulis.', c: 12, v: '1.2K' },
    { t: 'Website galeri karang taruna', cat: 'WEBSITE', sec: 'TIMUR–SELATAN', d: 'Butuh tempat pamer kegiatan.', c: 8, v: '851' },
    { t: 'Aplikasi inventaris PKK', cat: 'APLIKASI', sec: 'BARAT–SELATAN', d: 'Data barang berantakan.', c: 5, v: '640' },
    { t: 'Formulir pendaftaran digital', cat: 'LAINNYA', sec: 'TIMUR–UTARA', d: 'Masih pakai kertas.', c: 3, v: '402' },
  ];
  const filtered = filter === 'SEMUA' ? BOARD : BOARD.filter((b) => b.cat === filter);

  const COMMUNITIES = [
    { n: 'PKK RW 05', s: 'BARAT–UTARA', m: 48, t: 'KELUARGA', leader: { n: 'Ibu Siti Aminah', r: 'Ketua PKK RW 05', i: 'SA' }, est: 'MEI 2019', wa: '+62 812-3456-7890', desc: 'Pemberdayaan Keluarga & Kesejahteraan Warga RW 05.', members: [{ n: 'Ibu Siti Aminah', r: 'Ketua', i: 'SA' }, { n: 'Ibu Rina K.', r: 'Sekretaris', i: 'RK' }], lat: -6.8850, lng: 107.5750 },
    { n: 'Karang Taruna Mekar', s: 'TIMUR–SELATAN', m: 65, t: 'PEMUDA', leader: { n: 'Budi Santoso', r: 'Ketua', i: 'BS' }, est: 'JAN 2017', wa: '+62 821-9876-5432', desc: 'Wadah kreatif pemuda.', members: [{ n: 'Budi Santoso', r: 'Ketua', i: 'BS' }, { n: 'Andi Wijaya', r: 'Wakil', i: 'AW' }], lat: -6.9350, lng: 107.6650 },
    { n: 'Hobi Fotografi Bandung', s: 'BARAT–SELATAN', m: 32, t: 'HOBI', leader: { n: 'Farhan Maulana', r: 'Founder', i: 'FM' }, est: 'MAR 2021', wa: '+62 856-1234-5678', desc: 'Komunitas pecinta fotografi.', members: [{ n: 'Farhan Maulana', r: 'Founder', i: 'FM' }], lat: -6.9250, lng: 107.5850 },
    { n: 'Paguyuban Pedagang', s: 'TIMUR–UTARA', m: 54, t: 'UMKM', leader: { n: 'Haji Rahmat', r: 'Ketua', i: 'HR' }, est: 'OKT 2015', wa: '+62 878-5678-1234', desc: 'Paguyuban pedagang.', members: [{ n: 'Haji Rahmat', r: 'Ketua', i: 'HR' }], lat: -6.8950, lng: 107.6550 },
  ];

  const PROFILE = {
    totalProyek: 9, selesai: 7, proses: 1, aktif: 1, reputasi: 42,
    sektor: 'BARAT–UTARA', joinDate: 'MEI 2019',
    bio: 'Pengurus PKK RW 05 yang peduli dengan digitalisasi administrasi warga.',
    timeline: [
      { date: 'AGU 2026', title: 'Website Profil PKK', status: 'selesai', talent: 'Khalifa H.', note: 'Diterima oleh 48 anggota.' },
      { date: 'JUL 2026', title: 'Rekap Iuran Digital', status: 'proses', talent: 'Derien A.', note: 'Target selesai: 30 Agustus 2026.' },
    ],
    testimoni: [
      { text: '"Aplikasi iuran sangat membantu!"', from: 'Derien A.', proyek: 'Aplikasi Iuran PKK', time: '1M lalu' },
      { text: '"Bersedia menjelaskan dengan jelas."', from: 'Khalifa H.', proyek: 'Website Profil', time: '2M lalu' },
    ],
    sektorStats: [{ l: 'Barat-Utara', v: 5 }, { l: 'Timur-Utara', v: 2 }, { l: 'Barat-Selatan', v: 1 }],
    komunitasAktif: [{ n: 'PKK RW 05', s: 'BARAT–UTARA', role: 'Ketua' }],
  };

  const SETTINGS_NAV = [
    { id: 'profil', l: 'PROFIL & KEAMANAN', i: '◉' },
    { id: 'notifikasi', l: 'NOTIFIKASI', i: '◈' },
    { id: 'privasi', l: 'PRIVASI & TAMPILAN', i: '◐' },
    { id: 'integrasi', l: 'INTEGRASI', i: '⇋' },
    { id: 'bahaya', l: 'ZONA BAHAYA', i: '⚠' },
  ];

  const postDiscussion = () => {
    if (!newDiscussion.trim()) return;
    setDiscussions([{ id: Date.now(), user: user?.name || first, comm: 'Anda', time: 'BARU SAJA', text: newDiscussion, replies: [] }, ...discussions]);
    setNewDiscussion('');
  };

  const postReply = (id) => {
    if (!replyText.trim()) return;
    setDiscussions(discussions.map((d) => d.id === id ? { ...d, replies: [...d.replies, { user: user?.name || first, comm: 'Anda', time: 'BARU SAJA', text: replyText }] } : d));
    setReplyText(''); setReplyingTo(null);
  };

  const quadrantOf = (loc) => `${loc.lng < 107.6191 ? 'BARAT' : 'TIMUR'}–${loc.lat > -6.9175 ? 'UTARA' : 'SELATAN'}`;

  const focusComm = (c) => {
    setMapComm({ ...c, mine: !!c.mine });
    mapInst.current?.flyTo([c.lat, c.lng], 15, { duration: 0.8 });
  };

  const saveMyComm = () => {
    if (!myCommName.trim() || !tempLoc) return;
    const init = (user?.name || 'A').charAt(0).toUpperCase();
    setMyComms([...myComms, {
      n: myCommName.trim(), s: quadrantOf(tempLoc), m: 1, t: myCommCat,
      leader: { n: user?.name || first, r: 'Pemimpin', i: init },
      est: 'AGU 2026', wa: '—',
      desc: `Komunitas baru ditandai oleh ${user?.name || first}.`,
      members: [{ n: user?.name || first, r: 'Pemimpin', i: init }],
      lat: tempLoc.lat, lng: tempLoc.lng, mine: true,
    }]);
    setTempLoc(null); setMyCommName(''); setMarkMode(false);
  };

  const statusBadge = (s) => {
    const m = { selesai: 'bg-[#0E7C66] text-white', proses: 'bg-yellow-300 text-black' };
    const l = { selesai: 'SELESAI', proses: 'PROSES' };
    return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{l[s]}</span>;
  };

  return (
    <div ref={rootRef} className="bg-[#F4F4F2] text-black min-h-screen">
      {/* ===== SATU-SATUNYA TOPBAR ===== */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-white border-b-2 border-black z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('home')} className="text-2xl font-black tracking-tighter hover:text-[#FF5733] transition-colors shrink-0">
            SUSI<span className="text-[#FF5733]">.</span>
          </button>
          <div className="flex-1" />

          {/* NOTIFIKASI INTERAKTIF */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className={`relative w-10 h-10 border-2 border-black flex items-center justify-center transition-colors ${notifOpen ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="w-5 h-5">
                <path d="M12 3v2" />
                <path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3v-4z" />
                <path d="M10 20h4" />
              </svg>
              {unread > 0 && (
                <>
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#FF5733] animate-ping" />
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-[#FF5733] text-white text-[9px] font-black flex items-center justify-center border-2 border-black px-0.5">{unread}</span>
                </>
              )}
            </button>

            {notifOpen && (
              <div className="notif-panel absolute right-0 top-12 w-[340px] md:w-[380px] bg-white border-2 border-black shadow-[6px_6px_0_0_#000] z-[60]">
                <div className="flex items-center justify-between p-4 border-b-2 border-black">
                  <div>
                    <p className="text-sm font-black">NOTIFIKASI</p>
                    <p className="text-[9px] font-mono opacity-50">{unread} BELUM DIBACA</p>
                  </div>
                  <button onClick={markAll} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">TANDAI SEMUA</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifs.length === 0 && <p className="p-6 text-center text-xs font-mono opacity-50">TIDAK ADA NOTIFIKASI.</p>}
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => markOne(n.id)} className={`w-full text-left p-4 border-b-2 border-black/10 last:border-b-0 flex gap-3 transition-colors ${n.read ? 'opacity-50 hover:opacity-80' : 'bg-[#FF5733]/5 hover:bg-[#FF5733]/10'}`}>
                      <span className="w-2 h-2 mt-1.5 shrink-0 rotate-45" style={{ background: NOTIF_META[n.type].c }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 text-white" style={{ background: NOTIF_META[n.type].c }}>{NOTIF_META[n.type].l}</span>
                          {!n.read && <span className="w-1.5 h-1.5 bg-[#FF5733] rounded-full" />}
                        </div>
                        <p className="text-xs font-black leading-snug">{n.title}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{n.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t-2 border-black">
                  <button onClick={() => { setNotifOpen(false); setTab('beranda'); }} className="w-full py-2 text-[9px] font-mono font-bold hover:text-[#FF5733] transition-colors">LIHAT SEMUA AKTIVITAS →</button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-2 border-black px-3 py-2 bg-white">
            <span className="w-6 h-6 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-black">{first}</p>
              <p className="text-[9px] font-mono text-[#FF5733] font-bold mt-0.5">REQUESTER</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">KELUAR</button>
        </div>
      </div>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white border-r-2 border-black z-40 flex-col justify-between">
        <div className="p-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dasbor Komunitas</p>
          <div className="space-y-2">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => { setTab(n.id); setSelectedComm(null); setMapComm(null); setMarkMode(false); setTempLoc(null); }} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${tab === n.id ? 'bg-black text-white shadow-[4px_4px_0_0_#FF5733]' : 'hover:bg-black/5'}`}>
                <span className={`text-[10px] font-mono font-bold ${tab === n.id ? 'text-[#FF5733]' : 'opacity-40'}`}>{n.n}</span>
                <span className="text-xs font-black uppercase tracking-wider">{n.l}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t-2 border-black">
          <p className="text-[10px] font-mono opacity-50 leading-relaxed">F1 · PERAN: REQUESTER<br />HAK AKSES DITEGAKKAN DI SERVER.</p>
        </div>
      </aside>

      {/* NAV MOBILE */}
      <div className="lg:hidden fixed top-20 left-0 right-0 z-40 bg-white border-b-2 border-black overflow-x-auto">
        <div className="flex px-4 py-3 gap-2 w-max">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => { setTab(n.id); setSelectedComm(null); setMapComm(null); setMarkMode(false); setTempLoc(null); }} className={`shrink-0 px-4 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${tab === n.id ? 'bg-black text-white border-black' : 'border-black/20'}`}>
              {n.l}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="pt-40 lg:pt-28 lg:pl-64 pb-16">
        <div className="px-5 lg:px-10 max-w-[1200px]">

          {/* ===== TAB: BERANDA ===== */}
          {tab === 'beranda' && (
            <>
              <div className="dash-item border-2 border-black bg-white p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, {first}.</h1>
                  <p className="text-sm opacity-60 max-w-xl leading-relaxed">Kelola kebutuhan komunitasmu, dukung ide warga lain.</p>
                </div>
                <button onClick={() => navigateTo('request')} className="bg-[#FF5733] text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-black transition-all">
                  + Ajukan Pengaduan
                </button>
              </div>

              <div className="grid grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[{ t: 3, l: 'Kebutuhan aktif' }, { t: 1, l: 'Dalam proses' }, { t: 5, l: 'Selesai' }].map((s, i) => (
                  <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                    <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>0</span></div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8">
                  <div className="dash-item flex items-center justify-between flex-wrap gap-4 mb-4">
                    <div>
                      <h3 className="text-2xl font-black">Papan Kebutuhan</h3>
                      <p className="text-[10px] font-mono opacity-50 mt-1">F3 · KATALOG TERBUKA</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['SEMUA', 'PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                        <button key={c} onClick={() => setFilter(c)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${filter === c ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filtered.map((b, i) => (
                      <div key={i} className="dash-item relative border-2 border-black bg-white p-6 pt-8 hover:shadow-[6px_6px_0_0_#FF5733] hover:-translate-y-1 transition-all">
                        <span className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-[#FF5733] border-2 border-black rotate-45" />
                        <span className="inline-block text-[9px] font-mono font-bold border-2 border-black px-2 py-1 mb-3">{b.cat}</span>
                        <h4 className="font-black text-lg leading-tight mb-2">{b.t}</h4>
                        <p className="text-xs opacity-60 leading-relaxed mb-4">{b.d}</p>
                        <div className="flex items-center justify-between border-t-2 border-black/10 pt-3">
                          <span className="text-[10px] font-mono opacity-50">{b.c} KOMENTAR · {b.v} LIHAT</span>
                          <button onClick={() => setSupports((s) => ({ ...s, [i]: (s[i] || 0) + 1 }))} className="text-[10px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">
                            DUKUNG +{supports[i] || 0}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-6">
                  <div className="dash-item border-2 border-black bg-white p-6">
                    <h3 className="text-xl font-black mt-1 mb-5">Verifikasi</h3>
                    <VerifyWidget />
                  </div>
                  <div className="dash-item border-2 border-black bg-white p-6">
                    <h3 className="text-xl font-black mb-4">Aktivitas</h3>
                    <ActivityFeed items={[
                      { c: 'bg-[#FF5733]', t: 'Derien menandai selesai', s: 'Aplikasi Iuran', time: '2J' },
                      { c: 'bg-black', t: 'Lamaran baru', s: 'Ezra P.', time: '5J' },
                      { c: 'bg-[#0E7C66]', t: 'Proyek terverifikasi', s: 'Galeri Foto', time: '1H' },
                    ]} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: KOMUNITAS ===== */}
          {tab === 'komunitas' && !selectedComm && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Komunitas</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">JELAJAHI KOMUNITAS & IKUT DISKUSI</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#FF5733] text-white px-3 py-2">{discussions.length} TOPIK</span>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-5">
                  <p className="dash-item text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-3">Daftar Komunitas</p>
                  <div className="space-y-4">
                    {COMMUNITIES.map((c, i) => (
                      <div key={i} onClick={() => setSelectedComm(c.n)} className="dash-item border-2 border-black bg-white p-5 cursor-pointer group hover:shadow-[6px_6px_0_0_#FF5733] hover:-translate-y-1 transition-all">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-12 h-12 bg-[#FF5733] text-white font-black flex items-center justify-center shrink-0">{c.leader.i}</span>
                            <div className="min-w-0">
                              <h3 className="font-black text-lg leading-tight group-hover:text-[#FF5733] transition-colors truncate">{c.n}</h3>
                              <p className="text-[10px] font-mono opacity-50 mt-0.5">{c.t} · SEKTOR {c.s}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold group-hover:text-[#FF5733]">LIHAT →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-7">
                  <p className="dash-item text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-3">Forum Diskusi</p>
                  <div className="dash-item mb-5 border-2 border-black p-5 bg-white">
                    <textarea value={newDiscussion} onChange={(e) => setNewDiscussion(e.target.value)} className="w-full border-2 border-black/20 bg-white p-3 text-sm outline-none focus:border-[#FF5733] resize-none h-20" placeholder="Tanyakan sesuatu..." />
                    <div className="flex justify-end mt-3">
                      <button onClick={postDiscussion} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-[#FF5733]">KIRIM →</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {discussions.map((d) => (
                      <div key={d.id} className="dash-item border-2 border-black bg-white p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="w-10 h-10 bg-[#FF5733] text-white font-black flex items-center justify-center shrink-0">{d.user.charAt(0)}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-sm">{d.user}</p>
                              <span className="text-[9px] font-mono opacity-50">· {d.comm} · {d.time}</span>
                            </div>
                            <p className="text-sm leading-relaxed">{d.text}</p>
                          </div>
                        </div>
                        {d.replies.length > 0 && (
                          <div className="ml-5 pl-4 border-l-2 border-black/10 space-y-3 mt-4">
                            {d.replies.map((r, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <span className="w-8 h-8 bg-black text-white font-black flex items-center justify-center shrink-0 text-xs">{r.user.charAt(0)}</span>
                                <div className="flex-1">
                                  <p className="font-black text-xs">{r.user}</p>
                                  <p className="text-xs leading-relaxed">{r.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {replyingTo === d.id ? (
                          <div className="ml-5 mt-4 flex gap-2">
                            <input value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1 border-2 border-black/20 bg-white p-2 text-xs outline-none focus:border-[#FF5733]" placeholder="Tulis balasan..." autoFocus />
                            <button onClick={() => postReply(d.id)} className="px-4 py-2 text-[9px] font-black uppercase bg-[#FF5733] text-white hover:bg-black">KIRIM</button>
                            <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="px-4 py-2 text-[9px] font-black uppercase border-2 border-black hover:bg-black hover:text-white">BATAL</button>
                          </div>
                        ) : (
                          <button onClick={() => setReplyingTo(d.id)} className="ml-5 mt-3 text-[10px] font-mono font-bold hover:text-[#FF5733]">+ BALAS ({d.replies.length})</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== DETAIL KOMUNITAS ===== */}
          {tab === 'komunitas' && selectedComm && (() => {
            const c = COMMUNITIES.find((x) => x.n === selectedComm) || myComms.find((x) => x.n === selectedComm);
            if (!c) return null;
            return (
              <>
                <div className="dash-item mb-6">
                  <button onClick={() => setSelectedComm(null)} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← KEMBALI</button>
                </div>
                <div className="dash-item border-2 border-black bg-white p-8 md:p-10 mb-6">
                  <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.9] mb-3">{c.n}</h1>
                  <p className="text-[10px] font-mono opacity-50">SEKTOR {c.s} · BERDIRI {c.est}</p>
                  <p className="text-sm leading-relaxed mt-6 max-w-3xl">{c.desc}</p>
                </div>
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="dash-item bg-black text-white border-2 border-black p-7">
                      <p className="text-[10px] font-mono text-[#FF5733] font-bold uppercase mb-4">Pemimpin</p>
                      <div className="w-20 h-20 bg-[#FF5733] text-white flex items-center justify-center text-3xl font-black mb-4">{c.leader.i}</div>
                      <h3 className="text-2xl font-black leading-tight">{c.leader.n}</h3>
                      <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest mt-1">{c.leader.r}</p>
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-8">
                    <div className="dash-item border-2 border-black bg-white p-7">
                      <h3 className="text-xl font-black mb-5">Anggota Inti</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {c.members.map((m, i) => (
                          <div key={i} className="border-2 border-black/15 hover:border-black p-4 flex items-center gap-3">
                            <span className="w-10 h-10 bg-black text-white font-black flex items-center justify-center shrink-0">{m.i}</span>
                            <div className="min-w-0">
                              <p className="font-black text-sm truncate">{m.n}</p>
                              <p className="text-[10px] font-mono opacity-50 uppercase truncate">{m.r}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* ===== TAB: MAP ===== */}
          {tab === 'map' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Map Komunitas</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">{COMMUNITIES.length + myComms.length} TERPETAKAN</p>
                </div>
                <button onClick={() => { setMarkMode(!markMode); setTempLoc(null); setMapComm(null); }} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${markMode ? 'bg-black text-white border-black' : 'bg-[#FF5733] text-white border-[#FF5733] hover:bg-black'}`}>
                  {markMode ? '✕ Batalkan' : '+ Tandai Komunitasku'}
                </button>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  {[...COMMUNITIES, ...myComms].map((c, i) => (
                    <div key={i} onClick={() => focusComm(c)} className="dash-item border-2 border-black bg-white p-4 cursor-pointer hover:shadow-[4px_4px_0_0_#FF5733] transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-10 h-10 flex items-center justify-center text-xs font-black text-white shrink-0 ${c.mine ? 'bg-[#0E7C66]' : 'bg-[#FF5733]'}`}>{c.mine ? '★' : c.leader.i}</span>
                        <p className="font-black text-sm truncate">{c.n}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="col-span-12 lg:col-span-8">
                  <div className="dash-item relative h-[520px] md:h-[560px] border-2 border-black bg-white overflow-hidden">
                    <div className="absolute inset-0 z-0"><div ref={mapEl} className="w-full h-full" /></div>
                    {markMode && !tempLoc && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black text-white px-4 py-2 text-[10px] font-mono font-bold uppercase animate-pulse">
                        Klik peta untuk menaruh lokasi
                      </div>
                    )}
                    {mapComm && !tempLoc && (
                      <div className="absolute top-3 right-3 z-10 w-[280px] bg-white border-2 border-black p-5 shadow-[6px_6px_0_0_#000]">
                        <button onClick={() => setMapComm(null)} className="absolute top-2 right-2 w-7 h-7 border-2 border-black flex items-center justify-center text-sm font-black hover:bg-black hover:text-white">×</button>
                        <h3 className="text-xl font-black leading-tight mb-1">{mapComm.n}</h3>
                        <p className="text-[9px] font-mono opacity-50 mb-3">SEKTOR {mapComm.s}</p>
                        <button onClick={() => { setSelectedComm(mapComm.n); setTab('komunitas'); }} className="w-full bg-black text-white py-3 text-[10px] font-black uppercase hover:bg-[#FF5733]">Lihat Detail →</button>
                      </div>
                    )}
                    {tempLoc && (
                      <div className="absolute bottom-3 left-3 z-10 w-[300px] bg-white border-2 border-black p-5 shadow-[6px_6px_0_0_#000]">
                        <p className="text-[10px] font-mono bg-black text-white inline-block px-2 py-1 mb-4">{tempLoc.lat.toFixed(4)}, {tempLoc.lng.toFixed(4)}</p>
                        <input value={myCommName} onChange={(e) => setMyCommName(e.target.value)} className="w-full border-2 border-black/20 p-2 text-sm outline-none focus:border-[#FF5733] mb-3" placeholder="Nama Komunitas" />
                        <div className="flex gap-2">
                          <button onClick={() => setTempLoc(null)} className="flex-1 border-2 border-black py-2.5 text-[9px] font-black uppercase hover:bg-black hover:text-white">Batal</button>
                          <button onClick={saveMyComm} className="flex-1 bg-[#0E7C66] text-white py-2.5 text-[9px] font-black uppercase hover:bg-black">Simpan ★</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: PROFILE ===== */}
          {tab === 'profile' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Profil</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">REKAM JEJAK KOMUNITAS</p>
                </div>
                <button onClick={() => setTab('setting')} className="text-[10px] font-mono font-bold border-2 border-black px-4 py-2 hover:bg-black hover:text-white">EDIT →</button>
              </div>
              <div className="dash-item border-2 border-black bg-black text-white p-8 md:p-10 mb-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 border-2 border-[#FF5733]/30" />
                <div className="grid grid-cols-12 gap-6 relative z-10">
                  <div className="col-span-12 md:col-span-4 flex flex-col items-center md:items-start gap-4">
                    <div className="w-28 h-28 bg-[#FF5733] flex items-center justify-center text-5xl font-black">{user?.name?.charAt(0).toUpperCase()}</div>
                    <div>
                      <h2 className="text-2xl font-black">{user?.name}</h2>
                      <p className="text-[10px] font-mono text-[#FF5733] font-bold mt-1">REQUESTER</p>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-8">
                    <p className="text-sm leading-relaxed opacity-80 mb-6">{PROFILE.bio}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
                      {[{ v: PROFILE.totalProyek, l: 'TOTAL' }, { v: PROFILE.selesai, l: 'SELESAI' }, { v: PROFILE.reputasi, l: 'REPUTASI' }, { v: PROFILE.komunitasAktif.length, l: 'KOMUNITAS' }].map((s, i) => (
                        <div key={i} className="bg-black p-4">
                          <div className="text-3xl font-black tabular-nums text-[#FF5733]">{s.v}</div>
                          <p className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <h3 className="text-xl font-black mb-5">Timeline Proyek</h3>
                    <div className="space-y-0">
                      {PROFILE.timeline.map((t, i) => (
                        <div key={i} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-black/10 last:border-transparent">
                          <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-black ${t.status === 'selesai' ? 'bg-[#0E7C66]' : 'bg-yellow-300'}`} />
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-mono font-bold">{t.date}</span>
                            {statusBadge(t.status)}
                          </div>
                          <h4 className="font-black text-base mb-1">{t.title}</h4>
                          <p className="text-xs opacity-60">{t.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 space-y-6">
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <h3 className="text-xl font-black mb-5">Distribusi Sektor</h3>
                    <div className="space-y-4">
                      {PROFILE.sektorStats.map((s, i) => {
                        const max = Math.max(...PROFILE.sektorStats.map((x) => x.v));
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-[10px] font-mono font-bold mb-1.5"><span>{s.l}</span><span>{s.v}</span></div>
                            <div className="h-2 bg-black/10"><div className="bar-h h-full bg-black" style={{ width: `${(s.v / max) * 100}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="dash-item border-2 border-black bg-[#FF5733] text-white p-7">
                    <h3 className="text-xl font-black mb-5">Testimoni Talenta</h3>
                    <div className="space-y-5">
                      {PROFILE.testimoni.map((t, i) => (
                        <div key={i} className="border-b-2 border-white/20 pb-4 last:border-0">
                          <p className="text-sm italic leading-relaxed mb-2">{t.text}</p>
                          <p className="text-[10px] font-mono opacity-70">— {t.from} · {t.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== TAB: SETTING ===== */}
          {tab === 'setting' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Setting</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">PREFERENSI AKUN</p>
                </div>
                <span className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2">5 KATEGORI</span>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <aside className="col-span-12 lg:col-span-3">
                  <div className="lg:sticky lg:top-28 space-y-2">
                    {SETTINGS_NAV.map((s) => (
                      <button key={s.id} onClick={() => setSettingsTab(s.id)} className={`w-full flex items-center gap-3 p-4 border-2 text-left transition-all ${settingsTab === s.id ? 'bg-black text-white shadow-[4px_4px_0_0_#FF5733]' : 'bg-white border-black/15 hover:border-black'}`}>
                        <span className={`text-lg ${settingsTab === s.id ? 'text-[#FF5733]' : ''}`}>{s.i}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">{s.l}</span>
                      </button>
                    ))}
                  </div>
                </aside>
                <div className="col-span-12 lg:col-span-9 space-y-6">
                  {settingsTab === 'profil' && (
                    <>
                      <div className="dash-item border-2 border-black bg-white p-7">
                        <span className="text-[10px] font-mono font-bold text-[#FF5733]">IDENTITAS</span>
                        <h3 className="text-xl font-black mt-1 mb-5">Informasi Profil</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Nama</label>
                            <input defaultValue={user?.name} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Email</label>
                            <input defaultValue={`${user?.name?.toLowerCase().replace(' ', '.')}@susi.id`} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733]" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Bio</label>
                            <textarea defaultValue={PROFILE.bio} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] h-24 resize-none" />
                          </div>
                        </div>
                      </div>
                      <button className="dash-item w-full bg-black text-white py-5 text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5733]">SIMPAN →</button>
                    </>
                  )}
                  {settingsTab === 'notifikasi' && (
                    <div className="dash-item border-2 border-black bg-white p-7 space-y-3">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">NOTIFIKASI PLATFORM</span>
                      <h3 className="text-xl font-black mt-1 mb-5">Kapan Kami Mengabari Anda</h3>
                      <SetToggle on={sets.notifTalenta} onClick={() => setSets((s) => ({ ...s, notifTalenta: !s.notifTalenta }))} label="Lamaran dari Talenta" sub="Notifikasi saat talenta melamar" />
                      <SetToggle on={sets.notifDiskusi} onClick={() => setSets((s) => ({ ...s, notifDiskusi: !s.notifDiskusi }))} label="Balasan Forum" sub="Pemberitahuan balasan diskusi" />
                      <SetToggle on={sets.email} onClick={() => setSets((s) => ({ ...s, email: !s.email }))} label="Email" sub="Ringkasan harian ke email" />
                      <SetToggle on={sets.whatsapp} onClick={() => setSets((s) => ({ ...s, whatsapp: !s.whatsapp }))} label="WhatsApp" sub="Notifikasi penting via WhatsApp" />
                    </div>
                  )}
                  {settingsTab === 'privasi' && (
                    <div className="dash-item border-2 border-black bg-white p-7 space-y-3">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">PRIVASI & TAMPILAN</span>
                      <h3 className="text-xl font-black mt-1 mb-5">Kontrol Data & Visual</h3>
                      <SetToggle on={sets.lokasi} onClick={() => setSets((s) => ({ ...s, lokasi: !s.lokasi }))} label="Tampilkan Sektor Lokasi" sub="Perlihatkan lokasi di Map publik" />
                    </div>
                  )}
                  {settingsTab === 'integrasi' && (
                    <div className="dash-item border-2 border-black bg-white p-7">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">INTEGRASI</span>
                      <h3 className="text-xl font-black mt-1 mb-5">Akun Terhubung</h3>
                      <div className="border-2 border-black p-5 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#25D366] text-white flex items-center justify-center text-2xl font-black">W</div>
                          <div>
                            <p className="font-black">WhatsApp</p>
                            <p className="text-[10px] font-mono opacity-50">TERHUBUNG</p>
                          </div>
                        </div>
                        <button className="px-4 py-2 text-[10px] font-black uppercase border-2 border-black hover:bg-black hover:text-white">PUTUSKAN</button>
                      </div>
                    </div>
                  )}
                  {settingsTab === 'bahaya' && (
                    <>
                      <div className="dash-item border-2 border-black bg-white p-7">
                        <span className="text-[10px] font-mono font-bold text-[#FF5733]">SESI</span>
                        <h3 className="text-xl font-black mt-1 mb-5">Keluar dari Akun</h3>
                        <button onClick={onLogout} className="w-full bg-black text-white py-4 text-[10px] font-black uppercase hover:bg-[#FF5733]">KELUAR →</button>
                      </div>
                      <div className="dash-item border-2 border-black bg-white p-7 border-l-4 border-l-[#FF5733]">
                        <span className="text-[10px] font-mono font-bold text-[#FF5733]">⚠ DESTRUKTIF</span>
                        <h3 className="text-xl font-black mt-1 mb-5">Hapus Akun Permanen</h3>
                        <p className="text-sm opacity-70 mb-5">Tidak bisa dibatalkan.</p>
                        <button onClick={() => setConfirmDelete(true)} className="w-full border-2 border-black py-4 text-[10px] font-black uppercase hover:bg-black hover:text-white">HAPUS AKUN</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {confirmDelete && (
                <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-md border-2 border-[#FF5733] p-8 relative">
                    <button onClick={() => setConfirmDelete(false)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white">×</button>
                    <h3 className="text-2xl font-black mt-2 mb-4">Yakin?</h3>
                    <p className="text-sm opacity-70 mb-6">Ketik <span className="font-mono font-black bg-black text-white px-2 py-0.5">HAPUS</span> untuk konfirmasi.</p>
                    <input className="w-full border-2 border-black p-3 text-sm outline-none mb-5" placeholder='Ketik "HAPUS"' />
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 border-2 border-black py-4 text-[10px] font-black uppercase hover:bg-black hover:text-white">Batal</button>
                      <button className="flex-1 bg-[#FF5733] text-white py-4 text-[10px] font-black uppercase hover:bg-black">HAPUS</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ============ HALAMAN PENGADUAN (FULL PAGE + MAP ASLI) ============ */
function RequestPage({ user, navigateTo }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);
  const [addr, setAddr] = useState('');
  const [coords, setCoords] = useState(null);
  const [cat, setCat] = useState('PENCATATAN');
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState(false);
  const rootRef = useRef(null);

  const BDG = { lat: -6.9175, lng: 107.6191 }; // titik tengah Bandung

  const pinIcon = L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;background:#FF5733;border:2px solid #000;transform:rotate(45deg);box-shadow:2px 2px 0 rgba(0,0,0,.4)"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  const placeMarker = (lat, lng) => {
    if (!mapInst.current) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(mapInst.current);
    setCoords({ lat, lng });
  };

  useEffect(() => {
    if (sent || !mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current).setView([BDG.lat, BDG.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    map.on('click', (e) => placeMarker(e.latlng.lat, e.latlng.lng));
    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; markerRef.current = null; };
  }, [sent]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.req-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [sent]);

  // Cari alamat via Nominatim (gratis, tanpa API key)
  const searchAddr = async () => {
    if (!addr.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr + ', Kota Bandung')}`);
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data.lat), lng = parseFloat(data.lon);
        placeMarker(lat, lng);
        mapInst.current.setView([lat, lng], 15);
      }
    } catch (e) {}
    setSearching(false);
  };

  const quadrant = coords ? `${coords.lng < BDG.lng ? 'BARAT' : 'TIMUR'}–${coords.lat > BDG.lat ? 'UTARA' : 'SELATAN'}` : '—';
  const fCls = 'w-full border-2 border-black/20 bg-transparent p-3 text-sm font-medium outline-none focus:border-[#FF5733] transition-colors placeholder:text-black/30';
  const lCls = 'text-xs font-black uppercase tracking-widest mb-2 block';

  /* ---- LAYAR SUKSES ---- */
  if (sent) {
    return (
      <div ref={rootRef} className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <div className="req-item inline-flex w-24 h-24 bg-[#0E7C66] text-white items-center justify-center text-5xl font-black mb-8">✓</div>
          <h1 className="req-item text-5xl md:text-6xl font-black tracking-tight mb-4">Pengaduan tercatat.</h1>
          <p className="req-item text-sm opacity-60 leading-relaxed mb-10">Masuk antrean katalog kebutuhan terbuka (Langkah 01–02). Talenta akan melihat & melamar — pantau dasbormu.</p>
          <button onClick={() => navigateTo('dashboard')} className="req-item bg-black text-white px-10 py-5 text-xs font-black uppercase tracking-widest hover:bg-[#FF5733] transition-colors">Kembali ke Dasbor →</button>
        </div>
      </div>
    );
  }

  /* ---- HALAMAN FORM ---- */
  return (
    <div ref={rootRef} className="min-h-screen bg-[#F4F4F2] text-black">
      {/* TOPBAR */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-white border-b-2 border-black z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('dashboard')} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← DASBOR</button>
          <span className="text-2xl font-black tracking-tighter">SUSI<span className="text-[#FF5733]">.</span></span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 border-2 border-black px-3 py-2 bg-white">
            <span className="w-6 h-6 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase()}</span>
            <span className="text-xs font-black hidden sm:block">{(user?.name || '').split(' ')[0]}</span>
          </div>
        </div>
      </div>

      <main className="pt-28 pb-20 px-5 lg:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="req-item mb-8">
            <span className="text-[10px] font-mono font-bold text-[#FF5733]">LANGKAH 01 · INTAKE MANDIRI</span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mt-1">Formulir Pengaduan</h1>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (coords) setSent(true); }} className="grid grid-cols-12 gap-6">
            {/* KIRI: FIELD */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
              <div className="req-item border-2 border-black bg-white p-7">
                <label className={lCls}>Judul Kebutuhan</label>
                <input required className={fCls} placeholder="Mis. Rekap iuran warga masih pakai buku tulis" />
              </div>
              <div className="req-item border-2 border-black bg-white p-7">
                <label className={lCls}>Kategori</label>
                <div className="grid grid-cols-2 gap-px bg-black border-2 border-black">
                  {['PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                    <button type="button" key={c} onClick={() => setCat(c)} className={`py-3 text-[10px] font-mono font-bold transition-colors ${cat === c ? 'bg-[#FF5733] text-white' : 'bg-white hover:bg-black hover:text-white'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="req-item border-2 border-black bg-white p-7">
                <label className={lCls}>Ceritakan Masalahmu (bahasa sehari-hari)</label>
                <textarea required className={`${fCls} h-32 resize-none`} placeholder="Contoh: data iuran sering hilang, susah direkap tiap bulan..."></textarea>
              </div>
            </div>

            {/* KANAN: MAP ASLI */}
            <div className="col-span-12 lg:col-span-7">
              <div className="req-item border-2 border-black bg-white p-7">
                <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
                  <label className="text-xs font-black uppercase tracking-widest">Posisi Lokasi · Klik Map atau Cari Alamat</label>
                  <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-1">
                    {coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)} · ${quadrant}` : 'BELUM ADA TITIK'}
                  </span>
                </div>

                <div className="flex gap-2 mb-4">
                  <input value={addr} onChange={(e) => setAddr(e.target.value)} className={fCls} placeholder="Ketik alamat: Mis. Jl. Ambon No.11, Bandung" />
                  <button type="button" onClick={searchAddr} className="shrink-0 bg-black text-white px-5 text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5733] transition-colors">
                    {searching ? '...' : 'Cari →'}
                  </button>
                </div>

                <div className="relative z-0 border-2 border-black h-[380px] md:h-[440px]">
                  <div ref={mapRef} className="w-full h-full" />
                </div>
                <p className="text-[10px] font-mono opacity-50 mt-3 leading-relaxed">KLIK MAP UNTUK MENARUH PENANDA · PENANDA WAJIK CORAL = LOKASI PENGADUAN · DATA © OPENSTREETMAP</p>
              </div>

              <div className="req-item flex gap-3 mt-6">
                <button type="button" onClick={() => navigateTo('dashboard')} className="flex-1 border-2 border-black bg-white py-5 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Batal</button>
                <button type="submit" disabled={!coords} className={`flex-1 py-5 text-[10px] font-black uppercase tracking-widest transition-colors ${coords ? 'bg-[#FF5733] text-white hover:bg-black' : 'bg-black/20 text-black/40 cursor-not-allowed'}`}>
                  {coords ? 'Kirim Pengaduan →' : 'Tandai Lokasi Dulu'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

/* ============ FOOTER ============ */
function Footer({ navigateTo }) {
  return (
    <footer className="bg-black text-white py-16 px-6 lg:px-12 border-t-2 border-black">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">SUSI<span className="text-[#FF5733]">.</span></h2>
          <p className="opacity-40">Build the future with us</p>
          <p className="text-xs opacity-40 mt-2 font-mono">© 2026 · SATU CREANOVA · SMKN 4 BANDUNG</p>
        </div>
        <div className="text-xs opacity-40 font-mono text-right">
          <button onClick={() => navigateTo('home')} className="mt-2 hover:text-[#FF5733] hover:opacity-100 transition-colors">KEMBALI KE ATAS ↑</button>
        </div>
      </div>
    </footer>
  );
}

/* ============ MAIN APP ============ */
export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const userRef = useRef(null); // ✅ nilai sinkron, biar login tidak mental ke auth
  const overlayRef = useRef(null);

  const navigateTo = (page) => {
    if (page === 'dashboard' && !userRef.current) page = 'auth';
    if (page === currentPage) return;
    setMenuOpen(false);
    const overlay = overlayRef.current;
    gsap.timeline()
      .set(overlay, { y: '100%' })
      .to(overlay, { y: '0%', duration: 0.45, ease: 'power4.inOut' })
      .add(() => { setCurrentPage(page); window.scrollTo(0, 0); })
      .to(overlay, { y: '-100%', duration: 0.55, ease: 'power4.inOut', delay: 0.15 })
      .set(overlay, { y: '100%' });
  };

  const goToSection = (id) => {
    setMenuOpen(false);
    if (currentPage !== 'home') {
      navigateTo('home');
      gsap.delayedCall(1.2, () => gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' }));
    } else {
      gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' });
    }
  };

  const handleLogin = (userData) => {
    userRef.current = userData;
    setUser(userData);
    navigateTo('dashboard');
  };

  const handleLogout = () => {
    userRef.current = null;
    setUser(null);
    navigateTo('home');
  };

  const goToHome = () => navigateTo('home');

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased selection:bg-[#FF5733] selection:text-white cursor-none md:cursor-auto">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace !important; }
        html { scroll-behavior: auto; }
      `}</style>

      <div ref={overlayRef} className="fixed inset-0 z-[400] bg-[#0E7C66] flex items-center justify-center" style={{ transform: 'translateY(100%)' }}>
        <span className="text-6xl md:text-9xl font-black tracking-tighter text-white">SUSI.</span>
      </div>

      <Cursor />

      {currentPage !== 'auth' && currentPage !== 'admin-login' && currentPage !== 'dashboard' && currentPage !== 'request' && (
        <Navigation
          currentPage={currentPage}
          navigateTo={navigateTo}
          goToSection={goToSection}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'home' && <HomePage navigateTo={navigateTo} goToSection={goToSection} />}
      {currentPage === 'auth' && <AuthPage onLogin={handleLogin} goToHome={goToHome} goAdmin={() => navigateTo('admin-login')} />}
      {currentPage === 'admin-login' && <AdminLoginPage onLogin={handleLogin} goToAuth={() => navigateTo('auth')} />}
      {currentPage === 'request' && user && <RequestPage user={user} navigateTo={navigateTo} />}

      {currentPage === 'dashboard' && user && (
        user.role === 'requester'
          ? <DashboardRequester user={user} onLogout={handleLogout} navigateTo={navigateTo} />
          : user.role === 'talent'
            ? <DashboardTalent user={user} onLogout={handleLogout} navigateTo={navigateTo} />
            : (user.role === 'liaison' || user.role === 'agensusi')
              ? <DashboardLiaison user={user} onLogout={handleLogout} navigateTo={navigateTo} />
              : user.role === 'admin'
                ? <DashboardAdmin user={user} onLogout={handleLogout} navigateTo={navigateTo} />
                : <DashboardPage user={user} onLogout={handleLogout} navigateTo={navigateTo} />
      )}

      {currentPage === 'tentang' && <TentangPage />}

      {currentPage !== 'auth' && currentPage !== 'admin-login' && currentPage !== 'dashboard' && currentPage !== 'request' && <Footer navigateTo={navigateTo} />}
    </div>
  );
}