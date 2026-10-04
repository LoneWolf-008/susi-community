import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import MiniBars from '../../components/common/MiniBars';
import ActivityFeed from '../../components/common/ActivityFeed';

const CHIP = { green: 'bg-[#c9ecd9] text-[#12283c]', navy: 'bg-[#12283c] text-[#f2efe6]', red: 'bg-[#e62b2b] text-white', ghost: 'bg-[#12283c]/10 text-[#12283c]/70' };
const chip = (k, t) => <span className={`chip-mono border-0 ${CHIP[k]}`}>{t}</span>;
const MOD_CHIP = { KEBUTUHAN: 'red', TALENTA: 'navy', TESTIMONI: 'green', PENGADUAN: 'red' };
const CASE_CHIP = { MEDIASI: 'ghost', ESKALASI: 'navy', SELESAI: 'green' };
const RISK_CHIP = { RENDAH: 'green', SEDANG: 'ghost', TINGGI: 'red' };

export default function DashboardAdmin({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('ringkasan');
  const [modFilter, setModFilter] = useState('SEMUA');
  const [modStats, setModStats] = useState({ approve: 12, reject: 2 });
  const [queue, setQueue] = useState([
    { id: 1, type: 'PENGADUAN', t: 'Aplikasi Absensi Pemuda', by: 'Karang Taruna Mekar', date: 'HARI INI', d: 'Butuh form absensi kegiatan pemuda via HP, biar tidak rekap manual.', full: 'Absensi kegiatan pemuda masih kertas fotokopian. Butuh form via HP + rekap otomatis bulanan supaya laporan ke kelurahan tidak manual lagi.', src: 'MANDIRI', risk: 'RENDAH' },
    { id: 2, type: 'TALENTA', t: 'Pendaftaran: Salsabila R.', by: 'Career switcher', date: 'HARI INI', d: 'Klaim skill React + Firebase, portofolio 2 proyek pribadi.', full: 'Klaim skill React + Firebase dengan 2 proyek pribadi. Perlu verifikasi skill sebelum disetujui sebagai talenta.', src: 'AgenSUSI', risk: 'SEDANG' },
    { id: 3, type: 'TESTIMONI', t: 'Testimoni untuk Ezra P.', by: 'PKK RW 05', date: 'KEMARIN', d: '"Pengerjaan rapi dan sabar mengajarkan pengurus."', full: 'Testimoni pasca verifikasi Website Profil PKK. Bahasa wajar, tanpa klaim berlebihan — layak tampil di profil publik.', src: 'AgenSUSI', risk: 'RENDAH' },
    { id: 4, type: 'KEBUTUHAN', t: 'Website Katalog UMKM', by: 'Paguyuban Pedagang', date: 'KEMARIN', d: 'Katalog produk 54 pedagang agar bisa dilihat online.', full: '54 pedagang ingin produk terlihat online. Potensi duplikat dengan pengaduan Paguyuban Pasar — cek sebelum setujui.', src: 'MANDIRI', risk: 'TINGGI' },
  ]);
  const [cases, setCases] = useState([
    { id: 1, t: 'Sistem Inventaris PKK', comm: 'PKK RW 05', talent: 'Derien A.', days: 6, status: 'MEDIASI', note: 'Komunitas belum konfirmasi 6 hari setelah talenta menandai selesai.', statComm: 'Fitur sudah jadi, tapi pengurus belum sempat uji coba karena arisan bulanan. Minta waktu seminggu lagi.', statTalent: 'Proyek sudah selesai sesuai kesepakatan namun komunitas belum verifikasi.', timeline: [{ d: '01 AGU', e: 'Kesepakatan proyek dibuat' }, { d: '10 AGU', e: 'Talenta menandai SELESAI' }, { d: '16 AGU', e: 'Talenta: 6 hari tidak ada konfirmasi.' }] },
    { id: 2, t: 'Website Galeri', comm: 'KT Mekar', talent: 'Ezra P.', days: 12, status: 'ESKALASI', note: 'Komunitas mengklaim hasil belum sesuai kesepakatan.', statComm: 'Halaman galeri baru 5 foto; kesepakatan awal 20 halaman kegiatan + form upload mandiri.', statTalent: 'Form upload butuh akses server yang belum diserahkan komunitas. Ini di luar kesepakatan.', timeline: [{ d: '20 JUL', e: 'Kesepakatan proyek dibuat' }, { d: '05 AGU', e: 'Talenta menandai SELESAI' }, { d: '07 AGU', e: 'Komunitas menolak, hasil tidak sesuai' }, { d: '09 AGU', e: 'Pengaduan ke admin' }] },
  ]);
  const [liaisons, setLiaisons] = useState([
    { id: 1, n: 'Hasby Wira Al Muflih', visits: 23, assisted: 19, status: 'AKTIF', last: 'HARI INI · PKK RW 03 Cijerah', history: [{ d: 'HARI INI', c: 'PKK RW 03 Cijerah', s: 'BERLANGSUNG' }, { d: 'KEMARIN', c: 'Paguyuban Pedagang Pasar', s: 'TERDATA' }, { d: '14 AGU', c: 'Posyandu Melati', s: 'DIRENCANAKAN' }] },
    { id: 2, n: 'Tim Lapangan 02', visits: 15, assisted: 12, status: 'AKTIF', last: 'KEMARIN · Posyandu Melati', history: [{ d: 'KEMARIN', c: 'Posyandu Melati', s: 'BERLANGSUNG' }, { d: '12 AGU', c: 'Karang Taruna Cibuntu', s: 'TERDATA' }] },
  ]);
  const [liaisonDetail, setLiaisonDetail] = useState(null);
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
  const [notifs] = useState([
    { id: 1, type: 'moderasi', title: '4 item menunggu moderasi', sub: '2 kebutuhan · 1 talenta · 1 testimoni', read: false },
    { id: 2, type: 'sengketa', title: 'Sengketa dieskalasi', sub: 'Website Galeri · KT Mekar × Ezra P.', read: false },
    { id: 3, type: 'sistem', title: 'Backup harian berhasil', sub: 'Database · 03.00 WIB', read: true },
  ]);
  const rootRef = useRef(null);
  const NOTIF_META = { moderasi: { c: '#e62b2b', l: 'MODERASI' }, sengketa: { c: '#12283c', l: 'SENGKETA' }, sistem: { c: '#9CA3AF', l: 'SISTEM' } };
  const NAV = [
    { id: 'ringkasan', n: '01', l: 'Ringkasan' }, { id: 'moderasi', n: '02', l: 'Kelola Pengaduan' },
    { id: 'sengketa', n: '03', l: 'Keluhan' }, { id: 'pengguna', n: '04', l: 'Pengguna' }, { id: 'liaison', n: '05', l: 'AgenSUSI' },
  ];
  const first = (user?.name || 'Admin').split(' ')[0];
  const filteredQueue = modFilter === 'SEMUA' ? queue : queue.filter((q) => q.type === modFilter);
  const filteredUsers = userFilter === 'SEMUA' ? users : users.filter((u) => u.role === userFilter);
  const openCases = cases.filter((c) => c.status !== 'SELESAI').length;
  const toggleCheck = (id, key) => setChecks((c) => ({ ...c, [id]: { ...(c[id] || {}), [key]: !(c[id] || {})[key] } }));
  const approveItem = (id) => { setQueue((q) => q.filter((x) => x.id !== id)); setModStats((m) => ({ ...m, approve: m.approve + 1 })); setModDetail(null); setRejectId(null); };
  const rejectItem = (id) => { setQueue((q) => q.filter((x) => x.id !== id)); setModStats((m) => ({ ...m, reject: m.reject + 1 })); setModDetail(null); setRejectId(null); };
  const sendMsg = (key) => { setSentMsgs((s) => ({ ...s, [key]: true })); setMsgTarget(null); setMsgText(''); };
  const resolveCase = (id, decision) => { setCases((cs) => cs.map((c) => (c.id === id ? { ...c, status: decision === 'perpanjang' ? 'MEDIASI' : 'SELESAI', days: decision === 'perpanjang' ? 0 : c.days } : c))); setResolveTarget(null); };
  const toggleSuspend = (id) => setUsers((u) => u.map((x) => (x.id === id ? { ...x, status: x.status === 'AKTIF' ? 'DITANGGUHKAN' : 'AKTIF' } : x)));
  const toggleLiaison = (id) => setLiaisons((ls) => ls.map((l) => (l.id === id ? { ...l, status: l.status === 'AKTIF' ? 'DITANGGUHKAN' : 'AKTIF' } : l)));
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => { const t = +el.dataset.target; const o = { val: 0 }; gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } }); });
      gsap.fromTo('.bar-h', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', transformOrigin: 'left center', delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, [tab]);
  const shellNotifs = notifs.map((n) => ({ ...n, color: NOTIF_META[n.type]?.c, label: NOTIF_META[n.type]?.l }));

  return (
    <DashShell user={user} roleLabel="ADMIN" nav={NAV} tab={tab} onTab={setTab} notifs={shellNotifs} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {/* ============ RINGKASAN ============ */}
        {tab === 'ringkasan' && (
          <>
            <div className="dash-item card-light p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
              <div><p className="label-mono mb-2">Pusat Kendali</p><h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, {first}.</h1><p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed">Selamat datang kembali, kelola SUSI dari sini.</p></div>
              <div className="flex items-center gap-2 rounded-full bg-[#c9ecd9] px-5 py-3"><span className="w-2 h-2 bg-[#12283c] animate-pulse rotate-45" /><span className="font-mono text-[10px] font-black text-[#12283c]">SEMUA SISTEM NORMAL</span></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
              {[{ t: 181, l: 'PENGGUNA AKTIF' }, { t: 20, l: 'DALAM ANTRIAN' }, { t: 8, l: 'PROJEK BERJALAN' }, { t: 127, l: 'SELESAI TERVERIFIKASI' }, { t: queue.length, l: 'ANTREAN MODERASI' }, { t: openCases, l: 'SENGKETA TERBUKA' }].map((s, i) => (
                <div key={i} className="dash-item bg-[#fdfcf7] p-6 hover:bg-[#e62b2b] hover:text-white transition-colors">
                  <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div>
                  <p className="label-mono mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="dash-item card-light col-span-12 lg:col-span-5 p-7"><h3 className="text-xl font-black mb-5">Laporan Mingguan</h3><MiniBars data={[{ l: 'M1', v: 9 }, { l: 'M2', v: 12 }, { l: 'M3', v: 8 }, { l: 'M4', v: 14 }, { l: 'M5', v: 11 }, { l: 'M6', v: 16 }]} /><p className="label-mono mt-4">KUNJUNGAN WEBSITE PER PERIODE</p></div>
              <div className="dash-item card-light col-span-12 lg:col-span-4 p-7">
                <h3 className="text-xl font-black mb-5">Aktivitas Peran</h3>
                <div className="space-y-4">
                  {[{ l: 'KOMUNITAS', v: 45 }, { l: 'TALENTA', v: 40 }, { l: 'LIAISON', v: 10 }, { l: 'ADMIN', v: 5 }].map((s, i) => (
                    <div key={i}>
                      <div className="flex justify-between font-mono text-[10px] font-bold mb-1.5"><span>{s.l}</span><span>{s.v}%</span></div>
                      <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden"><div className="bar-h h-full rounded-full bg-[#12283c]" style={{ width: `${s.v}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dash-item card-light col-span-12 lg:col-span-3 p-7">
                <h3 className="text-xl font-black mb-5">Status Sistem</h3>
                <div className="space-y-3">
                  {[['API', 'OK'], ['DATABASE', 'OK'], ['MAP TILES', 'OK'], ['NOTIFIKASI', 'OK']].map(([l, s]) => (
                    <div key={l} className="flex items-center justify-between rounded-lg border border-[#12283c]/15 px-3 py-2">
                      <span className="font-mono text-[10px] font-bold">{l}</span>
                      <span className="flex items-center gap-1.5 font-mono text-[9px] font-black text-[#12283c]"><span className="w-2 h-2 bg-[#e62b2b] animate-pulse rotate-45" />{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dash-item card-light col-span-12 lg:col-span-7 p-7">
                <h3 className="text-xl font-black mb-4">Aktivitas Platform</h3>
                <ActivityFeed items={[
                  { c: 'bg-[#e62b2b]', t: 'Pengaduan baru masuk moderasi', s: 'Website Katalog UMKM · Paguyuban Pedagang', time: '2J' },
                  { c: 'bg-[#12283c]', t: 'Sengketa dieskalasi', s: 'Website Galeri · KT Mekar × Ezra P.', time: '5J' },
                  { c: 'bg-[#c9ecd9]', t: 'Verifikasi dua arah selesai', s: 'Galeri Foto · reputasi +1', time: '1H' },
                  { c: 'bg-[#12283c]', t: 'Talenta baru mendaftar', s: 'Salsabila R. · menunggu moderasi', time: '3H' },
                ]} />
              </div>
              <div className="dash-item rounded-xl col-span-12 lg:col-span-5 bg-[#12283c] text-[#f2efe6] p-7">
                <h3 className="text-xl font-black mt-1 mb-5">Talenta Teratas</h3>
                <div className="space-y-4">
                  {[{ n: 'Derien A.', v: 12 }, { n: 'Ezra P.', v: 9 }, { n: 'Khalifa H.', v: 7 }].map((l, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-2xl font-black text-[#e62b2b]">0{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs font-bold mb-1"><span>{l.n}</span><span className="font-mono">{l.v} PROYEK</span></div>
                        <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="bar-h h-full rounded-full bg-[#e62b2b]" style={{ width: `${(l.v / 12) * 100}%` }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ MODERASI ============ */}
        {tab === 'moderasi' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Moderasi</h1><p className="label-mono mt-2">KELOLA DAN SETUJUI PENGADUAN KOMUNITAS</p></div>
              <div className="flex flex-wrap gap-2">
                {['SEMUA', 'KEBUTUHAN', 'TALENTA', 'TESTIMONI'].map((t) => (
                  <button key={t} onClick={() => setModFilter(t)} className={`chip-mono transition-colors ${modFilter === t ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
              {[{ t: filteredQueue.length, l: 'MENUNGGU REVIEW' }, { t: modStats.approve, l: 'DISETUJUI' }, { t: modStats.reject, l: 'DITOLAK' }].map((s, i) => (
                <div key={i} className="dash-item bg-[#fdfcf7] p-6"><div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div><p className="label-mono mt-1">{s.l}</p></div>
              ))}
            </div>
            <div className="space-y-4">
              {filteredQueue.map((q) => {
                const open = modDetail === q.id; const ck = checks[q.id] || {}; const ready = ck.layak && ck.kategori;
                return (
                  <div key={q.id} className={`dash-item card-light transition-all ${open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''}`}>
                    <button onClick={() => { setModDetail(open ? null : q.id); setRejectId(null); }} className="w-full p-6 text-left flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">{chip(MOD_CHIP[q.type], q.type)}<span className="font-mono text-[9px] opacity-50">{q.date}</span>{chip(RISK_CHIP[q.risk], q.risk)}</div>
                        <h4 className="font-black text-lg mb-1">{q.t}</h4>
                        <p className="label-mono">PETUGAS · {q.by}</p>
                      </div>
                      <span className={`text-[10px] font-black shrink-0 transition-transform ${open ? 'rotate-90 text-[#e62b2b]' : ''}`}>→</span>
                    </button>
                    {open && (
                      <div className="px-6 pb-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-[#12283c]/15 p-4"><p className="label-mono mb-2">DESKRIPSI PROYEK</p><p className="text-sm text-[#12283c]/80 leading-relaxed">{q.full}</p></div>
                          <div className="rounded-xl border border-[#12283c]/15 p-4 space-y-2"><p className="label-mono">DETAIL PENGAJUAN</p><div className="flex justify-between font-mono text-[10px]"><span>SUMBER</span><span className="font-bold">{q.src}</span></div><div className="flex justify-between font-mono text-[10px]"><span>TIPE</span><span className="font-bold">{q.type}</span></div></div>
                        </div>
                        <div>
                          <p className="label-mono mb-2">CHECKLIST REVIEW — WAJIB SEBELUM SETUJUI</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <button onClick={() => toggleCheck(q.id, 'layak')} className={`rounded-xl p-3 border text-left text-[10px] font-bold transition-colors ${ck.layak ? 'bg-[#c9ecd9] border-[#12283c] text-[#12283c]' : 'border-[#12283c]/20 hover:border-[#12283c]'}`}>{ck.layak ? '✓' : '○'} Konten layak & bukan spam</button>
                            <button onClick={() => toggleCheck(q.id, 'kategori')} className={`rounded-xl p-3 border text-left text-[10px] font-bold transition-colors ${ck.kategori ? 'bg-[#c9ecd9] border-[#12283c] text-[#12283c]' : 'border-[#12283c]/20 hover:border-[#12283c]'}`}>{ck.kategori ? '✓' : '○'} Kategori sesuai</button>
                          </div>
                        </div>
                        {rejectId === q.id ? (
                          <div className="rounded-xl border-2 border-[#e62b2b] p-4 space-y-3">
                            <p className="label-mono !text-[#e62b2b] !opacity-100">ALASAN PENOLAKAN (WAJIB PILIH)</p>
                            <div className="flex flex-wrap gap-2">
                              {['SPAM', 'DUPLIKAT', 'SALAH KATEGORI', 'TIDAK LAYAK'].map((r) => (
                                <button key={r} onClick={() => setRejectReason(r)} className={`chip-mono transition-colors ${rejectReason === r ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c]'}`}>{r}</button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => rejectItem(q.id)} className="flex-1 btn-pill btn-red !py-2.5 text-[9px]">Konfirmasi Tolak ({rejectReason})</button>
                              <button onClick={() => setRejectId(null)} className="flex-1 btn-pill btn-ghost-dark !py-2.5 text-[9px]">Batal</button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-3 flex-wrap">
                              <button onClick={() => approveItem(q.id)} disabled={!ready} className={`flex-1 btn-pill ${ready ? 'bg-[#c9ecd9] text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6]' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}>✓ Setujui</button>
                              <button onClick={() => setRejectId(q.id)} className="flex-1 btn-pill btn-ghost-dark hover:!bg-[#e62b2b] hover:!text-white hover:!border-[#e62b2b]">Tolak</button>
                            </div>
                            {!ready && <p className="font-mono text-[9px] opacity-50">CENTANG KEDUA CHECKLIST UNTUK MENGAKTIFKAN TOMBOL SETUJUI.</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredQueue.length === 0 && (
                <div className="dash-item card-light p-10 text-center"><p className="text-3xl font-black mb-2">✓</p><p className="font-mono text-xs opacity-50">ANTREAN KOSONG — SEMUA SUDAH DIMODERASI.</p></div>
              )}
            </div>
          </>
        )}

        {/* ============ SENGKETA ============ */}
        {tab === 'sengketa' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Keluhan</h1><p className="label-mono mt-2">VERIFIKASI DAN PELAYANAN KELUHAN</p></div>
              <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{openCases} DALAM ANTRIAN</span>
            </div>
            <div className="space-y-4">
              {cases.map((c) => {
                const open = caseDetail === c.id;
                return (
                  <div key={c.id} className={`dash-item card-light p-6 transition-all ${c.status === 'SELESAI' ? 'opacity-60' : open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''}`}>
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
                      <h4 className="font-black text-lg">{c.t}</h4>
                      <div className="flex items-center gap-2">
                        {chip(CASE_CHIP[c.status], c.status)}
                        {c.status !== 'SELESAI' && <button onClick={() => setCaseDetail(open ? null : c.id)} className="chip-mono hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors">{open ? 'TUTUP ▴' : 'DETAIL ▾'}</button>}
                      </div>
                    </div>
                    <p className="label-mono mb-3">{c.comm} × {c.talent}</p>
                    <p className="text-sm text-[#12283c]/70 leading-relaxed mb-5">{c.note}</p>
                    {open && (
                      <div className="space-y-4 mb-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-[#12283c]/15 p-4"><p className="label-mono !text-[#e62b2b] !opacity-100 mb-2">PERNYATAAN KOMUNITAS · {c.comm.toUpperCase()}</p><p className="text-xs italic leading-relaxed">"{c.statComm}"</p></div>
                          <div className="rounded-xl border border-[#12283c]/15 p-4"><p className="label-mono !text-[#e62b2b] !opacity-100 mb-2">PERNYATAAN TALENTA · {c.talent.toUpperCase()}</p><p className="text-xs italic leading-relaxed">"{c.statTalent}"</p></div>
                        </div>
                        <div className="rounded-xl border border-[#12283c]/15 p-4">
                          <p className="label-mono mb-3">TIMELINE KELUHAN</p>
                          <div className="space-y-0">
                            {c.timeline.map((ev, i) => (
                              <div key={i} className="relative pl-8 pb-4 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
                                <span className={`absolute left-[-7px] top-0 w-3.5 h-3.5 rotate-45 border-2 border-[#12283c] ${i === c.timeline.length - 1 ? 'bg-[#e62b2b]' : 'bg-[#fdfcf7]'}`} />
                                <div className="flex items-center gap-3 flex-wrap"><span className="font-mono text-[10px] font-bold">{ev.d}</span><p className="text-xs">{ev.e}</p></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {c.status !== 'SELESAI' && (
                      <div className="flex gap-3 flex-wrap">
                        <button onClick={() => { setMsgTarget({ key: `case-${c.id}`, name: `${c.comm} × ${c.talent}` }); setMsgText(''); }} className="flex-1 btn-pill btn-ghost-dark !py-3 text-[10px]">{sentMsgs[`case-${c.id}`] ? '✓ Pesan Terkirim — Kirim Lagi' : '✉ Hubungi Kedua Pihak'}</button>
                        <button onClick={() => setResolveTarget(c)} className="flex-1 btn-pill btn-red !py-3 text-[10px]">Putuskan →</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ============ PENGGUNA ============ */}
        {tab === 'pengguna' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Daftar Pengguna</h1><p className="label-mono mt-2">SEMUA AKUN TERDAFTAR · {users.length} AKUN</p></div>
              <div className="flex flex-wrap gap-2">
                {['SEMUA', 'KOMUNITAS', 'TALENTA', 'LIAISON'].map((s) => (
                  <button key={s} onClick={() => setUserFilter(s)} className={`chip-mono transition-colors ${userFilter === s ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="dash-item card-light p-7">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-[#12283c]/15">{['NAMA', 'PERAN', 'BERGABUNG', 'REPUTASI', 'STATUS', ''].map((h, i) => <th key={i} className="py-3 pr-4 label-mono">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#12283c]/10">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#12283c]/5 transition-colors">
                        <td className="py-4 pr-4 font-bold">{u.n}</td>
                        <td className="py-4 pr-4"><span className="chip-mono">{u.role}</span></td>
                        <td className="py-4 pr-4 text-xs opacity-70">{u.join}</td>
                        <td className="py-4 pr-4 font-mono font-bold">{u.rep}</td>
                        <td className="py-4 pr-4">{chip(u.status === 'AKTIF' ? 'green' : 'navy', u.status)}</td>
                        <td className="py-4 text-right"><button onClick={() => toggleSuspend(u.id)} className={`chip-mono transition-colors ${u.status === 'AKTIF' ? 'text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6]' : 'text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white'}`}>{u.status === 'AKTIF' ? 'TANGGUHKAN' : 'AKTIFKAN'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ============ AGENSUSI ============ */}
        {tab === 'liaison' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">AgenSUSI</h1><p className="label-mono mt-2">PANTAU KINERJA AGENSUSI</p></div>
              <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{liaisons.filter((l) => l.status === 'AKTIF').length} AGEN AKTIF</span>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="dash-item card-light col-span-12 lg:col-span-5 p-7">
                <h3 className="text-xl font-black mb-5">Komunitas Tercatat / Minggu</h3>
                <MiniBars data={[{ l: 'M1', v: 4 }, { l: 'M2', v: 6 }, { l: 'M3', v: 5 }, { l: 'M4', v: 8 }]} />
                <div className="mt-6">
                  <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>KOMUNITAS TERCATAT DARI TOTAL</span><span>42%</span></div>
                  <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden"><div className="bar-h h-full rounded-full bg-[#e62b2b]" style={{ width: '42%' }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-6">
                  <div className="rounded-xl border border-[#12283c]/15 p-3"><p className="label-mono">TOTAL KUNJUNGAN</p><p className="text-lg font-black">{liaisons.reduce((a, l) => a + l.visits, 0)}</p></div>
                  <div className="rounded-xl border border-[#12283c]/15 p-3"><p className="label-mono">TOTAL KOMUNITAS</p><p className="text-lg font-black">{liaisons.reduce((a, l) => a + l.assisted, 0)}</p></div>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-7 space-y-4">
                {liaisons.map((l) => {
                  const open = liaisonDetail === l.id;
                  return (
                    <div key={l.id} className={`dash-item card-light p-6 transition-all ${open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''} ${l.status === 'DITANGGUHKAN' ? 'opacity-60' : ''}`}>
                      <button onClick={() => setLiaisonDetail(open ? null : l.id)} className="w-full flex items-center justify-between gap-4 flex-wrap text-left">
                        <div className="flex items-center gap-4">
                          <span className="w-12 h-12 rounded-full bg-[#e62b2b] text-white flex items-center justify-center text-lg font-black">{l.n.charAt(0)}</span>
                          <div><p className="font-black">{l.n}</p><p className="font-mono text-[10px] opacity-50">{l.visits} KUNJUNGAN · {l.assisted} KOMUNITAS</p></div>
                        </div>
                        <div className="flex items-center gap-2">{chip(l.status === 'AKTIF' ? 'green' : 'navy', l.status)}<span className={`text-[10px] font-black transition-transform ${open ? 'rotate-90 text-[#e62b2b]' : ''}`}>→</span></div>
                      </button>
                      {open && (
                        <div className="mt-4 border-t border-[#12283c]/10 pt-4 space-y-4">
                          <div>
                            <p className="label-mono mb-2">RIWAYAT KUNJUNGAN TERAKHIR</p>
                            <div className="space-y-2">
                              {l.history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-[#12283c]/10 px-3 py-2">
                                  <div className="flex items-center gap-3"><span className="font-mono text-[9px] font-bold">{h.d}</span><span className="text-[10px] font-bold">{h.c}</span></div>
                                  {chip(h.s === 'TERDATA' ? 'green' : h.s === 'BERLANGSUNG' ? 'red' : 'ghost', h.s)}
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="font-mono text-[10px] opacity-50">AKTIVITAS TERAKHIR: {l.last}</p>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => { setMsgTarget({ key: `liaison-${l.id}`, name: l.n }); setMsgText(''); }} className="flex-1 btn-pill btn-ghost-dark !py-2.5 text-[9px]">{sentMsgs[`liaison-${l.id}`] ? '✓ Terkirim — Kirim Lagi' : '✉ Hubungi'}</button>
                            <button onClick={() => toggleLiaison(l.id)} className={`flex-1 btn-pill !py-2.5 text-[9px] ${l.status === 'AKTIF' ? 'btn-ghost-dark hover:!bg-[#e62b2b] hover:!text-white hover:!border-[#e62b2b]' : 'bg-[#c9ecd9] text-[#12283c]'}`}>{l.status === 'AKTIF' ? 'Tangguhkan' : 'Aktifkan'}</button>
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

        {/* ============ MODAL PESAN ============ */}
        {msgTarget && (
          <div className="fixed inset-0 z-[500] bg-[#0e2233]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12283c] text-[#f2efe6] w-full max-w-md border border-white/10 rounded-2xl p-8 relative">
              <button onClick={() => setMsgTarget(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl font-black hover:bg-[#e62b2b] hover:border-[#e62b2b]">×</button>
              <span className="label-mono !text-[#e62b2b] !opacity-100">PESAN RESMI ADMIN</span>
              <h3 className="text-2xl font-black mt-2 mb-4">{msgTarget.name}</h3>
              <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} className="input-line input-line-dark h-24 resize-none" placeholder="Tulis pesan resmi..." />
              <div className="flex flex-wrap gap-2 mt-3">
                {['Mohon tanggapan dalam 3 hari kerja.', 'Ketersediaan Ke Kantor', 'Lampirkan bukti pendukung laporan.'].map((qk) => (
                  <button key={qk} onClick={() => setMsgText(qk)} className="chip-mono text-[#f2efe6]/70 hover:text-[#f2efe6] transition-colors">+ {qk}</button>
                ))}
              </div>
              <button onClick={() => sendMsg(msgTarget.key)} disabled={!msgText.trim()} className={`btn-pill w-full mt-4 ${msgText.trim() ? 'btn-red' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}>Kirim Pesan →</button>
            </div>
          </div>
        )}
        {/* ============ MODAL PUTUSAN ============ */}
        {resolveTarget && (
          <div className="fixed inset-0 z-[500] bg-[#0e2233]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12283c] text-[#f2efe6] w-full max-w-md border border-white/10 rounded-2xl p-8 relative">
              <button onClick={() => setResolveTarget(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl font-black hover:bg-[#e62b2b] hover:border-[#e62b2b]">×</button>
              <span className="label-mono !text-[#e62b2b] !opacity-100">KEPUTUSAN ADMIN</span>
              <h3 className="text-2xl font-black mt-2 mb-1">{resolveTarget.t}</h3>
              <p className="font-mono text-[10px] opacity-50 mb-6">{resolveTarget.comm} × {resolveTarget.talent}</p>
              <div className="space-y-3">
                <button onClick={() => resolveCase(resolveTarget.id, 'talenta')} className="w-full rounded-xl border border-white/15 p-4 text-left hover:bg-white/5 transition-colors"><p className="font-mono text-[10px] font-black uppercase tracking-widest">Tandai Proyek Selesai</p><p className="text-[10px] opacity-60 mt-1">Talenta mendapatkan poin reputasi.</p></button>
                <button onClick={() => resolveCase(resolveTarget.id, 'perpanjang')} className="w-full rounded-xl border border-white/15 p-4 text-left hover:bg-white/5 transition-colors"><p className="font-mono text-[10px] font-black uppercase tracking-widest">Perpanjang Durasi Proyek 7 Hari</p><p className="text-[10px] opacity-60 mt-1">Melihat perkembangan lebih lanjut.</p></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashShell>
  );
}