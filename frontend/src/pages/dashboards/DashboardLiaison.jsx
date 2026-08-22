import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MiniBars from '../../components/common/MiniBars';


function VerifyWidget() {
  const [talentDone, setTalentDone] = useState(false);
  const [communityOk, setCommunityOk] = useState(false);
  const done = talentDone && communityOk;

  useEffect(() => {
    if (done) gsap.fromTo('.rep-stamp', { scale: 2.2, autoAlpha: 0, rotation: -25 }, { scale: 1, autoAlpha: 1, rotation: -8, duration: 0.5, ease: 'back.out(2.5)' });
  }, [done]);

  const reset = () => { setTalentDone(false); setCommunityOk(false); };

  const steps = [
    { n: '06', l: 'TALENTA MENANDAI SELESAI', on: talentDone },
    { n: '07', l: 'KOMUNITAS MEMBENARKAN', on: communityOk },
    { n: '08', l: 'REPUTASI +1', on: done },
  ];

  return (
    <div className="dash-item border-2 border-black bg-white p-7 h-full flex flex-col">
      <div className="flex justify-between items-start mb-5">
        <div>
          <span className="text-[10px] font-mono font-bold text-[#FF5733]">F5 · SIMULASI INTERAKTIF</span>
          <h3 className="text-xl font-black mt-1">Verifikasi Proyek</h3>
        </div>
        <button onClick={reset} className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors">↺ RESET</button>
      </div>

      {/* KONTEKS PROJEK */}
      <div className="border-2 border-black/15 bg-[#FAFAFA] p-4 mb-5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 bg-black text-white flex items-center justify-center text-xs font-black">AI</span>
          <div>
            <p className="text-sm font-black">Aplikasi Iuran Warga</p>
            <p className="text-[10px] font-mono opacity-50">Derien A. × PKK RW 05 · DEADLINE 30 AGU 2026</p>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold bg-black text-white px-2 py-1">LANGKAH 05 · DIGARAP</span>
      </div>

      {/* DUA KARTU PIHAK — KLIK UNTUK KONFIRMASI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <button
          onClick={() => { setTalentDone(!talentDone); if (talentDone) setCommunityOk(false); }}
          className={`text-left p-5 border-2 transition-all ${talentDone ? 'border-[#0E7C66] bg-[#0E7C66]/10' : 'border-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000]'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 bg-black text-white flex items-center justify-center text-xs font-black">DA</span>
              <div>
                <p className="text-sm font-black">Talenta</p>
                <p className="text-[9px] font-mono opacity-50">LANGKAH 06</p>
              </div>
            </div>
            <span className={`w-6 h-6 border-2 flex items-center justify-center text-xs font-black transition-colors ${talentDone ? 'bg-[#0E7C66] border-[#0E7C66] text-white' : 'border-black bg-white'}`}>{talentDone ? '✓' : ''}</span>
          </div>
          <p className="text-[10px] opacity-60 leading-relaxed">{talentDone ? '✓ Pekerjaan ditandai selesai. Menunggu komunitas.' : 'Klik saat pekerjaan selesai dikerjakan.'}</p>
        </button>

        <button
          onClick={() => talentDone && setCommunityOk(!communityOk)}
          disabled={!talentDone}
          className={`text-left p-5 border-2 transition-all ${communityOk ? 'border-[#0E7C66] bg-[#0E7C66]/10' : talentDone ? 'border-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000]' : 'border-black/20 opacity-50 cursor-not-allowed'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 bg-[#FF5733] text-white flex items-center justify-center text-xs font-black">SA</span>
              <div>
                <p className="text-sm font-black">Komunitas</p>
                <p className="text-[9px] font-mono opacity-50">LANGKAH 07</p>
              </div>
            </div>
            <span className={`w-6 h-6 border-2 flex items-center justify-center text-xs font-black transition-colors ${communityOk ? 'bg-[#0E7C66] border-[#0E7C66] text-white' : 'border-black bg-white'}`}>{communityOk ? '✓' : ''}</span>
          </div>
          <p className="text-[10px] opacity-60 leading-relaxed">{!talentDone ? '🔒 Terkunci — menunggu talenta menandai selesai.' : communityOk ? '✓ Komunitas membenarkan hasil kerja.' : 'Klik untuk membenarkan hasil kerja.'}</p>
        </button>
      </div>

      {/* LANGKAH 06 → 08 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {steps.map((s) => (
          <div key={s.n} className={`border-2 p-3 text-center transition-colors ${s.on ? 'border-[#0E7C66] bg-[#0E7C66] text-white' : 'border-black/15 opacity-50'}`}>
            <p className="text-lg font-black">{s.n}</p>
            <p className="text-[8px] font-mono font-bold leading-tight">{s.l}</p>
          </div>
        ))}
      </div>

      {/* STATUS AKHIR */}
      <div className={`mt-auto relative p-4 border-2 text-center transition-colors ${done ? 'bg-[#0E7C66] border-[#0E7C66] text-white' : 'bg-yellow-100 border-yellow-400 text-yellow-900'}`}>
        {done ? (
          <div className="rep-stamp inline-block border-4 border-white px-4 py-2">
            <p className="font-black uppercase text-sm">✓ SELESAI DIVERIFIKASI</p>
            <p className="text-[10px] font-mono mt-1">REPUTASI TALENTA +1 · TESTIMONI TERCATAT</p>
          </div>
        ) : (
          <div>
            <p className="font-black uppercase text-sm">Status Menggantung</p>
            <p className="text-[10px] font-mono mt-1">REPUTASI TIDAK BERUBAH SAMPAI KEDUA PIHAK KONFIRMASI</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardLiaison({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [visitFilter, setVisitFilter] = useState('SEMUA');
  const [form, setForm] = useState({ nama: '', tipe: 'PKK', leader: '', issue: '', cat: 'PENCATATAN', addr: '' });
  const [coords, setCoords] = useState(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visits, setVisits] = useState([
    { id: 1, comm: 'PKK RW 03 Cijerah', sec: 'BARAT–SELATAN', date: 'HARI INI', time: '09.00', addr: 'Jl. Cijerah II No. 12', lat: -6.9210, lng: 107.5900, status: 'DIRENCANAKAN', note: 'Ibu ketua ingin konsultasi rekap iuran warga.', pic: 'Ibu Rina (Ketua RW 03)' },
    { id: 2, comm: 'Karang Taruna Cibuntu', sec: 'BARAT–SELATAN', date: 'HARI INI', time: '13.30', addr: 'Sekretariat KT, Jl. Cibuntu Raya', lat: -6.9280, lng: 107.5820, status: 'BERLANGSUNG', note: 'Survei kebutuhan website galeri kegiatan pemuda.', pic: 'Budi (Ketua KT)' },
    { id: 3, comm: 'Paguyuban Pedagang Pasar', sec: 'TIMUR–UTARA', date: 'KEMARIN', time: '10.00', addr: 'Blok C Pasar Antapani', lat: -6.9020, lng: 107.6600, status: 'TERDATA', note: 'Katalog produk online. Sudah masuk dalam antrian.', pic: 'Haji Rahmat' },
    { id: 4, comm: 'Posyandu Melati', sec: 'TIMUR–UTARA', date: 'BESOK', time: '08.00', addr: 'Posyandu Melati, Jl. Antapani Tengah', lat: -6.9080, lng: 107.6680, status: 'DIRENCANAKAN', note: 'Kader ingin data penimbangan tidak manual.', pic: 'Bidan Rina' },
  ]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifs, setNotifs] = useState([
  { id: 1, type: 'kunjungan', title: 'Agenda hari ini: 2 kunjungan', sub: 'PKK RW 03 Cijerah · 09.00', read: false },
  { id: 2, type: 'intake', title: 'Pengaduan baru masuk antrian', sub: 'Paguyuban Pedagang · Baratlaut', read: false },
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
    { n: 'PKK RW 05', v: '12 AGU 2026', need: 'Rekap Iuran Digital', s: 'TERCATAT' },
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
const makeIcon = (bg, border, label, big) => L.divIcon({
className: '',
html: `<div style="width:${big ? 38 : 28}px;height:${big ? 38 : 28}px;background:${bg};border:2px solid ${border};transform:rotate(45deg);display:flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 rgba(0,0,0,.4)"><span style="transform:rotate(-45deg);font-family:monospace;font-weight:700;font-size:${big ? 12 : 10}px;color:${bg === '#fff' || bg === '#FDE047' ? '#000' : '#fff'}">${label}</span></div>`,
iconSize: [big ? 38 : 28, big ? 38 : 28], iconAnchor: [big ? 19 : 14, big ? 19 : 14],
});
visits.forEach((v) => {
const isSel = selectedVisit && selectedVisit.id === v.id;
const icon = isSel ? makeIcon('#FF5733', '#000', v.comm.charAt(0), true)
: v.status === 'TERDATA' ? makeIcon('#0E7C66', '#000', v.comm.charAt(0))
: v.status === 'BERLANGSUNG' ? makeIcon('#FDE047', '#000', v.comm.charAt(0))
: makeIcon('#fff', '#000', v.comm.charAt(0));
const m = L.marker([v.lat, v.lng], { icon, zIndexOffset: isSel ? 1000 : 0 }).addTo(areaMarkers.current);
m.on('click', () => setSelectedVisit(isSel ? null : v));
});
}, [tab, visits, selectedVisit]);

/* ===== FLY TO MARKER SAAT DIPILIH ===== */
useEffect(() => {
if (tab !== 'map' || !areaMapInst.current || !selectedVisit) return;
areaMapInst.current.flyTo([selectedVisit.lat, selectedVisit.lng], 15, { duration: 0.8 });
}, [selectedVisit, tab]);

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
      () => { placeFormMarker(-6.9147, 107.6096); setGpsMsg('GPS GAGAL MENDETEKSI, PASTIKAN GPS AKTIF.'); },
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
    const m = { TERCATAT: 'bg-[#0E7C66] text-white', 'PROYEK BERJALAN': 'bg-yellow-300 text-black', TERDATA: 'bg-black text-white' };
    return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
  };

  const first = (user?.name || 'Agen').split(' ')[0];
  const NAV = [
    { id: 'beranda', n: '01', l: 'BERANDA' },
    { id: 'kunjungan', n: '02', l: 'KUNJUNGAN' },
    { id: 'catat', n: '03', l: 'CATAT PENGADUAN ' },
    { id: 'map', n: '04', l: 'MAP KOMUNITAS' },
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
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dashboard Lapangan</p>
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
          <p className="text-[10px] font-mono opacity-50 leading-relaxed">Memiliki Masalah?<br />Hubungi WhatsApp Kami:</p>
          <p className="text-[10px] font-bold opacity-50 leading-relaxed">+62 22 123 4567</p>
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
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, Agen {first}.</h1>
                  <p className="text-sm opacity-60 max-w-xl leading-relaxed">Selamat datang di dashboard AgenSUSI</p>
                </div>
                <button onClick={() => { setSent(false); setTab('catat'); }} className="bg-[#FF5733] text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-black transition-all">
                  + Catat Pengaduan
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                {[
                  { t: 23, l: 'Kunjungan bulan ini' },
                  { t: 19, l: 'Pengaduan terdata' },
                  { t: 11, l: 'Diproses Talenta' },
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
                          <p className="text-[10px] font-mono opacity-50 mb-2">📍 {v.addr}</p>
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
                    <h3 className="text-xl font-black mt-1 mb-5">Statistik Progresmu</h3>
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>KUNJUNGAN</span><span>23 / 30</span></div>
                    <div className="h-3 bg-white/15 border-2 border-white/30 mb-5"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '76%' }} /></div>
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>PENGADUAN TERDATA</span><span>19 / 25</span></div>
                    <div className="h-3 bg-white/15 border-2 border-white/30"><div className="bar-h h-full bg-[#0E7C66]" style={{ width: '76%' }} /></div>
                  </div>
                  <div className="dash-item border-2 border-black bg-white p-7">
                    <h3 className="text-xl font-black mb-4">Tips Lapangan</h3>
                    <p className="text-sm opacity-70 leading-relaxed"><span className="font-black">Bangun Kepercayaan Di Lapangan</span>, Karena banyak komunitas ragu kasih data ke pihak yang belum dikenal, kehadiran fisik AgenSUSI menjadi bukti keseriusan sistem.</p>
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
                  <p className="text-[10px] font-mono opacity-50 mt-2">DAFTAR KUNJUNGANMU</p>
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
                        <p className="text-[10px] font-mono opacity-50 mt-1">{v.date} · {v.time} · 📍 {v.addr}</p>
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
                        <span className="flex-1 text-center border-2 border-black/20 py-2.5 text-[10px] font-mono font-bold opacity-60">MASUK DALAM ANTRIAN PROYEK ✓</span>
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
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Pengaduan Dicatat!</h1>
                <p className="text-sm opacity-60 leading-relaxed mb-8">Pengaduan Anda telah berhasil dicatat dan akan segera ditindaklanjuti. Silahkan hubungi kantor jika mengalami kendala.</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={() => { setSent(false); setForm({ nama: '', tipe: 'PKK', leader: '', issue: '', cat: 'PENCATATAN', addr: '' }); setCoords(null); setGpsMsg(''); }} className="bg-[#FF5733] text-white px-8 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">+ Catat Lagi</button>
                  <button onClick={() => setTab('kunjungan')} className="border-2 border-black px-8 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Ke Kunjungan →</button>
                </div>
              </div>
            ) : (
              <>
                <div className="dash-item mb-6">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Catat Pengaduan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">CATAT MASALAH YANG DIADUKAN KOMUNITAS DIFORM INI</p>
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
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Nama Ketua Komunitas</label>
                        <input value={form.leader} onChange={(e) => setForm((f) => ({ ...f, leader: e.target.value }))} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] bg-transparent" placeholder="Mis. Ibu Siti Aminah" />
                      </div>
                    </div>
                    <div className="dash-item border-2 border-black bg-white p-7 space-y-5">
                      <span className="text-[10px] font-mono font-bold text-[#FF5733]">B · MASALAH YANG DIALAMI</span>
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
                        Simpan Kedalam Antrian →
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
<h1 className="text-4xl md:text-5xl font-black tracking-tight">Map Komunitas Terdaftar</h1>
<p className="text-[10px] font-mono opacity-50 mt-2">Daftar Komunitas Yang Terdaftar</p>
</div>
<div className="dash-item border-2 border-black bg-white p-3 flex items-center gap-5 text-[9px] font-mono font-bold">
<span className="flex items-center gap-2"><span className="w-3 h-3 bg-white border-2 border-black rotate-45"></span> DIRENCANAKAN</span>
<span className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-300 border-2 border-black rotate-45"></span> BERLANGSUNG</span>
<span className="flex items-center gap-2"><span className="w-3 h-3 bg-[#0E7C66] border-2 border-black rotate-45"></span> TERDATA</span>
</div>
</div>
<div className="grid grid-cols-12 gap-6">
{/* LIST CARD INTERAKTIF */}
<div className="col-span-12 lg:col-span-4 space-y-4">
{visits.map((v) => {
const isSel = selectedVisit && selectedVisit.id === v.id;
return (
<div key={v.id} className={`dash-item border-2 bg-white transition-all ${isSel ? 'border-[#FF5733] shadow-[4px_4px_0_0_#FF5733]' : 'border-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FF5733]'}`}>
<button onClick={() => setSelectedVisit(isSel ? null : v)} className="w-full p-4 flex items-center justify-between gap-3 text-left">
<div className="min-w-0">
<p className="font-black text-sm truncate">{v.comm}</p>
<p className="text-[9px] font-mono opacity-50">{v.date} · {v.time}</p>
</div>
<div className="flex items-center gap-2 shrink-0">
{visitBadge(v.status)}
<span className={`text-[10px] font-black text-[#FF5733] transition-transform ${isSel ? 'rotate-90' : ''}`}>→</span>
</div>
</button>
{isSel && (
<div className="border-t-2 border-black/10 p-4 bg-[#FAFAFA] space-y-3">
<div>
<p className="text-[9px] font-mono font-bold opacity-50 mb-1">ALAMAT LENGKAP</p>
<p className="text-xs font-bold">📍 {v.addr}</p>
<p className="text-[9px] font-mono opacity-50 mt-1">{v.lat.toFixed(4)}, {v.lng.toFixed(4)}</p>
</div>
{v.pic && (
<div>
<p className="text-[9px] font-mono font-bold opacity-50 mb-1">NARAHUBUNG</p>
<p className="text-xs font-bold">{v.pic}</p>
</div>
)}
<div>
<p className="text-[9px] font-mono font-bold opacity-50 mb-1">CATATAN KUNJUNGAN</p>
<p className="text-xs opacity-70 leading-relaxed">{v.note}</p>
</div>
<div className="flex gap-2 flex-wrap">
<button onClick={() => openRoute(v)} className="flex-1 border-2 border-black py-2 text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">🧭 Rute</button>
{v.status === 'DIRENCANAKAN' && (
<button onClick={() => { setVisitStatus(v.id, 'BERLANGSUNG'); setSelectedVisit({ ...v, status: 'BERLANGSUNG' }); }} className="flex-1 bg-black text-white py-2 text-[9px] font-black uppercase tracking-widest hover:bg-[#FF5733] transition-colors">Mulai Kunjungan →</button>
)}
{v.status === 'BERLANGSUNG' && (
<button onClick={() => recordResult(v)} className="flex-1 bg-[#0E7C66] text-white py-2 text-[9px] font-black uppercase tracking-widest hover:bg-black transition-colors">Catat Hasil →</button>
)}
</div>
</div>
)}
</div>
);
})}
</div>
{/* MAP + POPUP DETAIL */}
<div className="col-span-12 lg:col-span-8">
<div className="dash-item relative h-[520px] border-2 border-black bg-white overflow-hidden">
<div className="absolute inset-0 z-0"><div ref={areaMapEl} className="w-full h-full" /></div>
{selectedVisit && (
<div className="absolute top-3 right-3 z-10 w-[270px] bg-white border-2 border-black p-4 shadow-[6px_6px_0_0_#000]">
<button onClick={() => setSelectedVisit(null)} className="absolute top-2 right-2 w-6 h-6 border-2 border-black flex items-center justify-center text-xs font-black hover:bg-black hover:text-white">×</button>
{visitBadge(selectedVisit.status)}
<h3 className="font-black text-sm leading-tight mt-2">{selectedVisit.comm}</h3>
<p className="text-[9px] font-mono opacity-50 mt-1 mb-3">📍 {selectedVisit.addr}</p>
<button onClick={() => openRoute(selectedVisit)} className="w-full bg-black text-white py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-[#FF5733] transition-colors">🧭 Buka Rute Google Maps</button>
</div>
)}
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
                  <p className="text-[10px] font-mono opacity-50 mt-2">Detail Laporan Kinerjamu</p>
                </div>
                <button className="border-2 border-black px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">⬇ Unduh Laporan (PDF)</button>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="dash-item col-span-12 lg:col-span-5 border-2 border-black bg-white p-7">
                  <h3 className="text-xl font-black mb-5">Kunjungan / Minggu</h3>
                  <MiniBars data={[{ l: 'Minggu-1', v: 5 }, { l: 'Minggu-2', v: 7 }, { l: 'Minggu-3', v: 6 }, { l: 'Minggu-4', v: 5 }]} />
                  <div className="mt-6">
                    <div className="flex justify-between text-[10px] font-mono font-bold mb-2"><span>TOTAL KOMUNITAS YANG TELAH TERCATAT</span><span>87%</span></div>
                    <div className="h-2 bg-black/10"><div className="bar-h h-full bg-[#FF5733]" style={{ width: '87%' }} /></div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-7 border-2 border-black bg-white p-7 dash-item">
                  <h3 className="text-xl font-black mb-5">Daftar Komunitas Yang Telah Dicatat</h3>
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