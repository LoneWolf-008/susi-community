import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import MiniBars from '../../components/common/MiniBars';
import ActivityFeed from '../../components/common/ActivityFeed';

function ModBadge({ t }) {
  const m = { KEBUTUHAN: 'bg-[#FF5733] text-white', TALENTA: 'bg-black text-white', TESTIMONI: 'bg-[#0E7C66] text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[t]}`}>{t}</span>;
}
function CaseBadge({ s }) {
  const m = { MEDIASI: 'bg-yellow-300 text-black', ESKALASI: 'bg-black text-white', SELESAI: 'bg-[#0E7C66] text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
}

export default function DashboardAdmin({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('ringkasan');
  const [modFilter, setModFilter] = useState('SEMUA');
  const [modStats, setModStats] = useState({ approve: 12, reject: 2 });
  const [queue, setQueue] = useState([
{ id: 1, type: 'PENGADUAN', t: 'Aplikasi Absensi Pemuda', by: 'Karang Taruna Mekar', date: 'HARI INI', d: 'Butuh form absensi kegiatan pemuda via HP, biar tidak rekap manual.', full: 'Absensi kegiatan pemuda masih kertas fotokopian. Butuh form via HP + rekap otomatis bulanan supaya laporan ke kelurahan tidak manual lagi.', src: 'MANDIRI' },
{ id: 2, type: 'TALENTA', t: 'Pendaftaran: Salsabila R.', by: 'Career switcher', date: 'HARI INI', d: 'Klaim skill React + Firebase, portofolio 2 proyek pribadi.', full: 'Klaim skill React + Firebase dengan 2 proyek pribadi. Perlu verifikasi skill sebelum disetujui sebagai talenta.', src: 'AgenSUSI' },
{ id: 3, type: 'TESTIMONI', t: 'Testimoni untuk Ezra P.', by: 'PKK RW 05', date: 'KEMARIN', d: '"Pengerjaan rapi dan sabar mengajarkan pengurus."', full: 'Testimoni pasca verifikasi Website Profil PKK. Bahasa wajar, tanpa klaim berlebihan — layak tampil di profil publik.', src: 'AgenSUSI' },
{ id: 4, type: 'KEBUTUHAN', t: 'Website Katalog UMKM', by: 'Paguyuban Pedagang', date: 'KEMARIN', d: 'Katalog produk 54 pedagang agar bisa dilihat online.', full: '54 pedagang ingin produk terlihat online. Potensi duplikat dengan pengaduan Paguyuban Pasar — cek sebelum setujui.', src: 'MANDIRI' },
]);
const [cases, setCases] = useState([
{ id: 1, t: 'Sistem Inventaris PKK', comm: 'PKK RW 05', talent: 'Derien A.', days: 6, note: 'Komunitas belum konfirmasi 6 hari setelah talenta menandai selesai.',
statComm: 'Fitur sudah jadi, tapi pengurus belum sempat uji coba karena arisan bulanan. Minta waktu seminggu lagi.',
statTalent: 'Proyek sudah selesai sesuai kesepakatan namun komunitas belum verifikasi.',
timeline: [ { d: '01 AGU', e: 'Kesepakatan proyek dibuat' }, { d: '10 AGU', e: 'Talenta menandai SELESAI' }, { d: '16 AGU', e: 'Talenta: 6 Hari tidak ada konfirmasi.' } ] },
{ id: 2, t: 'Website Galeri', comm: 'KT Mekar', talent: 'Ezra P.', days: 12, note: 'Komunitas mengklaim hasil belum sesuai kesepakatan.',
statComm: 'Halaman galeri baru 5 foto; kesepakatan awal 20 halaman kegiatan + form upload mandiri.',
statTalent: 'Form upload butuh akses server yang belum diserahkan komunitas. Ini di luar kesepakatan.',
timeline: [ { d: '20 JUL', e: 'Kesepakatan proyek dibuat' }, { d: '05 AGU', e: 'Talenta menandai SELESAI' }, { d: '07 AGU', e: 'Komunitas menolak, karena hasil tidak sesuai' }, { d: '09 AGU', e: 'Pengaduan ke admin' } ] },
]);
const [liaisons, setLiaisons] = useState([
{ id: 1, n: 'Hasby Wira Al Muflih', visits: 23, assisted: 19, sector: 'UTARA', status: 'AKTIF', last: 'HARI INI · PKK RW 03 Cijerah',
history: [ { d: 'HARI INI', c: 'PKK RW 03 Cijerah', s: 'BERLANGSUNG' }, { d: 'KEMARIN', c: 'Paguyuban Pedagang Pasar', s: 'TERDATA' }, { d: '14 AGU', c: 'Posyandu Melati', s: 'DIRENCANAKAN' } ] },
{ id: 2, n: 'Tim Lapangan 02', visits: 15, assisted: 12, sector: 'SELATAN', status: 'AKTIF', last: 'KEMARIN · Posyandu Melati',
history: [ { d: 'KEMARIN', c: 'Posyandu Melati', s: 'BERLANGSUNG' }, { d: '12 AGU', c: 'Karang Taruna Cibuntu', s: 'TERDATA' } ] },
]);
const [liaisonDetail, setLiaisonDetail] = useState(null);
const toggleLiaison = (id) => setLiaisons((ls) => ls.map((l) => (l.id === id ? { ...l, status: l.status === 'AKTIF' ? 'DITANGGUHKAN' : 'AKTIF' } : l)));


/* ===== STATE INTERAKSI ADVANCED ===== */
const [modDetail, setModDetail] = useState(null);
const [rejectId, setRejectId] = useState(null);
const [rejectReason, setRejectReason] = useState('SPAM');
const [checks, setChecks] = useState({});
const [caseDetail, setCaseDetail] = useState(null);
const [msgTarget, setMsgTarget] = useState(null);
const [msgText, setMsgText] = useState('');
const [sentMsgs, setSentMsgs] = useState({});

  const [resolveTarget, setResolveTarget] = useState(null);
  const [userFilter, setUserFilter] = useState('SEMUA');
  const [users, setUsers] = useState([
    { id: 1, n: 'Ibu Siti Aminah', role: 'KOMUNITAS', join: 'MEI 2026', rep: '—', status: 'AKTIF' },
    { id: 2, n: 'Derien Adelio', role: 'TALENTA', join: 'JUN 2026', rep: 12, status: 'AKTIF' },
    { id: 3, n: 'Hasby Wira', role: 'AGENSUSI', join: 'MEI 2026', rep: '—', status: 'AKTIF' },
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
    { id: 'moderasi', n: '02', l: 'KELOLA PENGADUAN' },
    { id: 'sengketa', n: '03', l: 'KELUHAN' },
    { id: 'pengguna', n: '04', l: 'PENGGUNA' },
    { id: 'liaison', n: '05', l: 'AGENSUSI' },
  ];

  const filteredQueue = modFilter === 'SEMUA' ? queue : queue.filter((q) => q.type === modFilter);
  const filteredUsers = userFilter === 'SEMUA' ? users : users.filter((u) => u.role === userFilter);

  const riskBadge = (r) => {
  const m = { RENDAH: 'bg-[#0E7C66] text-white', SEDANG: 'bg-yellow-300 text-black', TINGGI: 'bg-[#FF5733] text-white' };
  return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[r]}`}>{r}</span>;
};
const toggleCheck = (id, key) => setChecks((c) => ({ ...c, [id]: { ...(c[id] || {}), [key]: !(c[id] || {})[key] } }));
const approveItem = (id) => { setQueue((q) => q.filter((x) => x.id !== id)); setModStats((m) => ({ ...m, approve: m.approve + 1 })); setModDetail(null); setRejectId(null); };
const rejectItem = (id) => { setQueue((q) => q.filter((x) => x.id !== id)); setModStats((m) => ({ ...m, reject: m.reject + 1 })); setModDetail(null); setRejectId(null); };
const sendMsg = (key) => { setSentMsgs((s) => ({ ...s, [key]: true })); setMsgTarget(null); setMsgText(''); };

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
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dashboard Admin</p>
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
              <p className="text-[10px] font-bold opacity-75 leading-relaxed">Developed By:</p>
              <p className="text-[14px] font-bold opacity-100 leading-relaxed">SUSI Team</p> <br />
              <p className="text-[10px] font-bold opacity-75 leading-relaxed">BUILD THE FUTURE</p>
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
              
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, {first}.</h1>
                  <p className="text-sm opacity-60 max-w-xl leading-relaxed">Selamat Datang Kembali, kelola SUSI dari sini.</p>
                </div>
                <div className="flex items-center gap-2 border-2 border-black px-4 py-3 bg-[#0E7C66] text-white">
                  <span className="w-2 h-2 bg-white animate-pulse" />
                  <span className="text-[10px] font-mono font-black">SEMUA SISTEM NORMAL</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[
                  { t: 181, l: 'Pengguna aktif' },
                  { t: 20, l: 'Dalam Antrian' },
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
                  <h3 className="text-xl font-black mb-5">Laporan Mingguan</h3>
                  <MiniBars data={[{ l: 'M1', v: 9 }, { l: 'M2', v: 12 }, { l: 'M3', v: 8 }, { l: 'M4', v: 14 }, { l: 'M5', v: 11 }, { l: 'M6', v: 16 }]} />
                  <p className="text-[10px] font-mono opacity-50 mt-4">Pantau kinerja kunjungan website dalam periode terakhir</p>
                </div>

                <div className="dash-item col-span-12 lg:col-span-4 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Aktivitas Peran</h3>
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
        <p className="text-[10px] font-mono opacity-50 mt-2">KELOLA DAN SETUJUI PENGADUAN KOMUNITAS DISINI</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {['SEMUA', 'KEBUTUHAN', 'TALENTA', 'TESTIMONI'].map((t) => (
          <button key={t} onClick={() => setModFilter(t)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${modFilter === t ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{t}</button>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-3 gap-px bg-black border-2 border-black mb-6">
      {[
        { t: filteredQueue.length, l: 'Menunggu review' },
        { t: modStats.approve, l: 'Disetujui' },
        { t: modStats.reject, l: 'Ditolak' },
      ].map((s, i) => (
        <div key={i} className="dash-item bg-white p-6">
          <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
        </div>
      ))}
    </div>

    <div className="space-y-4">
      {filteredQueue.map((q) => {
        const open = modDetail === q.id;
        const ck = checks[q.id] || {};
        const ready = ck.layak && ck.kategori;
        return (
          <div key={q.id} className={`dash-item bg-white border-2 transition-all ${open ? 'border-[#FF5733] shadow-[6px_6px_0_0_#FF5733]' : 'border-black'}`}>
            <button onClick={() => { setModDetail(open ? null : q.id); setRejectId(null); }} className="w-full p-6 text-left flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <ModBadge t={q.type} />
                  <span className="text-[9px] font-mono opacity-50">{q.date}</span>
                  {riskBadge(q.risk)}
                </div>
                <h4 className="font-black text-lg mb-1">{q.t}</h4>
                <p className="text-[10px] font-mono opacity-50">NAMA PETUGAS: {q.by}</p>
              </div>
              <span className={`text-[10px] font-black shrink-0 transition-transform ${open ? 'rotate-90 text-[#FF5733]' : ''}`}>→</span>
            </button>
            {open && (
              <div className="px-6 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-2 border-black/15 p-4">
                    <p className="text-[9px] font-mono font-bold opacity-50 mb-2">DESKRIPSI PROYEK</p>
                    <p className="text-sm opacity-80 leading-relaxed">{q.full}</p>
                  </div>
                  <div className="border-2 border-black/15 p-4 space-y-2">
                    <p className="text-[9px] font-mono font-bold opacity-50">DETAIL PENGAJUAN</p>
                    <div className="flex justify-between text-[10px] font-mono"><span>SUMBER</span><span className="font-bold">{q.src}</span></div>
                    <div className="flex justify-between text-[10px] font-mono"><span>TIPE</span><span className="font-bold">{q.type}</span></div>
                    
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-mono font-bold opacity-50 mb-2">CHECKLIST REVIEW — WAJIB SEBELUM SETUJUI</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <button onClick={() => toggleCheck(q.id, 'layak')} className={`p-3 border-2 text-left text-[10px] font-bold transition-colors ${ck.layak ? 'bg-[#0E7C66] text-white border-[#0E7C66]' : 'border-black/20 hover:border-black'}`}>{ck.layak ? '✓' : '○'} Konten layak & bukan spam</button>
                    <button onClick={() => toggleCheck(q.id, 'kategori')} className={`p-3 border-2 text-left text-[10px] font-bold transition-colors ${ck.kategori ? 'bg-[#0E7C66] text-white border-[#0E7C66]' : 'border-black/20 hover:border-black'}`}>{ck.kategori ? '✓' : '○'} Kategori sesuai</button>
                  </div>
                </div>
                {rejectId === q.id ? (
                  <div className="border-2 border-[#FF5733] p-4 space-y-3">
                    <p className="text-[9px] font-mono font-bold text-[#FF5733]">ALASAN PENOLAKAN (WAJIB PILIH)</p>
                    <div className="flex flex-wrap gap-2">
                      {['SPAM', 'DUPLIKAT', 'SALAH KATEGORI', 'TIDAK LAYAK'].map((r) => (
                        <button key={r} onClick={() => setRejectReason(r)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${rejectReason === r ? 'bg-[#FF5733] text-white border-[#FF5733]' : 'border-black/20 hover:border-black'}`}>{r}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => rejectItem(q.id)} className="flex-1 bg-[#FF5733] text-white py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-black transition-colors">Konfirmasi Tolak ({rejectReason})</button>
                      <button onClick={() => setRejectId(null)} className="flex-1 border-2 border-black py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Batal</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={() => approveItem(q.id)} disabled={!ready} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${ready ? 'bg-[#0E7C66] text-white hover:bg-black' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}>✓ Setujui</button>
                      <button onClick={() => setRejectId(q.id)} className="flex-1 border-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5733] hover:border-[#FF5733] hover:text-white transition-colors">Tolak</button>
                    </div>
                    {!ready && <p className="text-[9px] font-mono opacity-50">CENTANG KEDUA CHECKLIST REVIEW UNTUK MENGAKTIFKAN TOMBOL SETUJUI.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Keluhan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">VERIFIKASI DAN PELAYANAN KELUHAN</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-black text-white px-3 py-2">{openCases} DALAM ANTRIAN</span>
              </div>

    <div className="space-y-4">
      {cases.map((c) => {
        const open = caseDetail === c.id;
        return (
          <div key={c.id} className={`dash-item border-2 p-6 transition-all ${c.status === 'SELESAI' ? 'bg-white opacity-60 border-black' : open ? 'bg-white border-[#FF5733] shadow-[6px_6px_0_0_#FF5733]' : 'bg-white border-black'}`}>
            <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
              <h4 className="font-black text-lg">{c.t}</h4>
              <div className="flex items-center gap-2">
                <CaseBadge s={c.status} />
                {c.status !== 'SELESAI' && (
                  <button onClick={() => setCaseDetail(open ? null : c.id)} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">{open ? 'TUTUP DETAIL ▴' : 'DETAIL PROBLEM ▾'}</button>
                )}
              </div>
            </div>
            <p className="text-[10px] font-mono opacity-50 mb-3">{c.comm} × {c.talent} </p>
            <p className="text-sm opacity-70 leading-relaxed mb-5">{c.note}</p>
            {open && (
              <div className="space-y-4 mb-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-2 border-black/15 p-4">
                    <p className="text-[9px] font-mono font-bold text-[#FF5733] mb-2">PERNYATAAN KOMUNITAS · {c.comm.toUpperCase()}</p>
                    <p className="text-xs italic leading-relaxed">"{c.statComm}"</p>
                  </div>
                  <div className="border-2 border-black/15 p-4">
                    <p className="text-[9px] font-mono font-bold text-[#FF5733] mb-2">PERNYATAAN TALENTA · {c.talent.toUpperCase()}</p>
                    <p className="text-xs italic leading-relaxed">"{c.statTalent}"</p>
                  </div>
                </div>
                <div className="border-2 border-black/15 p-4">
                  <p className="text-[9px] font-mono font-bold opacity-50 mb-3">TIMELINE KELUHAN</p>
                  <div className="space-y-0">
                    {c.timeline.map((ev, i) => (
                      <div key={i} className="relative pl-8 pb-4 last:pb-0 border-l-2 border-black/10 last:border-transparent">
                        <span className={`absolute left-[-7px] top-0 w-3.5 h-3.5 rotate-45 border-2 border-black ${i === c.timeline.length - 1 ? 'bg-[#FF5733]' : 'bg-white'}`} />
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] font-mono font-bold">{ev.d}</span>
                          <p className="text-xs">{ev.e}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {c.status !== 'SELESAI' && (
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => { setMsgTarget({ key: `case-${c.id}`, name: `${c.comm} × ${c.talent}` }); setMsgText(''); }} className="flex-1 border-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
                  {sentMsgs[`case-${c.id}`] ? '✓ Pesan Terkirim — Kirim Lagi' : '✉ Hubungi Kedua Pihak'}
                </button>
                <button onClick={() => setResolveTarget(c)} className="flex-1 bg-[#FF5733] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Putuskan →</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </>
)}

          {/* ===== TAB: PENGGUNA ===== */}
          {tab === 'pengguna' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Daftar Pengguna</h1>
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
                        <th className="py-3 pr-4">Poin Reputasi</th>
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
    <h1 className="text-4xl md:text-5xl font-black tracking-tight">AgenSUSI</h1>
    <p className="text-[10px] font-mono opacity-50 mt-2">Pantau Kinerja AgenSUSI</p>
  </div>
  <span className="text-[10px] font-mono font-bold bg-black text-white px-3 py-2">{liaisons.filter((l) => l.status === 'AKTIF').length} AGEN AKTIF</span>
</div>
<div className="grid grid-cols-12 gap-6">
  <div className="dash-item col-span-12 lg:col-span-5 border-2 border-black bg-white p-7">
    <h3 className="text-xl font-black mb-5">Komunitas Tercatat / Minggu</h3>
    <MiniBars data={[{ l: 'M1', v: 4 }, { l: 'M2', v: 6 }, { l: 'M3', v: 5 }, { l: 'M4', v: 8 }]} />
    <div className="mt-6">
      <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>KOMUNITAS TERCATAT DARI TOTAL</span><span>42%</span></div>
      <div className="h-2 bg-black/10"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '42%' }} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2 mt-6">
      <div className="border-2 border-black/15 p-3"><p className="text-[9px] font-mono opacity-50">TOTAL KUNJUNGAN</p><p className="text-lg font-black">{liaisons.reduce((a, l) => a + l.visits, 0)}</p></div>
      <div className="border-2 border-black/15 p-3"><p className="text-[9px] font-mono opacity-50">TOTAL KOMUNITAS</p><p className="text-lg font-black">{liaisons.reduce((a, l) => a + l.assisted, 0)}</p></div>
    </div>
  </div>

  <div className="col-span-12 lg:col-span-7 space-y-4">
    {liaisons.map((l) => {
      const open = liaisonDetail === l.id;
      return (
        <div key={l.id} className={`dash-item bg-white p-6 border-2 transition-all ${open ? 'border-[#FF5733] shadow-[6px_6px_0_0_#FF5733]' : 'border-black'} ${l.status === 'DITANGGUHKAN' ? 'opacity-60' : ''}`}>
          <button onClick={() => setLiaisonDetail(open ? null : l.id)} className="w-full flex items-center justify-between gap-4 flex-wrap text-left">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 bg-[#FF5733] text-white flex items-center justify-center text-lg font-black">{l.n.charAt(0)}</span>
              <div>
                <p className="font-black">{l.n}</p>
                <p className="text-[10px] font-mono opacity-50">{l.visits} KUNJUNGAN · {l.assisted} KOMUNITAS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono font-bold px-2 py-1 ${l.status === 'AKTIF' ? 'bg-[#0E7C66] text-white' : 'bg-black text-white'}`}>{l.status}</span>
              <span className={`text-[10px] font-black transition-transform ${open ? 'rotate-90 text-[#FF5733]' : ''}`}>→</span>
            </div>
          </button>

          {open && (
            <div className="mt-4 border-t-2 border-black/10 pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="border-2 border-black/15 p-3"><p className="text-[9px] font-mono opacity-50">KUNJUNGAN</p><p className="text-lg font-black">{l.visits}</p></div>
                <div className="border-2 border-black/15 p-3"><p className="text-[9px] font-mono opacity-50">KOMUNITAS</p><p className="text-lg font-black">{l.assisted}</p></div>
              </div>

              <div>
                <p className="text-[9px] font-mono font-bold opacity-50 mb-2">RIWAYAT KUNJUNGAN TERAKHIR</p>
                <div className="space-y-2">
                  {l.history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between border-2 border-black/10 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-mono font-bold">{h.d}</span>
                        <span className="text-[10px] font-bold">{h.c}</span>
                      </div>
                      <span className={`text-[8px] font-mono font-bold px-2 py-0.5 ${h.s === 'TERDATA' ? 'bg-[#0E7C66] text-white' : h.s === 'BERLANGSUNG' ? 'bg-yellow-300 text-black' : 'bg-white border-2 border-black'}`}>{h.s}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] font-mono opacity-50">AKTIVITAS TERAKHIR: {l.last}</p>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setMsgTarget({ key: `liaison-${l.id}`, name: l.n }); setMsgText(''); }} className="flex-1 border-2 border-black py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
                  {sentMsgs[`liaison-${l.id}`] ? '✓ Terkirim — Kirim Lagi' : '✉ Hubungi'}
                </button>
                <button onClick={() => toggleLiaison(l.id)} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest border-2 transition-colors ${l.status === 'AKTIF' ? 'border-[#FF5733] text-[#FF5733] hover:bg-[#FF5733] hover:text-white' : 'border-[#0E7C66] text-[#0E7C66] hover:bg-[#0E7C66] hover:text-white'}`}>
                  {l.status === 'AKTIF' ? 'Tangguhkan' : 'Aktifkan'}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>
</>
)}


        </div>
      </main>
        
        {msgTarget && (
  <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md border-2 border-[#FF5733] p-8 relative">
      <button onClick={() => setMsgTarget(null)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white transition-colors">×</button>
      <span className="text-[10px] font-mono font-bold text-[#FF5733]">PESAN RESMI ADMIN</span>
      <h3 className="text-2xl font-black mt-2 mb-4">{msgTarget.name}</h3>
      <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm h-24 resize-none outline-none focus:border-[#FF5733]" placeholder="Tulis pesan resmi..." />
      <div className="flex flex-wrap gap-2 mt-3">
        {['Mohon tanggapan dalam 3 hari kerja.', 'Ketersediaan Ke Kantor', 'Lampirkan bukti pendukung laporan.'].map((qk) => (
          <button key={qk} onClick={() => setMsgText(qk)} className="text-[9px] font-mono border-2 border-black/20 px-2 py-1 hover:border-black transition-colors">+ {qk}</button>
        ))}
      </div>
      <button onClick={() => sendMsg(msgTarget.key)} disabled={!msgText.trim()} className={`w-full mt-4 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors ${msgText.trim() ? 'bg-[#0E7C66] text-white hover:bg-black' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}>Kirim Pesan →</button>
    </div>
  </div>
)}
      
      
      {/* MODAL PUTUSAN SENGKETA */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md border-2 border-[#FF5733] p-8 relative">
            <button onClick={() => setResolveTarget(null)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white transition-colors">×</button>
            <span className="text-[10px] font-mono font-bold text-[#FF5733]">KEPUTUSAN ADMIN</span>
            <h3 className="text-2xl font-black mt-2 mb-1">{resolveTarget.t}</h3>
            <p className="text-[10px] font-mono opacity-50 mb-6">{resolveTarget.comm} × {resolveTarget.talent}</p>
            <div className="space-y-3">   
              <button onClick={() => resolveCase(resolveTarget.id, 'talenta')} className="w-full border-2 border-black p-4 text-left hover:bg-black hover:text-white transition-colors">
                <p className="text-[10px] font-black uppercase tracking-widest">Tandai Proyek Selesai</p>
                <p className="text-[10px] opacity-60 mt-1">Proyek Akan Ditandai Selesai, dan Talenta Akan Mendapatkan Poin Reputasi.</p>
              </button>
              <button onClick={() => resolveCase(resolveTarget.id, 'perpanjang')} className="w-full border-2 border-black p-4 text-left hover:bg-black hover:text-white transition-colors">
                <p className="text-[10px] font-black uppercase tracking-widest">Perpanjang Durasi Proyek 7 Hari</p>
                <p className="text-[10px] opacity-60 mt-1">Durasi Proyek Akan Diperpanjang Untuk Melihat Perkembangan Lebih Lanjut.</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}