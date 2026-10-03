import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function RequestPage({ user, navigateTo }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);
  const rootRef = useRef(null);
  const [addr, setAddr] = useState('');
  const [coords, setCoords] = useState(null);
  const [cat, setCat] = useState('PENCATATAN');
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState(false);
  const BDG = { lat: -6.9175, lng: 107.6191 };
  const pinIcon = L.divIcon({ className: '', html: '<div style="width:18px;height:18px;background:#e62b2b;border:2px solid #12283c;transform:rotate(45deg)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
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
      gsap.fromTo('.req-item', { y: 25, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [sent]);
  const searchAddress = async () => {
    if (!addr.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr + ', Kota Bandung')}`);
      const data = await res.json();
      if (data && data[0] && mapInst.current) {
        const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
        placeMarker(lat, lng); mapInst.current.setView([lat, lng], 15);
      }
    } catch (_) {}
    setSearching(false);
  };
  const quadrant = coords ? `${coords.lng < BDG.lng ? 'BARAT' : 'TIMUR'}–${coords.lat > BDG.lat ? 'UTARA' : 'SELATAN'}` : '—';
  if (sent) {
    return (
      <div ref={rootRef} className="min-h-screen bg-[#f2efe6] text-[#12283c] flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <div className="req-item inline-flex w-24 h-24 rounded-full bg-[#c9ecd9] items-center justify-center text-5xl font-black mb-8">✓</div>
          <h1 className="req-item text-5xl md:text-6xl font-black tracking-tight mb-4">Pengaduan Dicatat!</h1>
          <p className="req-item text-sm text-[#12283c]/60 leading-relaxed mb-10">Laporanmu sudah kami catat. Silahkan tunggu hingga Talenta mengajukan diri!</p>
          <button onClick={() => navigateTo('dashboard')} className="req-item btn-pill btn-navy">Kembali ke Dasbor →</button>
        </div>
      </div>
    );
  }
  return (
    <div ref={rootRef} className="min-h-screen bg-[#f2efe6] text-[#12283c]">
      <div className="fixed top-0 left-0 right-0 h-16 bg-[#f2efe6]/90 backdrop-blur-md border-b border-[#12283c]/10 z-50">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('dashboard')} className="chip-mono hover:text-[#e62b2b] transition-colors">← DASHBOARD</button>
          <span className="font-black tracking-tight text-lg">SUSI <span className="text-[#e62b2b]">Community.</span></span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-full bg-white/70 border border-[#12283c]/15 pl-1 pr-4 py-1">
            <span className="w-7 h-7 rounded-full bg-[#e62b2b] text-white text-[10px] font-black flex items-center justify-center">{user?.name?.charAt(0).toUpperCase()}</span>
            <span className="text-xs font-bold hidden sm:block">{(user?.name || '').split(' ')[0]}</span>
          </div>
        </div>
      </div>
      <main className="pt-28 pb-20 px-5 lg:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="req-item mb-8">
            <p className="label-mono mb-2">Formulir</p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight">Ajukan Pengaduan<span className="text-[#e62b2b]">.</span></h1>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (coords) setSent(true); }} className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-5 space-y-6">
              <div className="req-item card-light p-7">
                <label className="field-label">Judul Masalah</label>
                <input required className="input-line" placeholder="Mis. Rekap iuran warga masih pakai buku tulis" />
              </div>
              <div className="req-item card-light p-7">
                <label className="field-label">Kategori</label>
                <div className="flex flex-wrap gap-2">
                  {['PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                    <button type="button" key={c} onClick={() => setCat(c)} className={`rounded-full px-4 py-2 font-mono text-[10px] font-bold border transition-colors ${cat === c ? 'bg-[#e62b2b] text-white border-[#e62b2b]' : 'border-[#12283c]/25 hover:border-[#12283c]'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="req-item card-light p-7">
                <label className="field-label">Ceritakan Masalahmu</label>
                <textarea required className="input-line h-32 resize-none" placeholder="Contoh: data iuran sering hilang, susah direkap tiap bulan..." />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="req-item card-light p-7">
                <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
                  <label className="field-label !mb-0">Posisi Lokasi · Klik Map atau Cari Alamat</label>
                  <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)} · ${quadrant}` : 'BELUM ADA TITIK'}</span>
                </div>
                <div className="flex gap-2 mb-4">
                  <input value={addr} onChange={(e) => setAddr(e.target.value)} className="input-line" placeholder="Ketik alamat: Mis. Jl. Ambon No.11, Bandung" />
                  <button type="button" onClick={searchAddress} className="btn-pill btn-navy !px-6 !py-3 text-[10px] shrink-0">{searching ? '...' : 'Cari →'}</button>
                </div>
                <div className="rounded-xl overflow-hidden border border-[#12283c]/15 h-[380px] md:h-[440px] relative z-0">
                  <div ref={mapRef} className="w-full h-full" />
                </div>
                <p className="font-mono text-[10px] opacity-50 mt-3 leading-relaxed">KLIK MAP UNTUK MENARUH PENANDA · PENANDA WAJIK MERAH = LOKASI PENGADUAN · DATA © OPENSTREETMAP</p>
              </div>
              <div className="req-item flex gap-3 mt-6">
                <button type="button" onClick={() => navigateTo('dashboard')} className="flex-1 btn-pill btn-ghost-dark">Batal</button>
                <button type="submit" disabled={!coords} className={`flex-1 btn-pill ${coords ? 'btn-red' : 'bg-[#12283c]/15 text-[#12283c]/40 cursor-not-allowed'}`}>
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