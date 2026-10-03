import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DashShell from '../../components/common/DashShell';
import ProjSteps from '../../components/common/ProjSteps';
import AiAgent from '../../components/common/AiAgent';

const CHIP = { green: 'bg-[#c9ecd9] text-[#12283c]', navy: 'bg-[#12283c] text-[#f2efe6]', red: 'bg-[#e62b2b] text-white', ghost: 'bg-[#12283c]/10 text-[#12283c]/70' };
const chip = (k, t) => <span className={`chip-mono border-0 ${CHIP[k]}`}>{t}</span>;
const APP_CHIP = { MENUNGGU: 'ghost', DITERIMA: 'green', DITOLAK: 'navy' };

export default function DashboardTalent({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('jelajahi');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('SEMUA');
  const [appliedIds, setAppliedIds] = useState([11]);
  const [selectedNeed, setSelectedNeed] = useState(null);
  const [applyMsg, setApplyMsg] = useState('');
  const [histFilter, setHistFilter] = useState('SEMUA');
  const [agreeTarget, setAgreeTarget] = useState(null);
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
  const detailMapEl = useRef(null); const detailMapInst = useRef(null); const rootRef = useRef(null);

  const NEEDS = [
    { id: 10, t: 'Rekap Iuran Warga RW 05', comm: 'PKK RW 05', leader: 'Ibu Siti Aminah', m: 48, cat: 'PENCATATAN', sec: 'BARAT–UTARA', apps: 3, time: '2J', d: 'Iuran masih dicatat di buku tulis, sering hilang & susah direkap.', full: 'Setiap bulan pengurus PKK harus merekap iuran dari 48 kepala keluarga secara manual. Buku catatan sering tertukar atau hilang. Kami butuh cara sederhana supaya warga bisa cek iuran sendiri lewat HP.', addr: 'Balai RW 05, Kel. Sukajadi', lat: -6.8850, lng: 107.5750, skill: ['PENCATATAN', 'WEB SEDERHANA'] },
    { id: 11, t: 'Website Galeri Karang Taruna', comm: 'Karang Taruna Mekar', leader: 'Budi Santoso', m: 65, cat: 'WEBSITE', sec: 'TIMUR–SELATAN', apps: 5, time: '5J', d: 'Butuh tempat pamer kegiatan & foto biar warga makin terlibat.', full: 'Dokumentasi kegiatan pemuda menumpuk di folder WhatsApp dan tidak pernah dilihat lagi. Kami ingin website galeri sederhana supaya warga tahu kegiatan kami dan tertarik bergabung.', addr: 'Sekretariat KT Mekar, Jl. Mekar Sari', lat: -6.9350, lng: 107.6650, skill: ['WEBSITE', 'DESAIN'] },
    { id: 12, t: 'Aplikasi Inventaris PKK', comm: 'PKK RW 05', leader: 'Ibu Siti Aminah', m: 48, cat: 'APLIKASI', sec: 'BARAT–SELATAN', apps: 2, time: '1H', d: 'Data barang pinjaman warga berantakan di grup WhatsApp.', full: 'PKK punya barang pinjaman (tenda, kursi, sound system) yang sering dipinjam warga. Catatannya berantakan di grup WhatsApp, jadi sering ada barang yang tidak kembali.', addr: 'Rumah Ketua PKK, RW 05', lat: -6.9250, lng: 107.5850, skill: ['APLIKASI', 'PENCATATAN'] },
    { id: 13, t: 'Formulir Pendaftaran Digital', comm: 'Forum Warga Bandung', leader: 'Haji Rahmat', m: 54, cat: 'LAINNYA', sec: 'TIMUR–UTARA', apps: 1, time: '3J', d: 'Pendaftaran warga baru masih pakai kertas fotokopian.', full: 'Setiap ada warga baru, mereka harus mengisi kertas fotokopian yang sering salah tulis. Kami ingin formulir digital yang datanya langsung rapi tersimpan.', addr: 'Pos Warga, Jl. Warga Baru', lat: -6.8950, lng: 107.6550, skill: ['FORM DIGITAL'] },
  ];
  const TPROFILE = {
    bio: 'Fresh graduate teknik informatika yang ingin membangun portofolio nyata sambil membantu komunitas Bandung.',
    skills: ['React', 'Node.js', 'MySQL', 'Figma', 'Laravel'], reputasi: 12, target: 20, level: 'TALENTA MUDA', joinDate: 'JUN 2026', wa: '+62 812-****-4321',
    track: [
      { date: 'JUL 2026', t: 'Formulir Pendaftaran Digital', comm: 'Forum Warga Bandung', testi: '"Pengerjaan cepat, komunikasi jelas."' },
      { date: 'JUN 2026', t: 'Katalog UMKM', comm: 'Paguyuban Pedagang', testi: '"Sangat membantu, mudah dipakai anggota."' },
    ],
  };
  const NOTIF_META = { talenta: { c: '#e62b2b', l: 'LAMARAN' }, verifikasi: { c: '#c9ecd9', l: 'VERIFIKASI' }, diskusi: { c: '#12283c', l: 'DISKUSI' }, sistem: { c: '#9CA3AF', l: 'SISTEM' } };
  const NAV = [
    { id: 'jelajahi', n: '01', l: 'Lihat Proyek' }, { id: 'histori', n: '02', l: 'Histori' },
    { id: 'projek', n: '03', l: 'Proyek Saya' }, { id: 'profil', n: '04', l: 'Profil' },
  ];
  const first = (user?.name || 'Talenta').split(' ')[0];

  useEffect(() => {
    if (!selectedNeed || !detailMapEl.current || detailMapInst.current) return;
    const map = L.map(detailMapEl.current).setView([selectedNeed.lat, selectedNeed.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    L.marker([selectedNeed.lat, selectedNeed.lng], { icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;background:#e62b2b;border:2px solid #12283c;transform:rotate(45deg)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
    detailMapInst.current = map;
    return () => { map.remove(); detailMapInst.current = null; };
  }, [selectedNeed]);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => { const t = +el.dataset.target; const o = { val: 0 }; gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } }); });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selectedNeed]);

  const filteredNeeds = NEEDS.filter((n) => {
    const q = search.toLowerCase();
    return (!q || n.t.toLowerCase().includes(q) || n.comm.toLowerCase().includes(q) || n.d.toLowerCase().includes(q)) && (catFilter === 'SEMUA' || n.cat === catFilter);
  });
  const filteredHist = histFilter === 'SEMUA' ? applications : applications.filter((a) => a.status === histFilter);
  const submitApply = () => {
    if (!selectedNeed) return;
    setAppliedIds((a) => [...a, selectedNeed.id]);
    setApplications((a) => [{ id: Date.now(), t: selectedNeed.t, comm: selectedNeed.comm, date: 'HARI INI', status: 'MENUNGGU' }, ...a]);
    setApplyMsg('');
  };
  const setProjStatus = (id, status) => setProjects((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
  const onTab = (id) => { setTab(id); setSelectedNeed(null); };
  const shellNotifs = notifs.map((n) => ({ ...n, color: NOTIF_META[n.type]?.c, label: NOTIF_META[n.type]?.l }));

  return (
    <DashShell user={user} roleLabel="TALENTA" nav={NAV} tab={tab} onTab={onTab} notifs={shellNotifs} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {/* ============ JELAJAHI ============ */}
        {tab === 'jelajahi' && !selectedNeed && (
          <>
            <div className="dash-item card-light p-8 md:p-10 mb-6">
              <p className="label-mono mb-2">Katalog Kebutuhan</p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, {first}.</h1>
              <p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed mb-6">Klik "Ajukan Diri" untuk membaca detail masalah komunitas sebelum mengirim pengajuan.</p>
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-line mb-4" placeholder="Cari: judul, komunitas, atau masalah..." />
              <div className="flex flex-wrap gap-2">
                {['SEMUA', 'PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                  <button key={c} onClick={() => setCatFilter(c)} className={`chip-mono transition-colors ${catFilter === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
              {[{ t: NEEDS.length, l: 'KEBUTUHAN TERBUKA' }, { t: applications.length, l: 'PENGAJUAN TERKIRIM' }, { t: 2, l: 'PROJEK SELESAI' }].map((s, i) => (
                <div key={i} className="dash-item bg-[#fdfcf7] p-6 hover:bg-[#e62b2b] hover:text-white transition-colors">
                  <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div>
                  <p className="label-mono mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredNeeds.map((n) => (
                <div key={n.id} className="dash-item card-light relative p-6 pt-8 hover:-translate-y-1 hover:border-[#e62b2b] hover:shadow-[0_14px_35px_rgba(230,43,43,0.15)] transition-all">
                  <span className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-[#e62b2b] border-2 border-[#12283c] rotate-45" />
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="chip-mono">{n.cat}</span>
                    <span className="font-mono text-[9px] opacity-50">{n.time} · {n.apps} PELAMAR</span>
                  </div>
                  <h4 className="font-black text-lg leading-tight mb-1">{n.t}</h4>
                  <p className="text-xs text-[#12283c]/60 leading-relaxed mb-5">{n.d}</p>
                  <button onClick={() => setSelectedNeed(n)} className={`btn-pill w-full !py-3 text-[10px] ${appliedIds.includes(n.id) ? 'bg-[#c9ecd9] text-[#12283c]' : 'btn-navy'}`}>
                    {appliedIds.includes(n.id) ? '✓ Terkirim — Lihat Detail' : 'Ajukan Diri →'}
                  </button>
                </div>
              ))}
              {filteredNeeds.length === 0 && <p className="dash-item col-span-full card-light p-8 text-center font-mono text-xs opacity-50">TIDAK ADA HASIL UNTUK PENCARIAN INI.</p>}
            </div>
          </>
        )}
        {tab === 'jelajahi' && selectedNeed && (() => {
          const n = selectedNeed; const applied = appliedIds.includes(n.id);
          return (
            <>
              <div className="dash-item mb-6"><button onClick={() => setSelectedNeed(null)} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE DAFTAR</button></div>
              <div className="dash-item card-light p-8 md:p-10 mb-6">
                <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                  <span className="chip-mono">{n.cat}</span>
                  <span className="font-mono text-[9px] opacity-50">{n.time} LALU · {n.apps} PELAMAR</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-6">{n.t}</h1>
                <p className="label-mono !text-[#e62b2b] !opacity-100 mb-3">MASALAH YANG DIALAMI KOMUNITAS</p>
                <p className="text-sm md:text-base leading-relaxed text-[#12283c]/80 max-w-3xl mb-6">{n.full}</p>
                <div className="flex flex-wrap gap-2">{n.skill.map((s) => <span key={s} className="chip-mono">{s}</span>)}</div>
              </div>
              <div className="grid grid-cols-12 gap-6 mb-6">
                <div className="col-span-12 lg:col-span-5">
                  <div className="dash-item rounded-xl bg-[#12283c] text-[#f2efe6] p-7 h-full">
                    <p className="label-mono !text-[#e62b2b] !opacity-100 mb-4">KOMUNITAS PENGADU</p>
                    <div className="w-16 h-16 rounded-2xl bg-[#e62b2b] flex items-center justify-center text-2xl font-black mb-4">{n.comm.charAt(0)}</div>
                    <h3 className="text-2xl font-black leading-tight">{n.comm}</h3>
                    <p className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">KETUA: {n.leader}</p>
                    <div className="mt-5 pt-5 border-t border-white/15 font-mono text-xs opacity-70"><p>{n.m} ANGGOTA</p></div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-7">
                  <div className="dash-item card-light p-7 h-full">
                    <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
                      <p className="label-mono">LOKASI KOMUNITAS</p>
                      <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{n.lat.toFixed(3)}, {n.lng.toFixed(3)}</span>
                    </div>
                    <div className="relative z-0 rounded-xl border border-[#12283c]/15 h-[240px] overflow-hidden"><div ref={detailMapEl} className="w-full h-full" /></div>
                    <p className="font-mono text-[10px] opacity-60 mt-3">📍 {n.addr} · SEKTOR {n.sec}</p>
                  </div>
                </div>
              </div>
              <div className="dash-item card-light p-7">
                {applied ? (
                  <div className="text-center py-6">
                    <div className="inline-flex w-16 h-16 rounded-full bg-[#c9ecd9] text-[#12283c] items-center justify-center text-3xl font-black mb-4">✓</div>
                    <h3 className="text-xl font-black mb-1">PENGAJUAN TERKIRIM</h3>
                    <p className="text-xs text-[#12283c]/60 mb-5">Menunggu respon dari {n.comm}. Pantau statusnya di Histori Pengajuan.</p>
                    <button onClick={() => setTab('histori')} className="btn-pill btn-ghost-dark !py-3 text-[10px]">LIHAT HISTORI →</button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-black mb-4">Ajukan Diri untuk Proyek Ini</h3>
                    <label className="field-label">Pesan Pengantar</label>
                    <textarea value={applyMsg} onChange={(e) => setApplyMsg(e.target.value)} className="input-line h-28 resize-none mb-4" placeholder="Jelaskan kenapa Anda cocok & bagaimana pendekatan Anda..." />
                    <button onClick={submitApply} className="btn-pill btn-red w-full">KIRIM PENGAJUAN →</button>
                  </>
                )}
              </div>
            </>
          );
        })()}

        {/* ============ HISTORI ============ */}
        {tab === 'histori' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Histori Pengajuan</h1><p className="label-mono mt-2">SEMUA PENGAJUAN YANG PERNAH ANDA KIRIM</p></div>
              <div className="flex flex-wrap gap-2">
                {['SEMUA', 'MENUNGGU', 'DITERIMA', 'DITOLAK'].map((s) => (
                  <button key={s} onClick={() => setHistFilter(s)} className={`chip-mono transition-colors ${histFilter === s ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="dash-item card-light p-7">
              <div className="space-y-0">
                {filteredHist.map((a) => (
                  <div key={a.id} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
                    <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-[#12283c] ${a.status === 'DITERIMA' ? 'bg-[#c9ecd9]' : a.status === 'MENUNGGU' ? 'bg-[#fdfcf7]' : 'bg-[#12283c]'}`} />
                    <div className="flex items-center gap-3 flex-wrap mb-2"><span className="font-mono text-[10px] font-bold">{a.date}</span>{chip(APP_CHIP[a.status], a.status)}</div>
                    <h4 className="font-black text-base mb-1">{a.t}</h4>
                    <p className="font-mono text-[10px] opacity-50">{a.comm}</p>
                    {a.status === 'DITERIMA' && <button onClick={() => setTab('projek')} className="chip-mono mt-2 text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white transition-colors">LIHAT DI PROYEK SAYA →</button>}
                  </div>
                ))}
                {filteredHist.length === 0 && <p className="text-center font-mono text-xs opacity-50 py-6">BELUM ADA PENGADUAN DENGAN STATUS INI.</p>}
              </div>
            </div>
          </>
        )}

        {/* ============ PROYEK SAYA ============ */}
        {tab === 'projek' && (
          <>
            <div className="dash-item mb-6"><h1 className="text-4xl md:text-5xl font-black tracking-tight">Proyek Saya</h1><p className="label-mono mt-2">DAFTAR PROYEK YANG DIKERJAKAN</p></div>
            <div className="space-y-6">
              {projects.map((p) => (
                <div key={p.id} className="dash-item card-light p-7">
                  <div className="flex justify-between items-start flex-wrap gap-3 mb-5">
                    <div><h3 className="text-2xl font-black leading-tight">{p.t}</h3><p className="font-mono text-[10px] opacity-50 mt-1">{p.comm} · DEADLINE {p.deadline}</p></div>
                    {p.status === 'VERIFIKASI' && chip('ghost', 'MENUNGGU VERIFIKASI')}
                    {p.status === 'PROSES' && chip('navy', 'SEDANG DIKERJAKAN')}
                    {p.status === 'KESEPAKATAN' && chip('red', 'BUTUH AKSI')}
                  </div>
                  <div className="grid grid-cols-12 gap-6 items-start">
                    <div className="col-span-12 lg:col-span-7"><p className="field-label">Target Proyek</p><p className="text-sm text-[#12283c]/70 leading-relaxed">{p.scope}</p></div>
                    <div className="col-span-12 lg:col-span-5">
                      <ProjSteps status={p.status} />
                      <div className="mt-4">
                        {p.status === 'KESEPAKATAN' && <button onClick={() => setAgreeTarget(p)} className="btn-pill btn-red w-full !py-3 text-[10px]">Lihat Kesepakatan & Setuju →</button>}
                        {p.status === 'PROSES' && <button onClick={() => setProjStatus(p.id, 'VERIFIKASI')} className="btn-pill btn-navy w-full !py-3 text-[10px]">Tandai Selesai →</button>}
                        {p.status === 'VERIFIKASI' && <p className="w-full text-center rounded-full border border-[#12283c]/20 py-3 font-mono text-[10px] font-bold opacity-60">PROYEK DIKIRIM! TUNGGU VERIFIKASI KOMUNITAS.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ PROFIL ============ */}
        {tab === 'profil' && (
          <>
            <div className="dash-item rounded-2xl bg-[#12283c] text-[#f2efe6] p-8 md:p-10 mb-6 relative overflow-hidden">
              <div className="grid grid-cols-12 gap-6 relative z-10">
                <div className="col-span-12 md:col-span-4 flex flex-col items-center md:items-start gap-4">
                  <div className="w-28 h-28 rounded-2xl bg-[#e62b2b] flex items-center justify-center text-5xl font-black">{user?.name?.charAt(0).toUpperCase()}</div>
                  <div><h2 className="text-2xl font-black">{user?.name}</h2><p className="font-mono text-[10px] text-[#e62b2b] font-bold mt-1">TALENTA · {TPROFILE.level}</p><p className="font-mono text-[10px] opacity-50 mt-2">BERGABUNG {TPROFILE.joinDate}</p></div>
                </div>
                <div className="col-span-12 md:col-span-8">
                  <p className="text-sm leading-relaxed opacity-80 mb-6">{TPROFILE.bio}</p>
                  <div className="grid grid-cols-3 gap-px bg-white/10 rounded-xl overflow-hidden">
                    {[{ v: TPROFILE.reputasi, l: 'POIN REPUTASI' }, { v: applications.length, l: 'MENUNGGU VERIFIKASI' }, { v: 2, l: 'PROYEK SELESAI' }].map((s, i) => (
                      <div key={i} className="bg-[#12283c] p-4"><div className="text-3xl font-black tabular-nums text-[#e62b2b]">{s.v}</div><p className="label-mono mt-1">{s.l}</p></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-5 space-y-6">
                <div className="dash-item card-light p-7">
                  <span className="label-mono !text-[#e62b2b] !opacity-100">DATA PRIBADI</span>
                  <h3 className="text-xl font-black mt-1 mb-5">Informasi Talenta</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-[#12283c]/10 pb-2"><span className="label-mono">EMAIL</span><span className="font-bold">{user?.name?.toLowerCase().replace(' ', '.')}@susi.id</span></div>
                    <div className="flex justify-between border-b border-[#12283c]/10 pb-2"><span className="label-mono">WHATSAPP</span><span className="font-bold">{TPROFILE.wa}</span></div>
                  </div>
                  <p className="field-label mt-6 mb-3">Keahlian</p>
                  <div className="flex flex-wrap gap-2">{TPROFILE.skills.map((s) => <span key={s} className="chip-mono hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors cursor-default">{s}</span>)}</div>
                </div>
                <div className="dash-item card-light p-7">
                  <span className="label-mono !text-[#e62b2b] !opacity-100">PROGRESS LEVEL</span>
                  <h3 className="text-xl font-black mt-1 mb-5">Menuju Level Berikutnya</h3>
                  <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>{TPROFILE.level}</span><span>{TPROFILE.reputasi} / {TPROFILE.target}</span></div>
                  <div className="h-3 rounded-full bg-[#12283c]/10 overflow-hidden"><div className="h-full rounded-full bg-[#e62b2b]" style={{ width: `${(TPROFILE.reputasi / TPROFILE.target) * 100}%` }} /></div>
                  <p className="font-mono text-[10px] opacity-50 mt-3">{TPROFILE.target - TPROFILE.reputasi} PROYEK TERVERIFIKASI LAGI MENUJU "TALENTA TERPERCAYA".</p>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-7">
                <div className="dash-item rounded-xl bg-[#c9ecd9] text-[#12283c] p-7">
                  <h3 className="text-xl font-black mb-5">Projek Terverifikasi</h3>
                  <div className="space-y-5">
                    {TPROFILE.track.map((t, i) => (
                      <div key={i} className="border-b-2 border-[#12283c]/15 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 flex-wrap mb-2"><span className="font-mono text-[10px] font-bold">{t.date}</span><span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">✓ SELESAI</span></div>
                        <h4 className="font-black text-base mb-1">{t.t}</h4>
                        <p className="font-mono text-[10px] opacity-70 mb-2">{t.comm}</p>
                        <p className="text-sm italic leading-relaxed">{t.testi}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ MODAL KESEPAKATAN ============ */}
        {agreeTarget && (
          <div className="fixed inset-0 z-[500] bg-[#0e2233]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12283c] text-[#f2efe6] w-full max-w-xl border border-white/10 rounded-2xl p-8 relative">
              <button onClick={() => setAgreeTarget(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl font-black hover:bg-[#e62b2b] hover:border-[#e62b2b]">×</button>
              <h3 className="text-2xl font-black mt-2 mb-5">{agreeTarget.t}</h3>
              <div className="space-y-3 mb-6">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4"><p className="label-mono mb-1">TARGET PROYEK</p><p className="text-sm">{agreeTarget.scope}</p></div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4"><p className="label-mono mb-1">DEADLINE</p><p className="text-sm">Sebelum 15 Oktober</p></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAgreeTarget(null)} className="flex-1 btn-pill btn-ghost-light !py-3 text-[10px]">Nanti Dulu</button>
                <button onClick={() => { setProjStatus(agreeTarget.id, 'PROSES'); setAgreeTarget(null); }} className="flex-1 btn-pill btn-red !py-3 text-[10px]">Setuju & Mulai →</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AiAgent role='talent' />
    </DashShell>
  );
}