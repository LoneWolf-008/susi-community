import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function RequestPage({ user, navigateTo }) {
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
      if (data[0] && mapInst.current) {
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
          <h1 className="req-item text-5xl md:text-6xl font-black tracking-tight mb-4">Pengaduan Dicatat!</h1>
          <p className="req-item text-sm opacity-60 leading-relaxed mb-10">Laporanmu sudah kami catat. Silahkan tunggu hingga Talenta mengajukan diri!</p>
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
          <button onClick={() => navigateTo('dashboard')} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← DASHBOARD</button>
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
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mt-1">Formulir Pengaduan</h1>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (coords) setSent(true); }} className="grid grid-cols-12 gap-6">
            {/* KIRI: FIELD */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
              <div className="req-item border-2 border-black bg-white p-7">
                <label className={lCls}>Judul Masalah</label>
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
                <label className={lCls}>Ceritakan Masalahmu</label>
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