import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ProjSteps from '../../components/common/ProjSteps';
import SetToggle from '../../components/common/SetToggle';
import VerifyModal from '../../components/modals/VerifyModal';

export default function DashboardRequester({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [filter, setFilter] = useState('SEMUA');
  const [sets, setSets] = useState({ email: true, lokasi: true, whatsapp: false, notifTalenta: true, notifDiskusi: true, notifPengaduan: true, darkMode: false, bahasa: 'ID' });

  const [selectedComm, setSelectedComm] = useState(null);
  const [selectedProj, setSelectedProj] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const [testi, setTesti] = useState('');
  const [replyText, setReplyText] = useState('');

  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [ntTitle, setNtTitle] = useState('');
  const [ntBody, setNtBody] = useState('');
  const [topicFilter, setTopicFilter] = useState('SEMUA');

  const [settingsTab, setSettingsTab] = useState('profil');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const rootRef = useRef(null);
  const boardRef = useRef(null);
  const drag = useRef({ down: false, startX: 0, left: 0, moved: false });

  const [discussions, setDiscussions] = useState([
    {
      id: 1, user: 'Budi Santoso', comm: 'Karang Taruna Mekar', time: '2J', cat: 'DISKUSI', text: 'Ada yang pernah bikin aplikasi absensi digital? Butuh referensi buat kegiatan pemuda.', x: 90, y: 70, rot: -3, color: '#FADADD', replies: [
        { user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '1J', text: 'Kami pernah pakai Google Forms + spreadsheet.' },
      ]
    },
    { id: 2, user: 'Ibu Siti Aminah', comm: 'PKK RW 05', time: '5J', cat: 'TANYA', text: 'Mau tanya, ada komunitas yang sudah bikin website profil?', x: 430, y: 140, rot: 2, color: '#D8E9F7', replies: [] },
    { id: 3, user: 'Haji Rahmat', comm: 'Paguyuban Pedagang', time: '1J', cat: 'INFO', text: 'Info: pelatihan foto produk gratis, Sabtu di pasar!', x: 780, y: 90, rot: -2, color: '#FDF3C7', replies: [] },
    { id: 4, user: 'Bidan Rina', comm: 'Posyandu Melati', time: '3J', cat: 'TANYA', text: 'Ada yang bisa bantu bikin form penimbangan digital?', x: 250, y: 420, rot: 3, color: '#DFF0D9', replies: [] },
    { id: 5, user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '4J', cat: 'DISKUSI', text: 'Usul: sesi sharing edit foto bulanan antar komunitas.', x: 640, y: 460, rot: -4, color: '#FADADD', replies: [] },
  ]);
  const [madingView, setMadingView] = useState('board'); // 'board' | 'tempel' | 'detail'
  const [activeTopic, setActiveTopic] = useState(null);
  const [ntText, setNtText] = useState('');
  const [ntCat, setNtCat] = useState('DISKUSI');
  const madingWrapRef = useRef(null);
  const madingCanvasRef = useRef(null);
  const dragRef = useRef({ down: false, sx: 0, sy: 0, bx: 0, by: 0, moved: false });
  const noteDrag = useRef({ id: null, sx: 0, sy: 0, ox: 0, oy: 0, nx: 0, ny: 0, moved: false, el: null });
  const panRef = useRef({ x: 0, y: 0 });
  const CANVAS_W = 1600, CANVAS_H = 1000;

  const clampPan = (x, y) => {
    const vp = madingWrapRef.current;
    const minX = vp ? Math.min(0, vp.clientWidth - CANVAS_W) : -CANVAS_W;
    const minY = vp ? Math.min(0, vp.clientHeight - CANVAS_H) : -CANVAS_H;
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) };
  };
  const onBoardUp = () => { dragRef.current.down = false; setTimeout(() => { dragRef.current.moved = false; }, 0); };
  /* ===== DRAG SATUAN CATATAN (pindah posisi) ===== */
  const onNoteDown = (e, t) => {
    e.stopPropagation(); // biar papan TIDAK ikut ke-pan
    const d = noteDrag.current;
    d.id = t.id; d.el = e.currentTarget;
    d.sx = e.clientX; d.sy = e.clientY;
    d.ox = t.x; d.oy = t.y; d.nx = t.x; d.ny = t.y;
    d.moved = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    // efek "diangkat" saat dipegang
    gsap.to(e.currentTarget, { scale: 1.07, rotation: 0, zIndex: 50, boxShadow: '12px 12px 0 rgba(0,0,0,0.3)', duration: 0.2, ease: 'power2.out' });
  };
  const onNoteMove = (e, t) => {
    const d = noteDrag.current;
    if (d.id !== t.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    d.nx = Math.max(8, Math.min(CANVAS_W - 270, d.ox + dx));
    d.ny = Math.max(8, Math.min(CANVAS_H - 170, d.oy + dy));
    gsap.set(d.el, { left: d.nx, top: d.ny });
  };
  const onNoteUp = (e, t) => {
    const d = noteDrag.current;
    if (d.id !== t.id) return;
    // efek "ditempel lagi"
    gsap.to(d.el, { scale: 1, rotation: t.rot, zIndex: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' });
    if (d.moved) {
      setDiscussions((ds) => ds.map((x) => (x.id === t.id ? { ...x, x: d.nx, y: d.ny } : x)));
    } else {
      openTopic(t); // cuma klik → buka detail
    }
    d.id = null;
  };

  const openTopic = (t) => {
    if (dragRef.current.moved) return; // jangan buka kalau user sedang drag
    setActiveTopic(t);
    setMadingView('detail');
  };

  const submitTopic = () => {
    if (!ntText.trim()) return;
    const colors = ['#FADADD', '#D8E9F7', '#DFF0D9', '#FDF3C7'];
    const t = {
      id: Date.now(), user: user?.name || first, comm: 'Komunitas Anda', time: 'BARU SAJA', cat: ntCat,
      text: ntText.trim(), replies: [],
      x: 150 + Math.random() * (CANVAS_W - 500), y: 80 + Math.random() * (CANVAS_H - 400),
      rot: Math.round(Math.random() * 8 - 4), color: colors[Math.floor(Math.random() * colors.length)],
    };
    setDiscussions((d) => [t, ...d]);
    setNtText(''); setNtCat('DISKUSI');
    setMadingView('board');
    setTimeout(() => {
      gsap.fromTo(`#note-${t.id}`, { autoAlpha: 0, y: -70, scale: 0.8, rotation: t.rot - 8 }, { autoAlpha: 1, y: 0, scale: 1, rotation: t.rot, duration: 0.6, ease: 'back.out(1.7)' });
    }, 60);
  };

  /* animasi catatan "jatuh ditempel" setiap kali papan tampil */
  useEffect(() => {
    if (tab !== 'komunitas' || madingView !== 'board') return;
    if (madingWrapRef.current) {
      const vp = madingWrapRef.current;
      const p = clampPan(-(CANVAS_W - vp.clientWidth) / 2, -(CANVAS_H - vp.clientHeight) / 2);
      panRef.current = p;
      gsap.set(madingCanvasRef.current, { x: p.x, y: p.y });
    }
    gsap.fromTo('.mading-note',
      { autoAlpha: 0, y: -70, scale: 0.85, rotation: (i, el) => (parseFloat(el.dataset.rot) || 0) - 6 },
      { autoAlpha: 1, y: 0, scale: 1, rotation: (i, el) => parseFloat(el.dataset.rot) || 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)', overwrite: true });
  }, [madingView, tab]);


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



  /* ===== DATA & CONSTANTS ===== */
  const first = (user?.name || 'Warga').split(' ')[0];

  const NAV = [
    { id: 'beranda', n: '01', l: 'BERANDA' },
    { id: 'komunitas', n: '02', l: 'KOMUNITAS' },
    { id: 'map', n: '03', l: 'MAP' },
    { id: 'profile', n: '04', l: 'PROFIL' },
    { id: 'setting', n: '05', l: 'PENGATURAN' },
  ];

  const COLS = [
    { id: 'DALAM ANTRIAN', l: 'DALAM ANTRIAN' },
    { id: 'DIPROSES', l: 'DIPROSES' },
    { id: 'MENUNGGU', l: 'MENUNGGU VERIFIKASI' },
    { id: 'SELESAI', l: 'SELESAI DIVERIFIKASI' },
  ];

  const TOPIC_CAT = {
    BANTUAN: { bg: 'bg-[#FADADD]', tag: 'bg-[#E4572E] text-white', pin: '#E4572E' },
    DISKUSI: { bg: 'bg-[#D8E9F7]', tag: 'bg-[#2274A5] text-white', pin: '#2274A5' },
    TIPS: { bg: 'bg-[#DFEBD8]', tag: 'bg-[#3E9B4F] text-white', pin: '#3E9B4F' },
    INFO: { bg: 'bg-[#FBF0DA]', tag: 'bg-[#F2A93B] text-black', pin: '#F2A93B' },
  };

  const NOTIF_META = {
    talenta: { c: '#FF5733', l: 'TALENTA' },
    verifikasi: { c: '#0E7C66', l: 'VERIFIKASI' },
    diskusi: { c: '#000000', l: 'DISKUSI' },
    sistem: { c: '#9CA3AF', l: 'SISTEM' },
  };

  const [notifs, setNotifs] = useState([
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

  const [topics, setTopics] = useState([
    {
      id: 1, cat: 'BANTUAN', title: 'Ada yang pernah bikin aplikasi absensi digital?', user: 'Budi Santoso', comm: 'Karang Taruna Mekar', time: '2J', views: 132,
      body: 'Kami mau bikin absensi digital untuk kegiatan pemuda. Ada yang punya pengalaman pakai Google Forms, atau malah bikin aplikasi sendiri? Butuh tips biar nggak ribet.',
      replies: [
        { user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '1J', text: 'Kami pernah pakai Google Forms + spreadsheet, lumayan buat awal.' },
        { user: 'Ibu Siti Aminah', comm: 'PKK RW 05', time: '1J', text: 'Kami dulu dibantu talenta SUSI, coba ajukan saja di dasbor.' },
      ]
    },
    {
      id: 2, cat: 'DISKUSI', title: 'Ada yang sudah bikin website profil komunitas?', user: 'Ibu Siti Aminah', comm: 'PKK RW 05', time: '5J', views: 98,
      body: 'PKK RW 05 mau punya website profil sederhana. Ada komunitas yang sudah pernah? Bagaimana prosesnya?', replies: []
    },
    {
      id: 3, cat: 'TIPS', title: 'Tips rapat warga biar nggak alot', user: 'Haji Rahmat', comm: 'Paguyuban Pedagang', time: '1M', views: 210,
      body: 'Bagikan pengalaman: pakai agenda tertulis + timer per topik, rapat warga jadi 45 menit saja.',
      replies: [{ user: 'Budi Santoso', comm: 'Karang Taruna Mekar', time: '3M', text: 'Setuju, notulen juga wajib biar ada tindak lanjut.' }]
    },
    {
      id: 4, cat: 'INFO', title: 'Info: pelatihan desain gratis untuk karang taruna', user: 'Farhan Maulana', comm: 'Hobi Fotografi', time: '3J', views: 154,
      body: 'Kami buka kolaborasi pelatihan desain gratis untuk karang taruna sektor Timur–Selatan. Kuota 20 orang.', replies: []
    },
  ]);

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
      { date: '21 AGU 2026', title: 'Website Profil PKK', status: 'selesai', talent: 'Khalifa H.', note: 'Ditandai Selesai Pukul 05:00 WIB' },
      { date: '31 OKT 2026', title: 'Rekap Iuran Digital', status: 'proses', talent: 'Derien A.', note: 'Ditandai Selesai Pukul 12:00 WIB' },
    ],
    testimoni: [
      { text: '"Aplikasi iuran sangat membantu!"', from: 'Derien A.', proyek: 'Aplikasi Iuran PKK', time: '1M lalu' },
      { text: '"Bersedia menjelaskan dengan jelas."', from: 'Khalifa H.', proyek: 'Website Profil', time: '2M lalu' },
    ],
    sektorStats: [{ l: 'Barat-Utara', v: 5 }, { l: 'Timur-Utara', v: 2 }, { l: 'Barat-Selatan', v: 1 }],
    komunitasAktif: [{ n: 'PKK RW 05', s: 'BARAT–UTARA', role: 'Ketua' }],
    track: [
      { date: '21 AGU 2026', t: 'Website Profil PKK', comm: 'Khalifa H.', note: 'Diterima oleh 48 anggota.', testimonial: '"Pengerjaan rapi, tepat waktu, dan sabar menjelaskan."' },
      { date: '12 JUN 2026', t: 'Formulir Pendaftaran Digital', comm: 'Ezra P.', note: 'Digunakan 12 keluarga baru.', testimonial: '"Proses cepat, hasilnya mudah dipakai warga."' },
    ],
  };

  const SETTINGS_NAV = [
    { id: 'profil', l: 'INFORMASI DETAIL', i: '◉' },
    { id: 'notifikasi', l: 'NOTIFIKASI', i: '◈' },
    { id: 'privasi', l: 'PRIVASI & TAMPILAN', i: '◐' },
    { id: 'integrasi', l: 'INTEGRASI', i: '⇋' },
    { id: 'bahaya', l: 'PENGATURAN LANJUTAN', i: '⚠' },
  ];

  /* ===== DERIVED VALUES ===== */
  const unread = notifs.filter((n) => !n.read).length;
  const filteredTopics = topicFilter === 'SEMUA' ? topics : topics.filter((t) => t.cat === topicFilter);

  /* ===== HANDLERS ===== */
  const markAll = () => setNotifs(notifs.map((n) => ({ ...n, read: true })));
  const markOne = (id) => setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const projBadge = (s) => {
    const m = {
      'DALAM ANTRIAN': 'bg-white text-black border-2 border-black',
      DIPROSES: 'bg-black text-white',
      MENUNGGU: 'bg-yellow-300 text-black',
      SELESAI: 'bg-[#0E7C66] text-white',
    };
    return <span className={`text-[9px] font-mono font-bold px-2 py-1 ${m[s]}`}>{s}</span>;
  };

  const verifyProj = () => {
    const updated = { ...selectedProj, status: 'SELESAI', testi: testi.trim() ? `"${testi.trim()}"` : '"Terima kasih, pengerjaan memuaskan."', date: 'HARI INI' };
    setProjects((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProj(updated);
    setTesti('');
  };

  const reviseProj = () => {
    const updated = { ...selectedProj, status: 'DIPROSES' };
    setProjects((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProj(updated);
    setTesti('');
  };

  /* ===== DRAG PAPAN MADING (PAN BEBAS 2 ARAH) ===== */
  const onBoardDown = (e) => {
    const d = dragRef.current;
    d.down = true; d.moved = false;
    d.sx = e.clientX; d.sy = e.clientY;
    d.bx = panRef.current.x; d.by = panRef.current.y;
  };
  const onBoardMove = (e) => {
    const d = dragRef.current;
    if (!d.down) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    const p = clampPan(d.bx + dx, d.by + dy);
    panRef.current = p;
    gsap.set(madingCanvasRef.current, { x: p.x, y: p.y });
  };

  const postTopic = () => {
    if (!ntTitle.trim() || !ntBody.trim()) return;
    setTopics((ts) => [{
      id: Date.now(),
      cat: ntCat,
      title: ntTitle.trim(),
      user: user?.name || first,
      comm: 'Komunitas Anda',
      time: 'BARU SAJA',
      views: 0,
      body: ntBody.trim(),
      replies: []
    }, ...ts]);
    setNtTitle(''); setNtBody(''); setNewTopicOpen(false);
  };

  const postReply = (id) => {
    if (!replyText.trim()) return;
    const newReply = { user: user?.name || first, comm: 'Komunitas Anda', time: 'BARU SAJA', text: replyText.trim() };
    setDiscussions((d) => d.map((x) => (x.id === id ? { ...x, replies: [...x.replies, newReply] } : x)));
    setActiveTopic((at) => (at && at.id === id ? { ...at, replies: [...at.replies, newReply] } : at));
    setReplyText('');
  };
  const postTopicReply = () => { if (selectedTopic) postReply(selectedTopic.id); };

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

  /* ===== EFFECTS ===== */
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
  }, [tab, selectedComm, settingsTab, selectedProj]);


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
              <p className="text-[9px] font-mono text-[#FF5733] font-bold mt-0.5">KOMUNITAS</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">KELUAR AKUN</button>
        </div>
      </div>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white border-r-2 border-black z-40 flex-col justify-between">
        <div className="p-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 mb-4">Dashboard Komunitas</p>
          <div className="space-y-2">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => { setTab(n.id); setSelectedComm(null); setMapComm(null); setMarkMode(false); setTempLoc(null); setSelectedTopic(null); setSelectedProj(null); }} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${tab === n.id ? 'bg-black text-white shadow-[4px_4px_0_0_#FF5733]' : 'hover:bg-black/5'}`}>
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
            <button key={n.id} onClick={() => { setTab(n.id); setSelectedComm(null); setMapComm(null); setMarkMode(false); setTempLoc(null); setSelectedTopic(null); setSelectedProj(null); }} className={`shrink-0 px-4 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${tab === n.id ? 'bg-black text-white border-black' : 'border-black/20'}`}>
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
              {selectedProj ? (
                /* ========== HALAMAN DETAIL PROJEK ========== */
                <>
                  <div className="dash-item mb-6">
                    <button onClick={() => setSelectedProj(null)} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← KEMBALI KE BERANDA</button>
                  </div>

                  {/* HEADER PROJEK */}
                  <div className="dash-item border-2 border-black bg-white p-8 md:p-10 mb-6">
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono font-bold border-2 border-black px-2 py-1">{selectedProj.cat}</span>
                        {projBadge(selectedProj.status)}
                      </div>
                      <span className="text-[9px] font-mono opacity-50">ID PROJEK: PRJ-0{selectedProj.id}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-4">{selectedProj.t}</h1>
                    <p className="text-sm opacity-70 leading-relaxed max-w-3xl">{selectedProj.d}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black border-2 border-black mt-6">
                      <div className="bg-white p-4"><p className="text-[9px] font-mono opacity-50">TALENTA</p><p className="text-sm font-black">{selectedProj.talent || '— BELUM ADA —'}</p></div>
                      <div className="bg-white p-4"><p className="text-[9px] font-mono opacity-50">DEADLINE</p><p className="text-sm font-black">{selectedProj.deadline || '—'}</p></div>
                      <div className="bg-white p-4"><p className="text-[9px] font-mono opacity-50">DIAJUKAN</p><p className="text-sm font-black">12 JUL 2026</p></div>
                      <div className="bg-white p-4"><p className="text-[9px] font-mono opacity-50">PEMILIK</p><p className="text-sm font-black">{first} (ANDA)</p></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-6">
                    {/* KIRI: PROGRESS + LINI MASA */}
                    <div className="col-span-12 lg:col-span-7 space-y-6">
                      <div className="dash-item border-2 border-black bg-white p-7">
                        <h3 className="text-xl font-black mb-6">Progress Projek</h3>
                        <ProjSteps status={selectedProj.status} />
                      </div>
                      <div className="dash-item border-2 border-black bg-white p-7">
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
                            <div key={i} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-black/10 last:border-transparent">
                              <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-black ${ev.done ? 'bg-[#0E7C66]' : 'bg-white'}`} />
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-[10px] font-mono font-bold">{ev.d}</span>
                              </div>
                              <p className="text-sm font-bold">{ev.t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* KANAN: PANEL VERIFIKASI */}
                    <div className="col-span-12 lg:col-span-5 space-y-6">
                      <div className="dash-item border-2 border-black bg-white p-7">
                        <h3 className="text-xl font-black mb-2">Verifikasi Proyek</h3>
                        <p className="text-[10px] font-mono opacity-50 mb-5">VERIFIKASI HANYA DAPAT DILAKUKAN KETIKA PROYEK SUDAH SELESAI.</p>

                        {selectedProj.status === 'DALAM ANTRIAN' && (
                          <div className="border-2 border-dashed border-black/30 p-5 text-[10px] font-mono font-bold opacity-60">🔒 MENUNGGU TALENTA MELAMAR — ANDA TIDAK DAPAT MELAKUKAN VERIFIKASI.</div>
                        )}
                        {selectedProj.status === 'DIPROSES' && (
                          <div className="border-2 border-dashed border-black/30 p-5 text-[10px] font-mono font-bold opacity-60">🔒 VERIFIKASI TERKUNCI — TERBUKA SETELAH TALENTA MENANDAI SELESAI.</div>
                        )}
                        {selectedProj.status === 'MENUNGGU' && (
                          <div className="space-y-4">
                            <div className="border-2 border-[#0E7C66] bg-[#0E7C66]/5 p-4 text-[10px] font-mono font-bold text-[#0E7C66]">✓ TALENTA MENANDAI SELESAI · {selectedProj.selesai}</div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Testimoni (opsional)</label>
                              <textarea value={testi} onChange={(e) => setTesti(e.target.value)} className="w-full border-2 border-black/20 p-3 text-xs h-20 resize-none outline-none focus:border-[#FF5733]" placeholder='Contoh: "Pengerjaan cepat & jelas..."' />
                            </div>
                            <button onClick={verifyProj} className="w-full bg-[#0E7C66] text-white py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">✓ Tandai Selesai</button>
                            <button onClick={reviseProj} className="w-full border-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">✕ Minta Perbaikan</button>
                          </div>
                        )}
                        {selectedProj.status === 'SELESAI' && (
                          <div className="border-2 border-[#0E7C66]/40 bg-[#0E7C66]/5 p-5">
                            <p className="text-sm italic">{selectedProj.testi}</p>
                            <p className="text-[9px] font-mono opacity-60 mt-2">✓ TERVERIFIKASI · {selectedProj.date}</p>
                          </div>
                        )}
                      </div>
                      <div className="dash-item border-2 border-black bg-[#FAFAFA] p-5">
                        <p className="text-[10px] font-mono opacity-60 leading-relaxed">JIKA ANDA MENGALAMI MASALAH KOMUNIKASI DENGAN TALENTA, HUBUNGI KAMI:</p>
                        <p className="text-[15px] font-bold opacity-60 leading-relaxed">+62 22 123 4567</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ========== PAPAN PROJEK (KARTU BISA DIKLIK) ========== */
                <>
                  <div className="dash-item border-2 border-black bg-white p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
                    <div>
                      <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 mb-3">Halo, {first}.</h1>
                      <p className="text-sm opacity-60 max-w-xl leading-relaxed">Kelola proyek komunitasmu, atau mulai diskusi dengan komunitas lain!</p>
                    </div>
                    <button onClick={() => navigateTo('request')} className="bg-[#FF5733] text-white px-8 py-5 text-xs font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-black transition-all">
                      + Ajukan Pengaduan
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-black border-2 border-black mb-6">
                    {[{ t: projects.filter(p => p.status === 'DALAM ANTRIAN').length, l: 'Kebutuhan aktif' }, { t: projects.filter(p => p.status === 'DIPROSES').length, l: 'Dalam proses' }, { t: projects.filter(p => p.status === 'SELESAI').length, l: 'Selesai' }].map((s, i) => (
                      <div key={i} className="dash-item bg-white p-6 hover:bg-[#FF5733] hover:text-white transition-colors">
                        <div className="text-4xl md:text-5xl font-black tabular-nums"><span className="counter" data-target={s.t}>{s.t}</span></div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60 mt-1">{s.l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="dash-item flex items-center justify-between flex-wrap gap-4 mb-4">
                    <div>
                      <h3 className="text-2xl font-black">Papan Projek & Verifikasi</h3>
                      <p className="text-[10px] font-mono opacity-50 mt-1">KLIK KARTU UNTUK DETAIL PROGRESS & VERIFIKASI</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['SEMUA', 'PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'].map((c) => (
                        <button key={c} onClick={() => setFilter(c)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${filter === c ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
                    {COLS.map((col) => {
                      const items = projects.filter((p) => p.status === col.id && (filter === 'SEMUA' || p.cat === filter));
                      return (
                        <div key={col.id} className="dash-item border-2 border-black bg-white flex flex-col">
                          <div className="flex items-center justify-between p-4 border-b-2 border-black">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider">{col.l}</p>
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5">{items.length}</span>
                          </div>
                          <div className="p-4 space-y-4">
                            {items.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => setSelectedProj(p)}
                                className="border-2 border-black/15 hover:border-black p-4 transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FF5733] cursor-pointer"
                              >
                                <span className="inline-block text-[9px] font-mono font-bold border-2 border-black px-2 py-0.5 mb-2">{p.cat}</span>
                                <h4 className="font-black text-base leading-tight mb-1">{p.t}</h4>
                                <p className="text-[11px] opacity-60 leading-relaxed mb-3">{p.d}</p>
                                {p.status === 'DALAM ANTRIAN' && <p className="text-[9px] font-mono opacity-50">MENUNGGU TALENTA</p>}
                                {p.status === 'DIPROSES' && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="w-7 h-7 bg-black text-white flex items-center justify-center text-[10px] font-black">{p.talent?.charAt(0)}</span>
                                      <div><p className="text-[10px] font-black">{p.talent}</p><p className="text-[9px] font-mono opacity-50">DEADLINE {p.deadline}</p></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono font-bold mb-1"><span>PROGRES</span><span>{p.progress}%</span></div>
                                    <div className="h-2 bg-black/10"><div className="h-full bg-[#FF5733]" style={{ width: `${p.progress}%` }} /></div>
                                  </div>
                                )}
                                {p.status === 'MENUNGGU' && (
                                  <div className="border-2 border-[#0E7C66] bg-[#0E7C66]/5 p-3 text-[9px] font-mono font-bold text-[#0E7C66]">✓ TALENTA SELESAI · {p.selesai}</div>
                                )}
                                {p.status === 'SELESAI' && (
                                  <div className="border-2 border-[#0E7C66]/40 bg-[#0E7C66]/5 p-3">
                                    <p className="text-[10px] italic">{p.testi}</p>
                                    <p className="text-[9px] font-mono opacity-60 mt-1">✓ TERVERIFIKASI · {p.date} · REPUTASI +1</p>
                                  </div>
                                )}
                                <span className="block mt-3 text-[9px] font-mono font-bold text-[#FF5733]">LIHAT DETAIL →</span>
                              </div>
                            ))}
                            {items.length === 0 && <p className="text-center text-[10px] font-mono opacity-40 py-6">KOLOM KOSONG</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ===== DETAIL TOPIK MADING ===== */}
          {tab === 'komunitas' && selectedTopic && (() => {
            const t = topics.find((x) => x.id === selectedTopic.id) || selectedTopic;
            const cat = TOPIC_CAT[t.cat];
            return (
              <>
                <div className="dash-item mb-6 flex items-center justify-between flex-wrap gap-3">
                  <button onClick={() => setSelectedTopic(null)} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← KEMBALI KE MADING</button>
                  <span className="text-[9px] font-mono opacity-50">{t.views} DILIHAT · {t.replies.length} BALASAN</span>
                </div>

                <div className="dash-item border-2 border-black bg-white p-8 md:p-10 mb-6 relative">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,.3)]" style={{ background: cat.pin }} />
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className={`text-[9px] font-mono font-bold px-2 py-1 ${cat.tag}`}>{t.cat}</span>
                    <span className="text-[9px] font-mono opacity-50">{t.time} LALU</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-3">{t.title}</h1>
                  <p className="text-[10px] font-mono opacity-50 mb-5">DITEMPEL OLEH {t.user.toUpperCase()} · {t.comm.toUpperCase()}</p>
                  <p className="text-sm md:text-base leading-relaxed opacity-80">{t.body}</p>
                </div>

                <h3 className="text-xl font-black mb-4">{t.replies.length} BALASAN KOMUNITAS</h3>
                <div className="space-y-4 mb-6">
                  {t.replies.map((r, i) => (
                    <div key={i} className="dash-item border-2 border-black bg-white p-5 flex items-start gap-3">
                      <span className="w-10 h-10 bg-black text-white font-black flex items-center justify-center shrink-0">{r.user.charAt(0)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-black text-sm">{r.user}</p>
                          <span className="text-[9px] font-mono opacity-50">· {r.comm} · {r.time}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{r.text}</p>
                      </div>
                    </div>
                  ))}
                  {t.replies.length === 0 && (
                    <p className="dash-item border-2 border-dashed border-black/30 bg-white p-6 text-center text-xs font-mono opacity-50">BELUM ADA BALASAN — JADI YANG PERTAMA BERDISKUSI.</p>
                  )}
                </div>

                <div className="dash-item border-2 border-black bg-white p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3">IKUT BERDISKUSI</p>
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] resize-none h-24" placeholder="Tulis balasanmu..." />
                  <div className="flex justify-end mt-3">
                    <button onClick={postTopicReply} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest bg-[#FF5733] text-white hover:bg-black transition-colors">KIRIM BALASAN →</button>
                  </div>
                </div>
              </>
            );
          })()}

          {tab === 'komunitas' && !selectedComm && (
            <>
              {/* ========== VIEW: PAPAN MADING (DRAG BEBAS) ========== */}
              {madingView === 'board' && (
                <>
                  <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                    <div>
                      <h1 className="text-4xl md:text-5xl font-black tracking-tight">Mading Komunitas</h1>
                      <p className="text-[14  px] font-mono opacity-50 mt-2">Mulai Diskusi Bersama Komunitas Lain!</p>
                    </div>
                    <button onClick={() => setMadingView('tempel')} className="bg-[#FF5733] text-white px-6 py-4 text-[10px] font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-black transition-all">Buat Topik</button>
                  </div>
                  <div
                    ref={madingWrapRef}
                    onPointerDown={onBoardDown} onPointerMove={onBoardMove} onPointerUp={onBoardUp} onPointerCancel={onBoardUp}
                    className="dash-item relative h-[560px] border-2 border-black bg-[#EFEDE8] overflow-hidden cursor-grab active:cursor-grabbing select-none"
                    style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px', touchAction: 'none' }}
                  >
                    <div ref={madingCanvasRef} className="absolute top-0 left-0" style={{ width: CANVAS_W, height: CANVAS_H }}>
                      {discussions.map((t) => (
                        <div
                          key={t.id} id={`note-${t.id}`} data-rot={t.rot}
                          onPointerDown={(e) => onNoteDown(e, t)}
                          onPointerMove={(e) => onNoteMove(e, t)}
                          onPointerUp={(e) => onNoteUp(e, t)}
                          onPointerCancel={(e) => onNoteUp(e, t)}
                          onMouseEnter={(e) => { if (!noteDrag.current.id) gsap.to(e.currentTarget, { scale: 1.05, duration: 0.25, ease: 'power2.out' }); }}
                          onMouseLeave={(e) => { if (!noteDrag.current.id) gsap.to(e.currentTarget, { scale: 1, duration: 0.3, ease: 'power2.out' }); }}
                          className="mading-note absolute w-64 p-5 border-2 border-black shadow-[6px_6px_0_rgba(0,0,0,0.25)] cursor-grab active:cursor-grabbing"
                          style={{ left: t.x, top: t.y, background: t.color, touchAction: 'none' }}
                        >
                          <span className="absolute -top-3 left-1/2 -ml-2 w-4 h-4 rounded-full bg-[#FF5733] border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,0.3)]" />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] font-mono font-bold bg-black text-white px-1.5 py-0.5">{t.cat}</span>
                            <span className="text-[8px] font-mono opacity-50">{t.time}</span>
                          </div>
                          <p className="text-xs font-bold leading-relaxed mb-3">{t.text}</p>
                          <div className="flex items-center justify-between text-[9px] font-mono opacity-60">
                            <span className="truncate">{t.user} · {t.comm}</span>
                            <span className="shrink-0">💬 {t.replies.length}</span>
                          </div>
                          <span className="absolute bottom-1.5 right-2 text-[8px] font-mono opacity-40">⠿ geser</span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] font-mono font-bold px-3 py-1.5 pointer-events-none">DRAG PAPAN UNTUK MELIHAT DAFTAR TOPIK</div>
                  </div>
                </>
              )}

              {/* ========== VIEW: PAGE TEMPEL TOPIK ========== */}
              {madingView === 'tempel' && (
                <>
                  <div className="dash-item mb-6">
                    <button onClick={() => setMadingView('board')} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← KEMBALI KE MADING</button>
                  </div>
                  <div className="dash-item border-2 border-black bg-white p-8 md:p-10 max-w-2xl">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Buat Topik Baru</h1>
                    <p className="text-xs opacity-60 mb-6">Buat topik baru dan berdiskusi dengan komunitas lain!</p>
                    <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Kategori</label>
                    <div className="flex flex-wrap gap-1 mb-5">
                      {['DISKUSI', 'TANYA', 'INFO'].map((c) => (
                        <button key={c} onClick={() => setNtCat(c)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${ntCat === c ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{c}</button>
                      ))}
                    </div>
                    <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Isi Topik</label>
                    <textarea value={ntText} onChange={(e) => setNtText(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] h-28 resize-none" placeholder="Contoh: butuh ide buat acara 17-an..." />
                    <button onClick={submitTopic} disabled={!ntText.trim()} className={`w-full mt-5 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${ntText.trim() ? 'bg-[#FF5733] text-white hover:bg-black' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}>Buat Topik</button>
                  </div>
                </>
              )}

              {/* ========== VIEW: PAGE DETAIL TOPIK ========== */}
              {madingView === 'detail' && activeTopic && (
                <>
                  <div className="dash-item mb-6">
                    <button onClick={() => setMadingView('board')} className="text-[10px] font-mono font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">← KEMBALI KE MADING</button>
                  </div>
                  <div className="dash-item border-2 border-black p-8 md:p-10 mb-6" style={{ background: activeTopic.color }}>
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="text-[9px] font-mono font-bold bg-black text-white px-2 py-1">{activeTopic.cat}</span>
                      <span className="text-[9px] font-mono opacity-60">{activeTopic.time}</span>
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-3">{activeTopic.text}</h1>
                    <p className="text-[10px] font-mono opacity-60">DITEMPEL OLEH {activeTopic.user.toUpperCase()} · {activeTopic.comm.toUpperCase()}</p>
                  </div>
                  <h3 className="text-xl font-black mb-4">{activeTopic.replies.length} BALASAN</h3>
                  <div className="space-y-4 mb-6">
                    {activeTopic.replies.map((r, i) => (
                      <div key={i} className="dash-item border-2 border-black bg-white p-5 flex items-start gap-3">
                        <span className="w-10 h-10 bg-[#FF5733] text-white font-black flex items-center justify-center shrink-0">{r.user.charAt(0)}</span>
                        <div className="flex-1">
                          <p className="font-black text-sm">{r.user} <span className="text-[9px] font-mono opacity-50">· {r.comm} · {r.time}</span></p>
                          <p className="text-sm leading-relaxed mt-1">{r.text}</p>
                        </div>
                      </div>
                    ))}
                    {activeTopic.replies.length === 0 && <p className="dash-item border-2 border-dashed border-black/30 bg-white p-6 text-center text-xs font-mono opacity-50">BELUM ADA BALASAN — JADI YANG PERTAMA MENJAWAB.</p>}
                  </div>
                  <div className="dash-item border-2 border-black bg-white p-6">
                    <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Tulis Balasan</label>
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] h-24 resize-none" placeholder="Tanggapi topik ini..." />
                    <button
                      onClick={() => postReply(activeTopic.id)}
                      disabled={!replyText.trim()}
                      className={`w-full mt-4 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors ${replyText.trim() ? 'bg-[#0E7C66] text-white hover:bg-black' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}
                    >
                      Kirim Balasan →
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ===== TAB: MAP ===== */}
          {tab === 'map' && (
            <>
              <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Map Komunitas</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">{COMMUNITIES.length + myComms.length} KOMUNITAS TERDAFTAR</p>
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
                          <button onClick={saveMyComm} className="flex-1 bg-[#0E7C66] text-white py-2.5 text-[9px] font-black uppercase hover:bg-black">Simpan</button>
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
                  <p className="text-[10px] font-mono opacity-50 mt-2">KELOLA PROFIL KOMUNITASMU</p>
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
                      <p className="text-[10px] font-mono text-[#FF5733] font-bold mt-1">KOMUNITAS</p>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-8">
                    <p className="text-sm leading-relaxed opacity-80 mb-6">{PROFILE.bio}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/10">
                      {[{ v: PROFILE.totalProyek, l: 'TOTAL PROYEK' }, { v: PROFILE.selesai, l: 'SELESAI' }, { v: PROFILE.komunitasAktif.length, l: 'KOMUNITAS' }].map((s, i) => (
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
                    <h3 className="text-xl font-black mb-5">Riwayat Proyek Yang Pernah Dikerjakan</h3>
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
                  <div className="dash-item border-2 border-black bg-[#0E7C66] text-white p-7">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <h3 className="text-xl font-black mt-1">Proyek Terverifikasi</h3>
                      </div>
                    </div>
                    <div className="space-y-5">
                      {PROFILE.track.map((t, i) => (
                        <div key={i} className="border-b-2 border-white/20 pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <span className="text-[10px] font-mono font-bold">{t.date}</span>
                            <span className="text-[9px] font-mono font-bold bg-white text-[#0E7C66] px-2 py-0.5">✓ SELESAI</span>
                          </div>
                          <h4 className="font-black text-base mb-1">{t.t}</h4>
                          <p className="text-[10px] font-mono opacity-70 mb-2">{t.note}</p>
                          <p className="text-sm italic leading-relaxed">{t.testimonial}</p>
                        </div>
                      ))}
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
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">Pengaturan</h1>
                  <p className="text-[10px] font-mono opacity-50 mt-2">PREFERENSI AKUN</p>
                </div>
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
                      <h3 className="text-xl font-black mt-1 mb-5">Kelola Notifikasi</h3>
                      <SetToggle on={sets.notifTalenta} onClick={() => setSets((s) => ({ ...s, notifTalenta: !s.notifTalenta }))} label="Pengajuan dari Talenta" sub="Notifikasi saat talenta mengajukan" />
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
                          <div className="w-12 h-12 bg-[#4285F4] text-white flex items-center justify-center text-2xl font-black">G</div>
                          <div>
                            <p className="font-black">Google</p>
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
                        <span className="text-[10px] font-mono font-bold text-[#FF5733]">Logout</span>
                        <h3 className="text-xl font-black mt-1 mb-5">Keluar dari Akun</h3>
                        <button onClick={onLogout} className="w-full bg-black text-white py-4 text-[10px] font-black uppercase hover:bg-[#FF5733]">KELUAR →</button>
                      </div>
                      <div className="dash-item border-2 border-black bg-white p-7 border-l-4 border-l-[#FF5733]">
                        <h3 className="text-xl font-black mt-1 mb-5">Hapus Akun Permanen</h3>
                        <p className="text-sm opacity-70 mb-5">Kamu Tidak Dapat Memulihkan Akunmu Lagi</p>
                        <button onClick={() => setConfirmDelete(true)} className="w-full border-2 border-black py-4 text-[10px] font-black uppercase hover:bg-black hover:text-white">HAPUS AKUN</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL TEMPEL TOPIK BARU */}
      {newTopicOpen && (
        <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md border-2 border-[#FF5733] p-8 relative">
            <button onClick={() => setNewTopicOpen(false)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black flex items-center justify-center text-xl font-black hover:bg-black hover:text-white">×</button>
            <h3 className="text-2xl font-black mb-5">Buat Topik Baru</h3>
            <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Judul Topik</label>
            <input value={ntTitle} onChange={(e) => setNtTitle(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] mb-4" placeholder="Mis. Tips rekap iuran otomatis?" />
            <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Kategori</label>
            <div className="flex flex-wrap gap-1 mb-4">
              {Object.keys(TOPIC_CAT).map((c) => (
                <button key={c} onClick={() => setNtCat(c)} className={`px-3 py-2 text-[9px] font-mono font-bold border-2 transition-colors ${ntCat === c ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black'}`}>{c}</button>
              ))}
            </div>
            <label className="text-[10px] font-black uppercase tracking-widest block mb-2">Isi Topik</label>
            <textarea value={ntBody} onChange={(e) => setNtBody(e.target.value)} className="w-full border-2 border-black/20 p-3 text-sm outline-none focus:border-[#FF5733] h-24 resize-none" placeholder="Ceritakan pertanyaan / informasi..." />
            <button onClick={postTopic} disabled={!ntTitle.trim() || !ntBody.trim()} className={`w-full mt-5 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${ntTitle.trim() && ntBody.trim() ? 'bg-[#FF5733] text-white hover:bg-black' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}>
              📌 Tempel ke Mading
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}