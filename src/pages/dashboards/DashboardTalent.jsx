import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';                              // ← TAMBAH
import 'leaflet/dist/leaflet.css';                    // ← TAMBAH
import ProjSteps from '../../components/common/ProjSteps'; 


function AppBadge({ s }) {
  const m = { MENUNGGU: 'bg-yellow-300 text-black', DITERIMA: 'bg-[#0E7C66] text-white', DITOLAK: 'bg-black text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
}

export default function DashboardTalent({ user, onLogout, navigateTo }) {
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
    { id: 'jelajahi', n: '01', l: 'LIHAT DAFTAR PROYEK' },
    { id: 'histori', n: '02', l: 'HISTORI PENGAJUAN' },
    { id: 'projek', n: '03', l: 'PROYEK SAYA' },
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
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dashboard Talenta</p>
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
          <p className="text-[10px] font-mono opacity-50 leading-relaxed">Memiliki Masalah?<br />Hubungi WhatsApp Kami:</p>
          <p className="text-[10px] font-bold opacity-50 leading-relaxed">+62 22 123 4567</p>
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
                      <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest mt-1">NAMA KETUA KOMUNITAS: {n.leader}</p>
                      <div className="mt-5 pt-5 border-t-2 border-white/20 text-xs font-mono opacity-70 space-y-2">
                        
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
                     
                      <h3 className="text-xl font-black mb-4">Ajukan Diri untuk Proyek Ini</h3>
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
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Proyek Saya</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">Daftar Proyek Yang Dikerjakan</p>
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
                      {p.status === 'VERIFIKASI' && <span className="text-[9px] font-mono font-bold bg-yellow-300 text-black px-2 py-1">MENUNGGU VERIFIKASI</span>}
                      {p.status === 'PROSES' && <span className="text-[9px] font-mono font-bold bg-black text-white px-2 py-1">SEDANG DIKERJAKAN</span>}
                      {p.status === 'KESEPAKATAN' && <span className="text-[9px] font-mono font-bold bg-[#FF5733] text-white px-2 py-1">BUTUH AKSI</span>}
                    </div>
                    <div className="grid grid-cols-12 gap-6 items-start">
                      <div className="col-span-12 lg:col-span-7">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2">Target Proyek</p>
                        <p className="text-sm opacity-70 leading-relaxed mb-4">{p.scope}</p>
                      </div>
                      <div className="col-span-12 lg:col-span-5">
                        <ProjSteps status={p.status} />
                        <div className="mt-4">
                          {p.status === 'KESEPAKATAN' && (
                            <button onClick={() => setAgreeTarget(p)} className="w-full bg-[#FF5733] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Lihat Kesepakatan & Setuju →</button>
                          )}
                          {p.status === 'PROSES' && (
                            <button onClick={() => setProjStatus(p.id, 'VERIFIKASI')} className="w-full bg-black text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#0E7C66] transition-colors">Tandai Selesai →</button>
                          )}
                          {p.status === 'VERIFIKASI' && (
                            <p className="w-full text-center border-2 border-black/20 py-3 text-[10px] font-mono font-bold opacity-60">PROYEK DIKIRIM!, SILAHKAN TUNGGU HINGGA KOMUNITAS VERIFIKASI.</p>
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/10">
                      {[
                        { v: TPROFILE.reputasi, l: 'POIN REPUTASI' },
                        { v: applications.length, l: 'PROYEK MENUNGGU VERIFIKASI' },
                        { v: 2, l: 'PROYEK SELESAI' },
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
                        <h3 className="text-xl font-black mt-1">Projek Terverifikasi</h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold"></span>
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
        
            <h3 className="text-2xl font-black mt-2 mb-5">{agreeTarget.t}</h3>
            <div className="space-y-3 mb-6">
              <div className="p-4 border-2 border-black bg-[#FAFAFA]"><p className="text-[10px] font-mono font-bold uppercase mb-1 opacity-60">Target Proyek</p><p className="text-sm">{agreeTarget.scope}</p></div>
              <div className="p-4 border-2 border-black bg-[#FAFAFA]"><p className="text-[10px] font-mono font-bold uppercase mb-1 opacity-60">DEADLINE</p><p className="text-sm">Sebelum 15 Oktober</p></div>
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