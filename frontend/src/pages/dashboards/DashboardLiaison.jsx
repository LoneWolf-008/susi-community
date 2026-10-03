import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DashShell from '../../components/common/DashShell';
import MiniBars from '../../components/common/MiniBars';

const CHIP = { green: 'bg-[#c9ecd9] text-[#12283c]', navy: 'bg-[#12283c] text-[#f2efe6]', red: 'bg-[#e62b2b] text-white', ghost: 'bg-[#12283c]/10 text-[#12283c]/70' };
const chip = (k, t) => <span className={`chip-mono border-0 ${CHIP[k]}`}>{t}</span>;
const VISIT_CHIP = { DIRENCANAKAN: 'ghost', BERLANGSUNG: 'red', TERDATA: 'green' };

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
  const [notifs, setNotifs] = useState([
    { id: 1, type: 'kunjungan', title: 'Agenda hari ini: 2 kunjungan', sub: 'PKK RW 03 Cijerah · 09.00', read: false },
    { id: 2, type: 'intake', title: 'Pengaduan baru masuk antrian', sub: 'Paguyuban Pedagang · Baratlaut', read: false },
    { id: 3, type: 'sistem', title: 'Laporan mingguan siap', sub: 'Unduh di tab Laporan', read: true },
  ]);
  const formMapEl = useRef(null); const formMapInst = useRef(null); const formMarker = useRef(null);
  const areaMapEl = useRef(null); const areaMapInst = useRef(null); const areaMarkers = useRef(null);
  const rootRef = useRef(null);
  const NOTIF_META = { kunjungan: { c: '#e62b2b', l: 'KUNJUNGAN' }, intake: { c: '#c9ecd9', l: 'INTAKE' }, sistem: { c: '#9CA3AF', l: 'SISTEM' } };
  const NAV = [
    { id: 'beranda', n: '01', l: 'Beranda' }, { id: 'kunjungan', n: '02', l: 'Kunjungan' },
    { id: 'catat', n: '03', l: 'Catat Pengaduan' }, { id: 'map', n: '04', l: 'Map Komunitas' }, { id: 'laporan', n: '05', l: 'Laporan' },
  ];
  const ACCOMPANIED = [
    { n: 'PKK RW 05', v: '12 AGU 2026', need: 'Rekap Iuran Digital', s: 'TERCATAT' },
    { n: 'KT Mekar', v: '08 AGU 2026', need: 'Website Galeri', s: 'PROYEK BERJALAN' },
    { n: 'Paguyuban Pedagang', v: '02 AGU 2026', need: 'Katalog UMKM', s: 'TERDATA' },
  ];
  const first = (user?.name || 'Agen').split(' ')[0];
  const agenda = visits.filter((v) => v.date === 'HARI INI' && v.status !== 'TERDATA');
  const filteredVisits = visitFilter === 'SEMUA' ? visits : visits.filter((v) => v.status === visitFilter);
  const quadrantOf = (loc) => `${loc.lng < 107.6191 ? 'BARAT' : 'TIMUR'}–${loc.lat > -6.9175 ? 'UTARA' : 'SELATAN'}`;
  const openRoute = (v) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`, '_blank');
  const setVisitStatus = (id, status) => setVisits((v) => v.map((x) => (x.id === id ? { ...x, status } : x)));
  const recordResult = (v) => { setForm((f) => ({ ...f, nama: v.comm, addr: v.addr })); setCoords({ lat: v.lat, lng: v.lng }); setSent(false); setTab('catat'); };
  const submitIntake = () => {
    if (!form.nama.trim() || !form.issue.trim() || !coords) return;
    setVisits((v) => [...v, { id: Date.now(), comm: form.nama, sec: quadrantOf(coords), date: 'HARI INI', time: 'SEKARANG', addr: form.addr || '—', lat: coords.lat, lng: coords.lng, status: 'TERDATA', note: form.issue }]);
    setSent(true);
  };
  const placeFormMarker = (lat, lng) => {
    if (!formMapInst.current) return;
    if (formMarker.current) formMarker.current.setLatLng([lat, lng]);
    else formMarker.current = L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div style="width:20px;height:20px;background:#e62b2b;border:2px solid #12283c;transform:rotate(45deg)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(formMapInst.current);
    setCoords({ lat, lng });
  };
  const grabGPS = () => {
    setGpsMsg('MENCARI GPS...');
    if (!navigator.geolocation) { setGpsMsg('GPS TIDAK DIDUKUNG — KLIK MAP MANUAL'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { placeFormMarker(p.coords.latitude, p.coords.longitude); setGpsMsg('GPS TERTANGKAP ✓'); },
      () => { placeFormMarker(-6.9147, 107.6096); setGpsMsg('GPS GAGAL, PASTIKAN GPS AKTIF.'); },
    );
  };
  useEffect(() => {
    if (tab !== 'catat' || sent || !formMapEl.current || formMapInst.current) return;
    const map = L.map(formMapEl.current).setView([-6.9147, 107.6096], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    map.on('click', (e) => placeFormMarker(e.latlng.lat, e.latlng.lng));
    formMapInst.current = map;
    return () => { map.remove(); formMapInst.current = null; formMarker.current = null; };
  }, [tab, sent]);
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
    const makeIcon = (bg, border, label, big) => L.divIcon({ className: '', html: `<div style="width:${big ? 38 : 28}px;height:${big ? 38 : 28}px;background:${bg};border:2px solid ${border};transform:rotate(45deg);display:flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 rgba(0,0,0,.25)"><span style="transform:rotate(-45deg);font-family:monospace;font-weight:700;font-size:${big ? 12 : 10}px;color:${bg === '#fdfcf7' ? '#12283c' : '#fff'}">${label}</span></div>`, iconSize: [big ? 38 : 28, big ? 38 : 28], iconAnchor: [big ? 19 : 14, big ? 19 : 14] });
    visits.forEach((v) => {
      const isSel = selectedVisit && selectedVisit.id === v.id;
      const icon = isSel ? makeIcon('#e62b2b', '#12283c', v.comm.charAt(0), true)
        : v.status === 'TERDATA' ? makeIcon('#c9ecd9', '#12283c', v.comm.charAt(0))
        : v.status === 'BERLANGSUNG' ? makeIcon('#e62b2b', '#12283c', v.comm.charAt(0))
        : makeIcon('#fdfcf7', '#12283c', v.comm.charAt(0));
      const m = L.marker([v.lat, v.lng], { icon, zIndexOffset: isSel ? 1000 : 0 }).addTo(areaMarkers.current);
      m.on('click', () => setSelectedVisit(isSel ? null : v));
    });
  }, [tab, visits, selectedVisit]);
  useEffect(() => {
    if (tab !== 'map' || !areaMapInst.current || !selectedVisit) return;
    areaMapInst.current.flyTo([selectedVisit.lat, selectedVisit.lng], 15, { duration: 0.8 });
  }, [selectedVisit, tab]);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => { const t = +el.dataset.target; const o = { val: 0 }; gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } }); });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, sent]);
  const shellNotifs = notifs.map((n) => ({ ...n, color: NOTIF_META[n.type]?.c, label: NOTIF_META[n.type]?.l }));
  const onTab = (id) => { setTab(id); setSelectedVisit(null); };

  return (
    <DashShell user={user} roleLabel="AGENSUSI" nav={NAV} tab={tab} onTab={onTab} notifs={shellNotifs} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {/* ============ BERANDA ============ */}
        {tab === 'beranda' && (
          <>
            <div className="dash-item card-light p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
              <div><p className="label-mono mb-2">Dashboard Lapangan</p><h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, Agen {first}.</h1><p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed">Selamat datang di dashboard AgenSUSI</p></div>
              <button onClick={() => { setSent(false); setTab('catat'); }} className="btn-pill btn-red">+ Catat Pengaduan</button>
            </div>
            <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
              {[{ t: 23, l: 'KUNJUNGAN BULAN INI' }, { t: 19, l: 'PENGADUAN TERDATA' }, { t: 11, l: 'DIPROSES TALENTA' }].map((s, i) => (
                <div key={i} className="dash-item bg-[#fdfcf7] p-6 hover:bg-[#e62b2b] hover:text-white transition-colors">
                  <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div>
                  <p className="label-mono mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8">
                <div className="dash-item card-light p-7">
                  <div className="flex justify-between items-start mb-5"><h3 className="text-xl font-black">Agenda Hari Ini</h3><span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{agenda.length} KUNJUNGAN</span></div>
                  <div className="space-y-4">
                    {agenda.map((v) => (
                      <div key={v.id} className="rounded-xl border border-[#12283c]/15 p-5 hover:border-[#12283c] transition-colors">
                        <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
                          <div className="flex items-center gap-3"><span className="text-lg font-black font-mono">{v.time}</span><h4 className="font-black">{v.comm}</h4></div>
                          {chip(VISIT_CHIP[v.status], v.status)}
                        </div>
                        <p className="font-mono text-[10px] opacity-50 mb-2">📍 {v.addr}</p>
                        <p className="text-xs text-[#12283c]/60 mb-4">{v.note}</p>
                        <div className="flex gap-2 flex-wrap">
                          {v.status === 'DIRENCANAKAN' && <button onClick={() => setVisitStatus(v.id, 'BERLANGSUNG')} className="flex-1 btn-pill btn-navy !py-2.5 text-[10px]">Mulai Kunjungan →</button>}
                          {v.status === 'BERLANGSUNG' && <button onClick={() => recordResult(v)} className="flex-1 btn-pill bg-[#c9ecd9] text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] !py-2.5 text-[10px]">Catat Hasil →</button>}
                          <button onClick={() => openRoute(v)} className="flex-1 btn-pill btn-ghost-dark !py-2.5 text-[10px]">🧭 Rute</button>
                        </div>
                      </div>
                    ))}
                    {agenda.length === 0 && <p className="text-center font-mono text-xs opacity-50 py-6">TIDAK ADA AGENDA HARI INI.</p>}
                  </div>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <div className="dash-item rounded-xl bg-[#12283c] text-[#f2efe6] p-7">
                  <span className="label-mono !text-[#e62b2b] !opacity-100">TARGET BULANAN</span>
                  <h3 className="text-xl font-black mt-1 mb-5">Statistik Progresmu</h3>
                  <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>KUNJUNGAN</span><span>23 / 30</span></div>
                  <div className="h-3 rounded-full bg-white/15 overflow-hidden mb-5"><div className="bar-h h-full rounded-full bg-[#e62b2b]" style={{ width: '76%' }} /></div>
                  <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>PENGADUAN TERDATA</span><span>19 / 25</span></div>
                  <div className="h-3 rounded-full bg-white/15 overflow-hidden"><div className="bar-h h-full rounded-full bg-[#c9ecd9]" style={{ width: '76%' }} /></div>
                </div>
                <div className="dash-item card-light p-7">
                  <h3 className="text-xl font-black mb-4">Tips Lapangan</h3>
                  <p className="text-sm text-[#12283c]/70 leading-relaxed"><span className="font-black text-[#12283c]">Bangun Kepercayaan Di Lapangan</span> — banyak komunitas ragu kasih data ke pihak yang belum dikenal; kehadiran fisik AgenSUSI menjadi bukti keseriusan sistem.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ KUNJUNGAN ============ */}
        {tab === 'kunjungan' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Kunjungan</h1><p className="label-mono mt-2">DAFTAR KUNJUNGANMU</p></div>
              <div className="flex flex-wrap gap-2">
                {['SEMUA', 'DIRENCANAKAN', 'BERLANGSUNG', 'TERDATA'].map((s) => (
                  <button key={s} onClick={() => setVisitFilter(s)} className={`chip-mono transition-colors ${visitFilter === s ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {filteredVisits.map((v) => (
                <div key={v.id} className="dash-item card-light p-6">
                  <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
                    <div><h4 className="font-black text-lg">{v.comm}</h4><p className="font-mono text-[10px] opacity-50 mt-1">{v.date} · {v.time} · 📍 {v.addr}</p></div>
                    {chip(VISIT_CHIP[v.status], v.status)}
                  </div>
                  <p className="text-xs text-[#12283c]/60 mb-4">{v.note}</p>
                  <div className="flex gap-2 flex-wrap">
                    {v.status === 'DIRENCANAKAN' && <button onClick={() => setVisitStatus(v.id, 'BERLANGSUNG')} className="flex-1 btn-pill btn-navy !py-2.5 text-[10px]">Mulai Kunjungan →</button>}
                    {v.status === 'BERLANGSUNG' && <button onClick={() => recordResult(v)} className="flex-1 btn-pill bg-[#c9ecd9] text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] !py-2.5 text-[10px]">Catat Hasil →</button>}
                    {v.status === 'TERDATA' && <span className="flex-1 text-center rounded-full border border-[#12283c]/20 py-2.5 font-mono text-[10px] font-bold opacity-60">MASUK ANTRIAN PROYEK ✓</span>}
                    <button onClick={() => openRoute(v)} className="flex-1 btn-pill btn-ghost-dark !py-2.5 text-[10px]">🧭 Rute</button>
                  </div>
                </div>
              ))}
              {filteredVisits.length === 0 && <p className="dash-item card-light p-8 text-center font-mono text-xs opacity-50">TIDAK ADA KUNJUNGAN DENGAN STATUS INI.</p>}
            </div>
          </>
        )}

        {/* ============ CATAT ============ */}
        {tab === 'catat' && (sent ? (
          <div className="dash-item card-light p-14 text-center max-w-2xl mx-auto">
            <div className="inline-flex w-24 h-24 rounded-full bg-[#c9ecd9] text-[#12283c] items-center justify-center text-5xl font-black mb-6">✓</div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Pengaduan Dicatat!</h1>
            <p className="text-sm text-[#12283c]/60 leading-relaxed mb-8">Pengaduan Anda telah berhasil dicatat dan akan segera ditindaklanjuti. Silahkan hubungi kantor jika mengalami kendala.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => { setSent(false); setForm({ nama: '', tipe: 'PKK', leader: '', issue: '', cat: 'PENCATATAN', addr: '' }); setCoords(null); setGpsMsg(''); }} className="btn-pill btn-red">+ Catat Lagi</button>
              <button onClick={() => setTab('kunjungan')} className="btn-pill btn-ghost-dark">Ke Kunjungan →</button>
            </div>
          </div>
        ) : (
          <>
            <div className="dash-item mb-6"><h1 className="text-4xl md:text-5xl font-black tracking-tight">Catat Pengaduan</h1><p className="label-mono mt-2">CATAT MASALAH YANG DIADUKAN KOMUNITAS</p></div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-6 space-y-6">
                <div className="dash-item card-light p-7 space-y-5">
                  <span className="label-mono !text-[#e62b2b] !opacity-100">A · DATA KOMUNITAS</span>
                  <div><label className="field-label">Nama Komunitas</label><input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="input-line" placeholder="Mis. PKK RW 03 Cijerah" /></div>
                  <div>
                    <label className="field-label">Jenis Komunitas</label>
                    <div className="flex flex-wrap gap-2">
                      {['PKK', 'RT/RW', 'KARANG TARUNA', 'UMKM', 'LAINNYA'].map((t) => (
                        <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tipe: t }))} className={`chip-mono transition-colors ${form.tipe === t ? 'border-0 bg-[#12283c] text-[#f2efe6]' : 'text-[#12283c]'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div><label className="field-label">Nama Ketua Komunitas</label><input value={form.leader} onChange={(e) => setForm((f) => ({ ...f, leader: e.target.value }))} className="input-line" placeholder="Mis. Ibu Siti Aminah" /></div>
                </div>
                <div className="dash-item card-light p-7 space-y-5">
                  <span className="label-mono !text-[#e62b2b] !opacity-100">B · MASALAH YANG DIALAMI</span>
                  <textarea value={form.issue} onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value }))} className="input-line h-28 resize-none" placeholder='Contoh: "iuran warga sering hilang, susah direkap tiap bulan"' />
                  <div>
                    <label className="field-label">Kategori Kebutuhan</label>
                    <div className="flex flex-wrap gap-2">
                      {['PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                        <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, cat: c }))} className={`chip-mono transition-colors ${form.cat === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c]'}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-6">
                <div className="dash-item card-light p-7">
                  <span className="label-mono !text-[#e62b2b] !opacity-100">C · LOKASI KOMUNITAS</span>
                  <div className="my-4"><button type="button" onClick={grabGPS} className="w-full btn-pill btn-navy !py-3 text-[10px]">📡 Gunakan GPS Saya</button></div>
                  {gpsMsg && <p className="font-mono text-[9px] font-bold mb-3">{gpsMsg}</p>}
                  <div className="relative z-0 rounded-xl border border-[#12283c]/15 h-[280px] mb-4 overflow-hidden"><div ref={formMapEl} className="w-full h-full" /></div>
                  <p className="chip-mono border-0 bg-[#12283c] text-[#f2efe6] inline-block mb-4">{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} · ${quadrantOf(coords)}` : 'BELUM ADA TITIK — GPS / KLIK MAP'}</p>
                  <div><label className="field-label">Alamat / Patokan</label><input value={form.addr} onChange={(e) => setForm((f) => ({ ...f, addr: e.target.value }))} className="input-line" placeholder="Mis. Balai RW 03, sebelah pos ronda" /></div>
                  <button onClick={submitIntake} disabled={!form.nama.trim() || !form.issue.trim() || !coords} className={`btn-pill w-full mt-6 ${form.nama.trim() && form.issue.trim() && coords ? 'btn-red' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}>Simpan Kedalam Antrian →</button>
                </div>
              </div>
            </div>
          </>
        ))}

        {/* ============ MAP ============ */}
        {tab === 'map' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Map Komunitas Terdaftar</h1><p className="label-mono mt-2">DAFTAR KOMUNITAS YANG TERDAFTAR</p></div>
              <div className="dash-item card-light p-3 flex items-center gap-5 font-mono text-[9px] font-bold">
                <span className="flex items-center gap-2"><span className="w-3 h-3 bg-[#fdfcf7] border-2 border-[#12283c] rotate-45"></span> DIRENCANAKAN</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 bg-[#e62b2b] border-2 border-[#12283c] rotate-45"></span> BERLANGSUNG</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 bg-[#c9ecd9] border-2 border-[#12283c] rotate-45"></span> TERDATA</span>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-4 space-y-4">
                {visits.map((v) => {
                  const isSel = selectedVisit && selectedVisit.id === v.id;
                  return (
                    <div key={v.id} className={`dash-item card-light transition-all ${isSel ? 'border-[#e62b2b] shadow-[0_10px_25px_rgba(230,43,43,0.15)]' : 'hover:-translate-y-0.5'}`}>
                      <button onClick={() => setSelectedVisit(isSel ? null : v)} className="w-full p-4 flex items-center justify-between gap-3 text-left">
                        <div className="min-w-0"><p className="font-black text-sm truncate">{v.comm}</p><p className="font-mono text-[9px] opacity-50">{v.date} · {v.time}</p></div>
                        <div className="flex items-center gap-2 shrink-0">{chip(VISIT_CHIP[v.status], v.status)}<span className={`text-[10px] font-black text-[#e62b2b] transition-transform ${isSel ? 'rotate-90' : ''}`}>→</span></div>
                      </button>
                      {isSel && (
                        <div className="border-t border-[#12283c]/10 p-4 bg-[#f2efe6] space-y-3">
                          <div><p className="label-mono mb-1">ALAMAT LENGKAP</p><p className="text-xs font-bold">📍 {v.addr}</p><p className="font-mono text-[9px] opacity-50 mt-1">{v.lat.toFixed(4)}, {v.lng.toFixed(4)}</p></div>
                          {v.pic && <div><p className="label-mono mb-1">NARAHUBUNG</p><p className="text-xs font-bold">{v.pic}</p></div>}
                          <div><p className="label-mono mb-1">CATATAN KUNJUNGAN</p><p className="text-xs text-[#12283c]/70 leading-relaxed">{v.note}</p></div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => openRoute(v)} className="flex-1 btn-pill btn-ghost-dark !py-2 text-[9px]">🧭 Rute</button>
                            {v.status === 'DIRENCANAKAN' && <button onClick={() => { setVisitStatus(v.id, 'BERLANGSUNG'); setSelectedVisit({ ...v, status: 'BERLANGSUNG' }); }} className="flex-1 btn-pill btn-navy !py-2 text-[9px]">Mulai →</button>}
                            {v.status === 'BERLANGSUNG' && <button onClick={() => recordResult(v)} className="flex-1 btn-pill bg-[#c9ecd9] text-[#12283c] !py-2 text-[9px]">Catat Hasil →</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="col-span-12 lg:col-span-8">
                <div className="dash-item relative h-[520px] rounded-xl border border-[#12283c]/15 overflow-hidden">
                  <div className="absolute inset-0 z-0"><div ref={areaMapEl} className="w-full h-full" /></div>
                  {selectedVisit && (
                    <div className="absolute top-3 right-3 z-10 w-[270px] card-light p-4 shadow-xl">
                      <button onClick={() => setSelectedVisit(null)} className="absolute top-2 right-2 w-6 h-6 rounded-full border border-[#12283c]/30 flex items-center justify-center text-xs font-black hover:bg-[#e62b2b] hover:text-white hover:border-[#e62b2b]">×</button>
                      {chip(VISIT_CHIP[selectedVisit.status], selectedVisit.status)}
                      <h3 className="font-black text-sm leading-tight mt-2">{selectedVisit.comm}</h3>
                      <p className="font-mono text-[9px] opacity-50 mt-1 mb-3">📍 {selectedVisit.addr}</p>
                      <button onClick={() => openRoute(selectedVisit)} className="w-full btn-pill btn-navy !py-2.5 text-[9px]">🧭 Buka Rute Google Maps</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ LAPORAN ============ */}
        {tab === 'laporan' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Laporan</h1><p className="label-mono mt-2">DETAIL LAPORAN KINERJAMU</p></div>
              <button className="btn-pill btn-ghost-dark">⬇ Unduh Laporan (PDF)</button>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="dash-item card-light col-span-12 lg:col-span-5 p-7">
                <h3 className="text-xl font-black mb-5">Kunjungan / Minggu</h3>
                <MiniBars data={[{ l: 'M1', v: 5 }, { l: 'M2', v: 7 }, { l: 'M3', v: 6 }, { l: 'M4', v: 5 }]} />
                <div className="mt-6">
                  <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>TOTAL KOMUNITAS TERCATAT</span><span>87%</span></div>
                  <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden"><div className="bar-h h-full rounded-full bg-[#e62b2b]" style={{ width: '87%' }} /></div>
                </div>
              </div>
              <div className="dash-item card-light col-span-12 lg:col-span-7 p-7">
                <h3 className="text-xl font-black mb-5">Daftar Komunitas Yang Telah Dicatat</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="border-b border-[#12283c]/15">{['KOMUNITAS', 'KUNJUNGAN', 'KEBUTUHAN', 'STATUS'].map((h, i) => <th key={i} className={`py-3 pr-4 label-mono ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-[#12283c]/10">
                      {ACCOMPANIED.map((a, i) => (
                        <tr key={i} className="hover:bg-[#12283c]/5 transition-colors">
                          <td className="py-4 pr-4 font-bold">{a.n}</td>
                          <td className="py-4 pr-4 text-xs opacity-70">{a.v}</td>
                          <td className="py-4 pr-4 text-xs opacity-70">{a.need}</td>
                          <td className="py-4 text-right">{chip(a.s === 'TERCATAT' ? 'green' : a.s === 'PROYEK BERJALAN' ? 'red' : 'navy', a.s)}</td>
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
    </DashShell>
  );
} 