import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import ProjSteps from '../../components/common/ProjSteps';
import SetToggle from '../../components/common/SetToggle';
import AiAgent from '../../components/common/AiAgent';
import GoogleMapsEmbed from '../../components/common/GoogleMapsEmbed';
import { geocode, sectorOf } from '../../lib/geocode';
import { loadProjectSubmissions, saveProjectSubmissions } from '../../utils/projectSubmissions';

const CHIP = { green: 'bg-[#c9ecd9] text-[#12283c]', navy: 'bg-[#12283c] text-[#f2efe6]', red: 'bg-[#e62b2b] text-white', ghost: 'bg-[#12283c]/10 text-[#12283c]/70' };
const chip = (k, t) => <span className={`chip-mono border-0 ${CHIP[k]}`}>{t}</span>;
const PROJ_CHIP = { 'DALAM ANTRIAN': 'ghost', DIPROSES: 'navy', MENUNGGU: 'red', SELESAI: 'green' };
const NOTE_COLORS = ['#c9ecd9', '#f4d4d4', '#d8e2ec', '#fdfcf7'];

export default function DashboardRequester({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [filter, setFilter] = useState('SEMUA');
  const [sets, setSets] = useState({ email: true, lokasi: true, whatsapp: false, notifTalenta: true, notifDiskusi: true });
  const [selectedProj, setSelectedProj] = useState(null);
  const [testi, setTesti] = useState('');
  const [projectSubmissions, setProjectSubmissions] = useState(loadProjectSubmissions);
  const [reviewNotes, setReviewNotes] = useState({});
  const [settingsTab, setSettingsTab] = useState('profil');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notifs] = useState([
    { id: 1, type: 'talenta', title: 'Derien A. melamar kebutuhan Anda', sub: 'Aplikasi Iuran Warga · 2 jam lalu', read: false },
    { id: 2, type: 'verifikasi', title: 'Proyek menunggu verifikasi Anda', sub: 'Rekap Iuran Digital · 5 jam lalu', read: false },
    { id: 3, type: 'diskusi', title: 'Budi Santoso membalas diskusi Anda', sub: 'Forum Diskusi · 1 hari lalu', read: false },
    { id: 4, type: 'sistem', title: 'Selamat datang di SUSI Community', sub: 'Lengkapi profil komunitas Anda · 2 hari lalu', read: true },
  ]);
  const [projects, setProjects] = useState([
    { id: 1, t: 'Website Galeri Karang Taruna', cat: 'WEBSITE', d: 'Butuh tempat pamer kegiatan & foto biar warga makin terlibat.', status: 'DALAM ANTRIAN' },
    { id: 2, t: 'Aplikasi Inventaris PKK', cat: 'APLIKASI', d: 'Form peminjaman barang + pengingat pengembalian.', status: 'DALAM ANTRIAN' },
    { id: 3, t: 'Rekap Iuran Digital', cat: 'PENCATATAN', d: 'Dashboard iuran 48 kepala keluarga, cek iuran lewat HP.', status: 'DIPROSES', talent: 'Derien A.', deadline: '30 AGU 2026', progress: 60 },
    { id: 4, t: 'Katalog Produk UMKM', cat: 'WEBSITE', d: 'Katalog produk 54 pedagang agar bisa dilihat online.', status: 'MENUNGGU', talent: 'Khalifa H.', selesai: '14 AGU 2026' },
    { id: 5, t: 'Formulir Pendaftaran Digital', cat: 'LAINNYA', d: 'Form pendaftaran warga baru pengganti kertas fotokopian.', status: 'SELESAI', talent: 'Ezra P.', testi: '"Pengerjaan cepat, komunikasi jelas."', date: '02 AGU 2026' },
  ]);
  /* ===== MADING ===== */
  const [discussions, setDiscussions] = useState([
    { id: 1, user: 'Budi Santoso', comm: 'Karang Taruna Mekar', time: '2J', cat: 'DISKUSI', text: 'Ada yang pernah bikin aplikasi absensi digital? Butuh referensi buat kegiatan pemuda.', x: 90, y: 70, rot: -3, color: '#f4d4d4', replies: [{ user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '1J', text: 'Kami pernah pakai Google Forms + spreadsheet.' }] },
    { id: 2, user: 'Ibu Siti Aminah', comm: 'PKK RW 05', time: '5J', cat: 'TANYA', text: 'Mau tanya, ada komunitas yang sudah bikin website profil?', x: 430, y: 140, rot: 2, color: '#d8e2ec', replies: [] },
    { id: 3, user: 'Haji Rahmat', comm: 'Paguyuban Pedagang', time: '1J', cat: 'INFO', text: 'Info: pelatihan foto produk gratis, Sabtu di pasar!', x: 780, y: 90, rot: -2, color: '#c9ecd9', replies: [] },
    { id: 4, user: 'Bidan Rina', comm: 'Posyandu Melati', time: '3J', cat: 'TANYA', text: 'Ada yang bisa bantu bikin form penimbangan digital?', x: 250, y: 420, rot: 3, color: '#fdfcf7', replies: [] },
    { id: 5, user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '4J', cat: 'DISKUSI', text: 'Usul: sesi sharing edit foto bulanan antar komunitas.', x: 640, y: 460, rot: -4, color: '#f4d4d4', replies: [] },
  ]);
  const [madingView, setMadingView] = useState('board');
  const [activeTopic, setActiveTopic] = useState(null);
  const [ntText, setNtText] = useState('');
  const [ntCat, setNtCat] = useState('DISKUSI');
  const [replyText, setReplyText] = useState('');
  const madingWrapRef = useRef(null);
  const madingCanvasRef = useRef(null);
  const dragRef = useRef({ down: false, sx: 0, sy: 0, bx: 0, by: 0, moved: false });
  const noteDrag = useRef({ id: null, sx: 0, sy: 0, ox: 0, oy: 0, nx: 0, ny: 0, moved: false, el: null });
  const panRef = useRef({ x: 0, y: 0 });
  const CANVAS_W = 1600, CANVAS_H = 1000;
  /* ===== MAP ===== */
  const [mapComm, setMapComm] = useState(null);
  const [markMode, setMarkMode] = useState(false);
  const [tempLoc, setTempLoc] = useState(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationSearching, setLocationSearching] = useState(false);
  const [myCommName, setMyCommName] = useState('');
  const [myCommCat] = useState('KELUARGA');
  const [myComms, setMyComms] = useState([]);
  const rootRef = useRef(null);

  const first = (user?.name || 'Warga').split(' ')[0];
  const NAV = [
    { id: 'beranda', n: '01', l: 'Beranda' },
    { id: 'komunitas', n: '02', l: 'Komunitas' },
    { id: 'map', n: '03', l: 'Map' },
    { id: 'profile', n: '04', l: 'Profil' },
    { id: 'setting', n: '05', l: 'Pengaturan' },
  ];
  const COLS = [
    { id: 'DALAM ANTRIAN', l: 'DALAM ANTRIAN' }, { id: 'DIPROSES', l: 'DIPROSES' },
    { id: 'MENUNGGU', l: 'MENUNGGU VERIFIKASI' }, { id: 'SELESAI', l: 'SELESAI DIVERIFIKASI' },
  ];
  const COMMUNITIES = [
    { n: 'PKK RW 05', s: 'BARAT–UTARA', m: 48, t: 'KELUARGA', leader: { n: 'Ibu Siti Aminah', r: 'Ketua PKK RW 05', i: 'SA' }, est: 'MEI 2019', wa: '+62 812-3456-7890', desc: 'Pemberdayaan Keluarga & Kesejahteraan Warga RW 05.', lat: -6.8850, lng: 107.5750 },
    { n: 'Karang Taruna Mekar', s: 'TIMUR–SELATAN', m: 65, t: 'PEMUDA', leader: { n: 'Budi Santoso', r: 'Ketua', i: 'BS' }, est: 'JAN 2017', wa: '+62 821-9876-5432', desc: 'Wadah kreatif pemuda.', lat: -6.9350, lng: 107.6650 },
    { n: 'Hobi Fotografi Bandung', s: 'BARAT–SELATAN', m: 32, t: 'HOBI', leader: { n: 'Farhan Maulana', r: 'Founder', i: 'FM' }, est: 'MAR 2021', wa: '+62 856-1234-5678', desc: 'Komunitas pecinta fotografi.', lat: -6.9250, lng: 107.5850 },
    { n: 'Paguyuban Pedagang', s: 'TIMUR–UTARA', m: 54, t: 'UMKM', leader: { n: 'Haji Rahmat', r: 'Ketua', i: 'HR' }, est: 'OKT 2015', wa: '+62 878-5678-1234', desc: 'Paguyuban pedagang.', lat: -6.8950, lng: 107.6550 },
  ];
  const PROFILE = {
    bio: 'Pengurus PKK RW 05 yang peduli dengan digitalisasi administrasi warga.',
    timeline: [
      { date: '21 AGU 2026', title: 'Website Profil PKK', status: 'selesai', talent: 'Khalifa H.', note: 'Ditandai Selesai Pukul 05:00 WIB' },
      { date: '31 OKT 2026', title: 'Rekap Iuran Digital', status: 'proses', talent: 'Derien A.', note: 'Ditandai Selesai Pukul 12:00 WIB' },
    ],
    track: [
      { date: '21 AGU 2026', t: 'Website Profil PKK', comm: 'Khalifa H.', note: 'Diterima oleh 48 anggota.', testimonial: '"Pengerjaan rapi, tepat waktu, dan sabar menjelaskan."' },
      { date: '12 JUN 2026', t: 'Formulir Pendaftaran Digital', comm: 'Ezra P.', note: 'Digunakan 12 keluarga baru.', testimonial: '"Proses cepat, hasilnya mudah dipakai warga."' },
    ],
    testimoni: [
      { text: '"Aplikasi iuran sangat membantu!"', from: 'Derien A.', time: '1M lalu' },
      { text: '"Bersedia menjelaskan dengan jelas."', from: 'Khalifa H.', time: '2M lalu' },
    ],
  };
  const SETTINGS_NAV = [
    { id: 'profil', l: 'INFORMASI DETAIL' }, { id: 'notifikasi', l: 'NOTIFIKASI' },
    { id: 'privasi', l: 'PRIVASI & TAMPILAN' }, { id: 'integrasi', l: 'INTEGRASI' }, { id: 'bahaya', l: 'LANJUTAN' },
  ];
  const NOTIF_META = { talenta: { c: '#e62b2b', l: 'TALENTA' }, verifikasi: { c: '#c9ecd9', l: 'VERIFIKASI' }, diskusi: { c: '#12283c', l: 'DISKUSI' }, sistem: { c: '#9CA3AF', l: 'SISTEM' } };

  /* ===== MADING LOGIC ===== */
  const clampPan = (x, y) => {
    const vp = madingWrapRef.current;
    const minX = vp ? Math.min(0, vp.clientWidth - CANVAS_W) : -CANVAS_W;
    const minY = vp ? Math.min(0, vp.clientHeight - CANVAS_H) : -CANVAS_H;
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) };
  };
  const onBoardUp = () => { dragRef.current.down = false; setTimeout(() => { dragRef.current.moved = false; }, 0); };
  const onBoardDown = (e) => { const d = dragRef.current; d.down = true; d.moved = false; d.sx = e.clientX; d.sy = e.clientY; d.bx = panRef.current.x; d.by = panRef.current.y; };
  const onBoardMove = (e) => {
    const d = dragRef.current; if (!d.down) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    const p = clampPan(d.bx + dx, d.by + dy); panRef.current = p;
    gsap.set(madingCanvasRef.current, { x: p.x, y: p.y });
  };
  const onNoteDown = (e, t) => {
    e.stopPropagation();
    const d = noteDrag.current;
    d.id = t.id; d.el = e.currentTarget; d.sx = e.clientX; d.sy = e.clientY; d.ox = t.x; d.oy = t.y; d.nx = t.x; d.ny = t.y; d.moved = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    gsap.to(e.currentTarget, { scale: 1.07, rotation: 0, zIndex: 50, boxShadow: '0 18px 40px rgba(0,0,0,.5)', duration: 0.2, ease: 'power2.out' });
  };
  const onNoteMove = (e, t) => {
    const d = noteDrag.current; if (d.id !== t.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    d.nx = Math.max(8, Math.min(CANVAS_W - 270, d.ox + dx)); d.ny = Math.max(8, Math.min(CANVAS_H - 170, d.oy + dy));
    gsap.set(d.el, { left: d.nx, top: d.ny });
  };
  const onNoteUp = (e, t) => {
    const d = noteDrag.current; if (d.id !== t.id) return;
    gsap.to(d.el, { scale: 1, rotation: t.rot, zIndex: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' });
    if (d.moved) setDiscussions((ds) => ds.map((x) => (x.id === t.id ? { ...x, x: d.nx, y: d.ny } : x)));
    else { setActiveTopic(t); setMadingView('detail'); }
    d.id = null;
  };
  const submitTopic = () => {
    if (!ntText.trim()) return;
    const t = { id: Date.now(), user: user?.name || first, comm: 'Komunitas Anda', time: 'BARU SAJA', cat: ntCat, text: ntText.trim(), replies: [], x: 150 + Math.random() * (CANVAS_W - 500), y: 80 + Math.random() * (CANVAS_H - 400), rot: Math.round(Math.random() * 8 - 4), color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] };
    setDiscussions((d) => [t, ...d]); setNtText(''); setNtCat('DISKUSI'); setMadingView('board');
    setTimeout(() => gsap.fromTo(`#note-${t.id}`, { autoAlpha: 0, y: -70, scale: 0.8, rotation: t.rot - 8 }, { autoAlpha: 1, y: 0, scale: 1, rotation: t.rot, duration: 0.6, ease: 'back.out(1.7)' }), 60);
  };
  const postReply = (id) => {
    if (!replyText.trim()) return;
    const r = { user: user?.name || first, comm: 'Komunitas Anda', time: 'BARU SAJA', text: replyText.trim() };
    setDiscussions((d) => d.map((x) => (x.id === id ? { ...x, replies: [...x.replies, r] } : x)));
    setActiveTopic((at) => (at && at.id === id ? { ...at, replies: [...at.replies, r] } : at));
    setReplyText('');
  };
  useEffect(() => {
    if (tab !== 'komunitas' || madingView !== 'board') return;
    if (madingWrapRef.current) {
      const vp = madingWrapRef.current;
      const p = clampPan(-(CANVAS_W - vp.clientWidth) / 2, -(CANVAS_H - vp.clientHeight) / 2);
      panRef.current = p; gsap.set(madingCanvasRef.current, { x: p.x, y: p.y });
    }
    gsap.fromTo('.mading-note', { autoAlpha: 0, y: -70, scale: 0.85, rotation: (i, el) => (parseFloat(el.dataset.rot) || 0) - 6 }, { autoAlpha: 1, y: 0, scale: 1, rotation: (i, el) => parseFloat(el.dataset.rot) || 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)', overwrite: true });
  }, [madingView, tab]);

  /* ===== PROYEK ===== */
  const verifyProj = () => {
    const u = { ...selectedProj, status: 'SELESAI', testi: testi.trim() ? `"${testi.trim()}"` : '"Terima kasih, pengerjaan memuaskan."', date: 'HARI INI' };
    setProjects((ps) => ps.map((p) => (p.id === u.id ? u : p))); setSelectedProj(u); setTesti('');
  };
  const reviseProj = () => {
    const u = { ...selectedProj, status: 'DIPROSES' };
    setProjects((ps) => ps.map((p) => (p.id === u.id ? u : p))); setSelectedProj(u); setTesti('');
  };
  const reviewSubmission = (submissionId, status) => {
    const reviewNote = (reviewNotes[submissionId] || '').trim();
    if (status === 'REVISI' && !reviewNote) return;
    const updated = projectSubmissions.map((submission) => submission.id === submissionId
      ? { ...submission, status, reviewNote, reviewedAt: new Date().toISOString() }
      : submission);
    saveProjectSubmissions(updated);
    setProjectSubmissions(updated);
  };

  /* ===== MAP ===== */
  const quadrantOf = sectorOf;
  const focusComm = (c) => { setMapComm({ ...c, mine: !!c.mine }); setTempLoc(null); };
  const searchCommunityLocation = async () => {
    if (!locationSearch.trim() || locationSearching) return;
    setLocationSearching(true);
    setLocationMessage('');
    try {
      const found = await geocode(locationSearch);
      if (!found) {
        setLocationMessage('Alamat tidak ditemukan. Coba tambahkan nama jalan atau kelurahan.');
        return;
      }
      setTempLoc({ lat: found.lat, lng: found.lng });
      setMapComm(null);
      setLocationMessage('Lokasi ditemukan. Periksa peta sebelum menyimpan komunitas.');
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Pencarian alamat gagal. Coba lagi.');
    } finally {
      setLocationSearching(false);
    }
  };
  const saveMyComm = () => {
    if (!myCommName.trim() || !tempLoc) return;
    const init = (user?.name || 'A').charAt(0).toUpperCase();
    setMyComms([...myComms, { n: myCommName.trim(), s: quadrantOf(tempLoc), m: 1, t: myCommCat, leader: { n: user?.name || first, r: 'Pemimpin', i: init }, est: 'AGU 2026', wa: '—', desc: `Komunitas baru ditandai oleh ${user?.name || first}.`, lat: tempLoc.lat, lng: tempLoc.lng, mine: true }]);
    setTempLoc(null); setMyCommName(''); setMarkMode(false);
  };
  /* ===== ANIMASI ===== */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' });
      gsap.utils.toArray('.counter').forEach((el) => { const t = +el.dataset.target; const o = { val: 0 }; gsap.to(o, { val: t, duration: 1.4, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.val); } }); });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selectedProj, settingsTab, madingView]);

  const onTab = (id) => { setTab(id); setSelectedProj(null); setMapComm(null); setMarkMode(false); setTempLoc(null); setActiveTopic(null); setMadingView('board'); };
  const shellNotifs = notifs.map((n) => ({ ...n, color: NOTIF_META[n.type]?.c, label: NOTIF_META[n.type]?.l }));

  return (
    <DashShell user={user} roleLabel="KOMUNITAS" nav={NAV} tab={tab} onTab={onTab} notifs={shellNotifs} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {/* ============ BERANDA ============ */}
        {tab === 'beranda' && (selectedProj ? (
          <>
            <div className="dash-item mb-6">
              <button onClick={() => setSelectedProj(null)} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE BERANDA</button>
            </div>
            <div className="dash-item card-light p-8 md:p-10 mb-6">
              <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2 flex-wrap">{chip('ghost', selectedProj.cat)}{chip(PROJ_CHIP[selectedProj.status], selectedProj.status)}</div>
                <span className="label-mono">ID PROJEK · PRJ-0{selectedProj.id}</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-4">{selectedProj.t}</h1>
              <p className="text-sm text-[#12283c]/70 leading-relaxed max-w-3xl">{selectedProj.d}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden mt-6">
                {[['TALENTA', selectedProj.talent || '— BELUM ADA —'], ['DEADLINE', selectedProj.deadline || '—'], ['DIAJUKAN', '12 JUL 2026'], ['PEMILIK', `${first} (ANDA)`]].map(([l, v]) => (
                  <div key={l} className="bg-[#fdfcf7] p-4"><p className="label-mono">{l}</p><p className="text-sm font-black mt-1">{v}</p></div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-7 space-y-6">
                <div className="dash-item card-light p-7"><h3 className="text-xl font-black mb-6">Progress Projek</h3><ProjSteps status={selectedProj.status} /></div>
                <div className="dash-item card-light p-7">
                  <h3 className="text-xl font-black mb-5">Lini Masa Projek</h3>
                  <div className="space-y-0">
                    {[
                      { d: '12 JUL 2026', t: 'Pengaduan diajukan', done: true },
                      { d: '14 JUL 2026', t: 'Masuk Antrian', done: true },
                      ...(selectedProj.talent ? [{ d: '20 JUL 2026', t: `${selectedProj.talent} dipilih sebagai talenta`, done: true }] : []),
                      ...(['DIPROSES', 'MENUNGGU', 'SELESAI'].includes(selectedProj.status) ? [{ d: '21 JUL 2026', t: 'Pengerjaan dimulai', done: true }] : []),
                      ...(['MENUNGGU', 'SELESAI'].includes(selectedProj.status) ? [{ d: selectedProj.selesai || '—', t: 'Talenta menandai SELESAI', done: true }] : []),
                      ...(selectedProj.status === 'SELESAI' ? [{ d: selectedProj.date, t: 'Komunitas telah Memverifikasi', done: true }] : []),
                    ].map((ev, i) => (
                      <div key={i} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
                        <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-[#12283c] ${ev.done ? 'bg-[#e62b2b]' : 'bg-[#fdfcf7]'}`} />
                        <p className="font-mono text-[10px] font-bold mb-1">{ev.d}</p>
                        <p className="text-sm font-bold">{ev.t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-5 space-y-6">
                <div className="dash-item card-light p-7">
                  <h3 className="text-xl font-black mb-2">Verifikasi Proyek</h3>
                  <p className="label-mono mb-5">VERIFIKASI HANYA SAAT PROYEK SELESAI</p>
                  {selectedProj.status === 'DALAM ANTRIAN' && <div className="rounded-xl border-2 border-dashed border-[#12283c]/25 p-5 font-mono text-[10px] font-bold opacity-60">🔒 MENUNGGU TALENTA MELAMAR — VERIFIKASI TERKUNCI.</div>}
                  {selectedProj.status === 'DIPROSES' && <div className="rounded-xl border-2 border-dashed border-[#12283c]/25 p-5 font-mono text-[10px] font-bold opacity-60">🔒 VERIFIKASI TERKUNCI — TERBUKA SETELAH TALENTA MENANDAI SELESAI.</div>}
                  {selectedProj.status === 'MENUNGGU' && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-[#c9ecd9] p-4 font-mono text-[10px] font-bold text-[#12283c]">✓ TALENTA MENANDAI SELESAI · {selectedProj.selesai}</div>
                      <div>
                        <label className="field-label">Testimoni (opsional)</label>
                        <textarea value={testi} onChange={(e) => setTesti(e.target.value)} className="input-line h-20 resize-none" placeholder='Contoh: "Pengerjaan cepat & jelas..."' />
                      </div>
                      <button onClick={verifyProj} className="btn-pill w-full bg-[#c9ecd9] text-[#12283c] hover:bg-[#e62b2b] hover:text-white">✓ Tandai Selesai</button>
                      <button onClick={reviseProj} className="btn-pill btn-ghost-dark w-full !py-3">✕ Minta Perbaikan</button>
                    </div>
                  )}
                  {selectedProj.status === 'SELESAI' && (
                    <div className="rounded-xl bg-[#c9ecd9]/60 border border-[#12283c]/15 p-5">
                      <p className="text-sm italic">{selectedProj.testi}</p>
                      <p className="font-mono text-[9px] opacity-60 mt-2">✓ TERVERIFIKASI · {selectedProj.date}</p>
                    </div>
                  )}
                </div>
                <div className="dash-item card-dark !bg-[#12283c] p-5 text-[#f2efe6]">
                  <p className="font-mono text-[10px] opacity-60 leading-relaxed">MASALAH KOMUNIKASI DENGAN TALENTA? HUBUNGI:</p>
                  <p className="text-[15px] font-bold mt-1">+62 22 123 4567</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="dash-item card-light p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
              <div>
                <p className="label-mono mb-2">Dasbor Komunitas</p>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, {first}.</h1>
                <p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed">Kelola proyek komunitasmu, atau mulai diskusi dengan komunitas lain!</p>
              </div>
              <button onClick={() => navigateTo('request')} className="btn-pill btn-red">+ Ajukan Pengaduan</button>
            </div>
            <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
              {[{ t: projects.filter((p) => p.status === 'DALAM ANTRIAN').length, l: 'KEBUTUHAN AKTIF' }, { t: projects.filter((p) => p.status === 'DIPROSES').length, l: 'DALAM PROSES' }, { t: projects.filter((p) => p.status === 'SELESAI').length, l: 'SELESAI' }].map((s, i) => (
                <div key={i} className="dash-item bg-[#fdfcf7] p-6 hover:bg-[#e62b2b] hover:text-white transition-colors">
                  <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div>
                  <p className="label-mono mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <section className="dash-item card-light p-6 md:p-8 mb-6">
              <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-black">Pengiriman Proyek Talenta</h2>
                  <p className="label-mono mt-1">TINJAU HASIL SEBELUM KONFIRMASI</p>
                </div>
                <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{projectSubmissions.filter((submission) => submission.status !== 'DISETUJUI').length} PERLU DICEK</span>
              </div>
              {projectSubmissions.length === 0 && <p className="rounded-xl border border-dashed border-[#12283c]/20 p-5 text-sm text-[#12283c]/60">Belum ada hasil proyek yang dikirim talenta.</p>}
              <div className="space-y-4">
                {projectSubmissions.map((submission) => (
                  <article key={submission.id} className="rounded-xl border border-[#12283c]/15 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-lg font-black">{submission.project}</h3>
                        <p className="font-mono text-[10px] opacity-60">{submission.community} · DIKIRIM OLEH {submission.talent} · {new Date(submission.submittedAt).toLocaleDateString('id-ID')}</p>
                      </div>
                      <span className={`chip-mono border-0 ${submission.status === 'DISETUJUI' ? 'bg-[#c9ecd9] text-[#12283c]' : submission.status === 'REVISI' ? 'bg-[#f4d4d4] text-[#12283c]' : 'bg-[#12283c] text-[#f2efe6]'}`}>
                        {submission.status === 'DISETUJUI' ? 'DISETUJUI' : submission.status === 'REVISI' ? 'PERLU PERBAIKAN' : 'MENUNGGU TINJAUAN'}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{submission.summary}</p>
                    <a href={submission.link} target="_blank" rel="noreferrer" className="font-mono text-xs font-bold text-[#e62b2b] underline break-all">BUKA HASIL / DEMO ↗</a>
                    {submission.notes && <p className="mt-3 text-xs text-[#12283c]/70"><strong>Catatan talenta:</strong> {submission.notes}</p>}
                    {submission.reviewNote && <p className="mt-3 rounded-lg bg-[#f4d4d4] p-3 text-xs"><strong>Catatan komunitas:</strong> {submission.reviewNote}</p>}
                    {submission.status !== 'DISETUJUI' && (
                      <div className="mt-5 border-t border-[#12283c]/10 pt-4">
                        <label htmlFor={`review-note-${submission.id}`} className="field-label">Catatan perbaikan (wajib jika meminta revisi)</label>
                        <textarea id={`review-note-${submission.id}`} value={reviewNotes[submission.id] || ''} onChange={(event) => setReviewNotes((notes) => ({ ...notes, [submission.id]: event.target.value }))} className="input-line h-20 resize-y" placeholder="Jelaskan bagian yang perlu diperbaiki..." />
                        <div className="flex flex-wrap gap-3 mt-4">
                          <button onClick={() => reviewSubmission(submission.id, 'REVISI')} disabled={!(reviewNotes[submission.id] || '').trim()} className={`btn-pill flex-1 !py-3 text-[10px] ${reviewNotes[submission.id]?.trim() ? 'btn-ghost-dark' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}>Minta Perbaikan</button>
                          <button onClick={() => reviewSubmission(submission.id, 'DISETUJUI')} className="btn-pill flex-1 !py-3 text-[10px] bg-[#c9ecd9] text-[#12283c] hover:bg-[#e62b2b] hover:text-white">✓ Konfirmasi Selesai</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
            <div className="dash-item flex items-center justify-between flex-wrap gap-4 mb-4">
              <div><h3 className="text-2xl font-black">Papan Projek & Verifikasi</h3><p className="label-mono mt-1">KLIK KARTU UNTUK DETAIL</p></div>
              <div className="flex flex-wrap gap-2">
                {['SEMUA', 'PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                  <button key={c} onClick={() => setFilter(c)} className={`chip-mono transition-colors ${filter === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
              {COLS.map((col) => {
                const items = projects.filter((p) => p.status === col.id && (filter === 'SEMUA' || p.cat === filter));
                return (
                  <div key={col.id} className="dash-item card-light flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-[#12283c]/10">
                      <p className="font-mono text-[10px] font-bold">{col.l}</p>
                      <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{items.length}</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {items.map((p) => (
                        <div key={p.id} onClick={() => setSelectedProj(p)} className="rounded-xl border border-[#12283c]/15 p-4 transition-all hover:-translate-y-0.5 hover:border-[#e62b2b] hover:shadow-[0_10px_25px_rgba(230,43,43,0.15)] cursor-pointer">
                          <span className="chip-mono">{p.cat}</span>
                          <h4 className="font-black text-base leading-tight mt-2 mb-1">{p.t}</h4>
                          <p className="text-[11px] text-[#12283c]/60 leading-relaxed mb-3">{p.d}</p>
                          {p.status === 'DALAM ANTRIAN' && <p className="font-mono text-[9px] opacity-50">MENUNGGU TALENTA</p>}
                          {p.status === 'DIPROSES' && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-7 h-7 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center text-[10px] font-black">{p.talent?.charAt(0)}</span>
                                <div><p className="text-[10px] font-black">{p.talent}</p><p className="font-mono text-[9px] opacity-50">DEADLINE {p.deadline}</p></div>
                              </div>
                              <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden"><div className="h-full rounded-full bg-[#e62b2b]" style={{ width: `${p.progress}%` }} /></div>
                            </div>
                          )}
                          {p.status === 'MENUNGGU' && <div className="rounded-lg bg-[#c9ecd9] p-3 font-mono text-[9px] font-bold text-[#12283c]">✓ TALENTA SELESAI · {p.selesai}</div>}
                          {p.status === 'SELESAI' && (
                            <div className="rounded-lg bg-[#c9ecd9]/60 border border-[#12283c]/10 p-3">
                              <p className="text-[10px] italic">{p.testi}</p>
                              <p className="font-mono text-[9px] opacity-60 mt-1">✓ TERVERIFIKASI · REPUTASI +1</p>
                            </div>
                          )}
                          <span className="block mt-3 font-mono text-[9px] font-bold text-[#e62b2b]">LIHAT DETAIL →</span>
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-center font-mono text-[10px] opacity-40 py-6">KOLOM KOSONG</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ))}

        {/* ============ KOMUNITAS / MADING ============ */}
        {tab === 'komunitas' && madingView === 'board' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Mading Komunitas</h1><p className="text-sm text-[#12283c]/60 mt-2">Mulai Diskusi Bersama Komunitas Lain!</p></div>
              <button onClick={() => setMadingView('tempel')} className="btn-pill btn-red">Buat Topik</button>
            </div>
            <div ref={madingWrapRef} onPointerDown={onBoardDown} onPointerMove={onBoardMove} onPointerUp={onBoardUp} onPointerCancel={onBoardUp}
              className="dash-item relative h-[560px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none bg-[#12283c]"
              style={{ backgroundImage: 'radial-gradient(rgba(242,239,230,0.10) 1px, transparent 1px)', backgroundSize: '24px 24px', touchAction: 'none' }}>
              <div ref={madingCanvasRef} className="absolute top-0 left-0" style={{ width: CANVAS_W, height: CANVAS_H }}>
                {discussions.map((t) => (
                  <div key={t.id} id={`note-${t.id}`} data-rot={t.rot}
                    onPointerDown={(e) => onNoteDown(e, t)} onPointerMove={(e) => onNoteMove(e, t)} onPointerUp={(e) => onNoteUp(e, t)} onPointerCancel={(e) => onNoteUp(e, t)}
                    onMouseEnter={(e) => { if (!noteDrag.current.id) gsap.to(e.currentTarget, { scale: 1.05, duration: 0.25, ease: 'power2.out' }); }}
                    onMouseLeave={(e) => { if (!noteDrag.current.id) gsap.to(e.currentTarget, { scale: 1, duration: 0.3, ease: 'power2.out' }); }}
                    className="mading-note absolute w-64 p-5 rounded-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)] cursor-grab active:cursor-grabbing text-[#12283c]"
                    style={{ left: t.x, top: t.y, background: t.color, touchAction: 'none' }}>
                    <span className="absolute -top-3 left-1/2 -ml-2 w-4 h-4 rounded-full bg-[#e62b2b] border-2 border-[#12283c]" />
                    <div className="flex items-center justify-between mb-2">
                      <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{t.cat}</span>
                      <span className="font-mono text-[8px] opacity-50">{t.time}</span>
                    </div>
                    <p className="text-xs font-bold leading-relaxed mb-3">{t.text}</p>
                    <div className="flex items-center justify-between font-mono text-[9px] opacity-60">
                      <span className="truncate">{t.user} · {t.comm}</span><span className="shrink-0">💬 {t.replies.length}</span>
                    </div>
                    <span className="absolute bottom-1.5 right-2 font-mono text-[8px] opacity-40">⠿ geser</span>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 chip-mono border-0 bg-[#e62b2b] text-white pointer-events-none">DRAG PAPAN UNTUK MELIHAT TOPIK</div>
            </div>
          </>
        )}
        {tab === 'komunitas' && madingView === 'tempel' && (
          <>
            <div className="dash-item mb-6"><button onClick={() => setMadingView('board')} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE MADING</button></div>
            <div className="dash-item card-light p-8 md:p-10 max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Buat Topik Baru</h1>
              <p className="text-xs text-[#12283c]/60 mb-6">Buat topik baru dan berdiskusi dengan komunitas lain!</p>
              <label className="field-label">Kategori</label>
              <div className="flex flex-wrap gap-2 mb-5">
                {['DISKUSI', 'TANYA', 'INFO'].map((c) => (
                  <button key={c} onClick={() => setNtCat(c)} className={`chip-mono transition-colors ${ntCat === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{c}</button>
                ))}
              </div>
              <label className="field-label">Isi Topik</label>
              <textarea value={ntText} onChange={(e) => setNtText(e.target.value)} className="input-line h-28 resize-none" placeholder="Contoh: butuh ide buat acara 17-an..." />
              <button onClick={submitTopic} disabled={!ntText.trim()} className={`btn-pill w-full mt-5 ${ntText.trim() ? 'btn-red' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}> Tempel ke Mading</button>
            </div>
          </>
        )}
        {tab === 'komunitas' && madingView === 'detail' && activeTopic && (
          <>
            <div className="dash-item mb-6"><button onClick={() => setMadingView('board')} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE MADING</button></div>
            <div className="dash-item rounded-xl p-8 md:p-10 mb-6 text-[#12283c]" style={{ background: activeTopic.color }}>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{activeTopic.cat}</span>
                <span className="font-mono text-[9px] opacity-60">{activeTopic.time}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-3">{activeTopic.text}</h1>
              <p className="font-mono text-[10px] opacity-60">DITEMPEL OLEH {activeTopic.user.toUpperCase()} · {activeTopic.comm.toUpperCase()}</p>
            </div>
            <h3 className="text-xl font-black mb-4">{activeTopic.replies.length} BALASAN</h3>
            <div className="space-y-4 mb-6">
              {activeTopic.replies.map((r, i) => (
                <div key={i} className="dash-item card-light p-5 flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#e62b2b] text-white font-black flex items-center justify-center shrink-0">{r.user.charAt(0)}</span>
                  <div className="flex-1">
                    <p className="font-black text-sm">{r.user} <span className="font-mono text-[9px] opacity-50">· {r.comm} · {r.time}</span></p>
                    <p className="text-sm leading-relaxed mt-1">{r.text}</p>
                  </div>
                </div>
              ))}
              {activeTopic.replies.length === 0 && <p className="dash-item rounded-xl border-2 border-dashed border-[#12283c]/25 p-6 text-center font-mono text-xs opacity-50">BELUM ADA BALASAN — JADI YANG PERTAMA MENJAWAB.</p>}
            </div>
            <div className="dash-item card-light p-6">
              <label className="field-label">Tulis Balasan</label>
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="input-line h-24 resize-none" placeholder="Tanggapi topik ini..." />
              <button onClick={() => postReply(activeTopic.id)} disabled={!replyText.trim()} className={`btn-pill w-full mt-4 ${replyText.trim() ? 'btn-red' : 'bg-[#12283c]/10 text-[#12283c]/40 cursor-not-allowed'}`}>Kirim Balasan →</button>
            </div>
          </>
        )}

        {/* ============ MAP ============ */}
        {tab === 'map' && (
          <>
            <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
              <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Map Komunitas</h1><p className="label-mono mt-2">{COMMUNITIES.length + myComms.length} KOMUNITAS TERDAFTAR</p></div>
              <button onClick={() => { setMarkMode(!markMode); setTempLoc(null); setMapComm(null); }} className={`btn-pill ${markMode ? 'btn-navy' : 'btn-red'}`}>{markMode ? '✕ Batalkan' : '+ Tandai Komunitasku'}</button>
            </div>
            {markMode && (
              <div className="dash-item card-light p-5 mb-6">
                <p className="field-label">Cari alamat komunitas untuk memilih titik lokasi</p>
                <div className="flex flex-wrap gap-3">
                  <input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchCommunityLocation(); } }} className="input-line flex-1 min-w-[220px]" placeholder="Mis. Balai RW 05, Sukajadi, Bandung" />
                  <button onClick={searchCommunityLocation} disabled={locationSearching || !locationSearch.trim()} className="btn-pill btn-navy !py-3 text-[10px]">{locationSearching ? 'MENCARI...' : 'Cari Alamat →'}</button>
                  <button onClick={() => {
                    if (!navigator.geolocation) {
                      setLocationMessage('GPS tidak didukung browser ini. Cari alamat untuk menentukan titik lokasi.');
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setTempLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
                        setMapComm(null);
                        setLocationMessage('Lokasi GPS ditemukan. Periksa peta sebelum menyimpan komunitas.');
                      },
                      () => setLocationMessage('Lokasi GPS tidak dapat diakses. Periksa izin lokasi atau cari alamat.'),
                    );
                  }} className="btn-pill btn-ghost-dark !py-3 text-[10px]">Gunakan GPS</button>
                </div>
                {locationMessage && <p role="status" className="font-mono text-[10px] mt-3">{locationMessage}</p>}
              </div>
            )}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-4 space-y-4">
                {[...COMMUNITIES, ...myComms].map((c, i) => (
                  <div key={i} onClick={() => focusComm(c)} className="dash-item card-light p-4 cursor-pointer hover:border-[#e62b2b] transition-all flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${c.mine ? 'bg-[#c9ecd9] text-[#12283c]' : 'bg-[#e62b2b] text-white'}`}>{c.mine ? '★' : c.leader.i}</span>
                    <p className="font-black text-sm truncate">{c.n}</p>
                  </div>
                ))}
              </div>
              <div className="col-span-12 lg:col-span-8">
                <div className="dash-item relative h-[520px] md:h-[560px] rounded-xl border border-[#12283c]/15 overflow-hidden">
                  <div className="absolute inset-0 z-0"><GoogleMapsEmbed lat={(tempLoc || mapComm)?.lat} lng={(tempLoc || mapComm)?.lng} query="Bandung, Indonesia" zoom={(tempLoc || mapComm) ? 16 : 12} title="Peta Google Maps komunitas" /></div>
                  {mapComm && !tempLoc && (
                    <div className="absolute top-3 right-3 z-10 w-[280px] card-light p-5 shadow-xl">
                      <button onClick={() => setMapComm(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full border border-[#12283c]/30 flex items-center justify-center text-sm font-black hover:bg-[#e62b2b] hover:text-white hover:border-[#e62b2b]">×</button>
                      <h3 className="text-xl font-black leading-tight mb-1">{mapComm.n}</h3>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${mapComm.lat},${mapComm.lng}`} target="_blank" rel="noreferrer" className="block font-mono text-[10px] font-bold text-[#e62b2b] underline mb-3">BUKA RUTE ↗</a>
                      <button onClick={() => setTab('komunitas')} className="btn-pill btn-navy w-full !py-3 text-[10px]">Ke Mading Komunitas →</button>
                    </div>
                  )}
                  {tempLoc && (
                    <div className="absolute bottom-3 left-3 z-10 w-[300px] card-light p-5 shadow-xl">
                      <p className="chip-mono border-0 bg-[#12283c] text-[#f2efe6] inline-block mb-4">{tempLoc.lat.toFixed(4)}, {tempLoc.lng.toFixed(4)}</p>
                      <input value={myCommName} onChange={(e) => setMyCommName(e.target.value)} className="input-line mb-3" placeholder="Nama Komunitas" />
                      <div className="flex gap-2">
                        <button onClick={() => setTempLoc(null)} className="flex-1 btn-pill btn-ghost-dark !py-2.5 text-[9px]">Batal</button>
                        <button onClick={saveMyComm} className="flex-1 btn-pill btn-red !py-2.5 text-[9px]">Simpan</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ PROFIL ============ */}
        {tab === 'profile' && (
          <>
            <div className="dash-item rounded-2xl bg-[#12283c] text-[#f2efe6] p-8 md:p-10 mb-6 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 border-2 border-[#e62b2b]/30 rounded-full" />
              <div className="grid grid-cols-12 gap-6 relative z-10">
                <div className="col-span-12 md:col-span-4 flex flex-col items-center md:items-start gap-4">
                  <div className="w-28 h-28 rounded-2xl bg-[#e62b2b] flex items-center justify-center text-5xl font-black">{user?.name?.charAt(0).toUpperCase()}</div>
                  <div><h2 className="text-2xl font-black">{user?.name}</h2><p className="font-mono text-[10px] text-[#e62b2b] font-bold mt-1">KOMUNITAS</p></div>
                </div>
                <div className="col-span-12 md:col-span-8">
                  <p className="text-sm leading-relaxed opacity-80 mb-6">{PROFILE.bio}</p>
                  <div className="grid grid-cols-3 gap-px bg-white/10 rounded-xl overflow-hidden">
                    {[{ v: 9, l: 'TOTAL PROYEK' }, { v: 7, l: 'SELESAI' }, { v: 1, l: 'KOMUNITAS' }].map((s, i) => (
                      <div key={i} className="bg-[#12283c] p-4"><div className="text-3xl font-black tabular-nums text-[#e62b2b]">{s.v}</div><p className="label-mono mt-1">{s.l}</p></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-7">
                <div className="dash-item card-light p-7">
                  <h3 className="text-xl font-black mb-5">Riwayat Proyek</h3>
                  <div className="space-y-0">
                    {PROFILE.timeline.map((t, i) => (
                      <div key={i} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
                        <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-[#12283c] ${t.status === 'selesai' ? 'bg-[#c9ecd9]' : 'bg-[#e62b2b]'}`} />
                        <div className="flex items-center gap-3 mb-2"><span className="font-mono text-[10px] font-bold">{t.date}</span>{chip(t.status === 'selesai' ? 'green' : 'red', t.status.toUpperCase())}</div>
                        <h4 className="font-black text-base mb-1">{t.title}</h4>
                        <p className="text-xs text-[#12283c]/60">{t.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-5 space-y-6">
                <div className="dash-item rounded-xl bg-[#c9ecd9] text-[#12283c] p-7">
                  <h3 className="text-xl font-black mb-5">Proyek Terverifikasi</h3>
                  <div className="space-y-5">
                    {PROFILE.track.map((t, i) => (
                      <div key={i} className="border-b-2 border-[#12283c]/15 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 flex-wrap mb-2"><span className="font-mono text-[10px] font-bold">{t.date}</span><span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">✓ SELESAI</span></div>
                        <h4 className="font-black text-base mb-1">{t.t}</h4>
                        <p className="text-sm italic leading-relaxed">{t.testimonial}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dash-item rounded-xl bg-[#e62b2b] text-white p-7">
                  <h3 className="text-xl font-black mb-5">Testimoni Talenta</h3>
                  <div className="space-y-5">
                    {PROFILE.testimoni.map((t, i) => (
                      <div key={i} className="border-b-2 border-white/20 pb-4 last:border-0">
                        <p className="text-sm italic leading-relaxed mb-2">{t.text}</p>
                        <p className="font-mono text-[10px] opacity-70">— {t.from} · {t.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ PENGATURAN ============ */}
        {tab === 'setting' && (
          <>
            <div className="dash-item mb-6"><h1 className="text-4xl md:text-5xl font-black tracking-tight">Pengaturan</h1><p className="label-mono mt-2">PREFERENSI AKUN</p></div>
            <div className="grid grid-cols-12 gap-6">
              <aside className="col-span-12 lg:col-span-3">
                <div className="lg:sticky lg:top-28 flex lg:flex-col gap-2 overflow-x-auto">
                  {SETTINGS_NAV.map((s) => (
                    <button key={s.id} onClick={() => setSettingsTab(s.id)} className={`shrink-0 rounded-full px-5 py-3 text-[10px] font-black uppercase tracking-wider transition-colors ${settingsTab === s.id ? 'bg-[#12283c] text-[#f2efe6]' : 'bg-white/60 border border-[#12283c]/15 hover:border-[#12283c]'}`}>{s.l}</button>
                  ))}
                </div>
              </aside>
              <div className="col-span-12 lg:col-span-9 space-y-6">
                {settingsTab === 'profil' && (
                  <div className="dash-item card-light p-7">
                    <span className="label-mono !text-[#e62b2b] !opacity-100">IDENTITAS</span>
                    <h3 className="text-xl font-black mt-1 mb-5">Informasi Profil</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div><label className="field-label">Nama</label><input defaultValue={user?.name} className="input-line" /></div>
                      <div><label className="field-label">Email</label><input defaultValue={`${user?.name?.toLowerCase().replace(' ', '.')}@susi.id`} className="input-line" /></div>
                      <div className="md:col-span-2"><label className="field-label">Bio</label><textarea defaultValue={PROFILE.bio} className="input-line h-24 resize-none" /></div>
                    </div>
                    <button className="btn-pill btn-navy w-full mt-6">SIMPAN →</button>
                  </div>
                )}
                {settingsTab === 'notifikasi' && (
                  <div className="dash-item card-light p-7 space-y-3">
                    <h3 className="text-xl font-black mb-2">Kelola Notifikasi</h3>
                    <SetToggle on={sets.notifTalenta} onClick={() => setSets((s) => ({ ...s, notifTalenta: !s.notifTalenta }))} label="Pengajuan dari Talenta" sub="Notifikasi saat talenta mengajukan" />
                    <SetToggle on={sets.notifDiskusi} onClick={() => setSets((s) => ({ ...s, notifDiskusi: !s.notifDiskusi }))} label="Balasan Forum" sub="Pemberitahuan balasan diskusi" />
                    <SetToggle on={sets.email} onClick={() => setSets((s) => ({ ...s, email: !s.email }))} label="Email" sub="Ringkasan harian ke email" />
                    <SetToggle on={sets.whatsapp} onClick={() => setSets((s) => ({ ...s, whatsapp: !s.whatsapp }))} label="WhatsApp" sub="Notifikasi penting via WhatsApp" />
                  </div>
                )}
                {settingsTab === 'privasi' && (
                  <div className="dash-item card-light p-7 space-y-3">
                    <h3 className="text-xl font-black mb-2">Kontrol Data & Visual</h3>
                    <SetToggle on={sets.lokasi} onClick={() => setSets((s) => ({ ...s, lokasi: !s.lokasi }))} label="Tampilkan Sektor Lokasi" sub="Perlihatkan lokasi di Map publik" />
                  </div>
                )}
                {settingsTab === 'integrasi' && (
                  <div className="dash-item card-light p-7">
                    <h3 className="text-xl font-black mb-5">Akun Terhubung</h3>
                    <div className="rounded-xl border border-[#12283c]/15 p-5 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#12283c] text-white flex items-center justify-center text-2xl font-black">G</div>
                        <div><p className="font-black">Google</p><p className="font-mono text-[10px] opacity-50">TERHUBUNG</p></div>
                      </div>
                      <button className="btn-pill btn-ghost-dark !py-2.5 text-[10px]">PUTUSKAN</button>
                    </div>
                  </div>
                )}
                {settingsTab === 'bahaya' && (
                  <>
                    <div className="dash-item card-light p-7">
                      <h3 className="text-xl font-black mb-5">Keluar dari Akun</h3>
                      <button onClick={onLogout} className="btn-pill btn-navy w-full">KELUAR →</button>
                    </div>
                    <div className="dash-item card-light p-7 border-l-4 border-l-[#e62b2b]">
                      <h3 className="text-xl font-black mb-3">Hapus Akun Permanen</h3>
                      <p className="text-sm text-[#12283c]/70 mb-5">Kamu Tidak Dapat Memulihkan Akunmu Lagi</p>
                      <button onClick={() => setConfirmDelete(true)} className="btn-pill btn-ghost-dark w-full">HAPUS AKUN</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ============ MODAL HAPUS AKUN ============ */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[500] bg-[#0e2233]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12283c] text-[#f2efe6] w-full max-w-md border border-white/10 rounded-2xl p-8 relative">
              <button onClick={() => setConfirmDelete(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl font-black hover:bg-[#e62b2b] hover:border-[#e62b2b]">×</button>
              <h3 className="text-2xl font-black mt-2 mb-4">Yakin?</h3>
              <p className="text-sm opacity-70 mb-6">Ketik <span className="font-mono font-black bg-[#e62b2b] text-white px-2 py-0.5 rounded">HAPUS</span> untuk konfirmasi.</p>
              <input className="input-line input-line-dark mb-5" placeholder='Ketik "HAPUS"' />
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 btn-pill btn-ghost-light !py-3 text-[10px]">Batal</button>
                <button className="flex-1 btn-pill btn-red !py-3 text-[10px]">HAPUS</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AiAgent role="komunitas" />
    </DashShell>
  );
}