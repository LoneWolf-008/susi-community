import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { OPEN_OWNER_NEED_EVENT } from '../../lib/chatNavigation';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import SettingsPanel from '../../components/settings/SettingsPanel';
import NeedDetail from '../../components/owner/NeedDetail';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useNotifications } from '../../hooks/useNotifications';
import { firstName } from '../../lib/format';
import BoardTab from './requester/BerandaTab';
import CommunitiesTab from './requester/CommunitiesTab';
import { buildBoard } from './requester/board';
import BerandaTab from './liaison/BerandaTab';
import VisitsTab from './liaison/VisitsTab';
import IntakeTab from './liaison/IntakeTab';
import LaporanTab from './liaison/LaporanTab';
import EskalasiTab from './liaison/EskalasiTab';
import ChatWidget from '../../components/chat/ChatWidget';

const NAV = [
  { id: 'beranda', n: '01', l: 'Beranda' },
  { id: 'eskalasi', n: '02', l: 'Eskalasi' },
  { id: 'kunjungan', n: '03', l: 'Kunjungan' },
  { id: 'catat', n: '04', l: 'Catat Kebutuhan' },
  { id: 'kebutuhan', n: '05', l: 'Kebutuhan Tercatat' },
  { id: 'komunitas', n: '06', l: 'Komunitas & Peta' },
  { id: 'laporan', n: '07', l: 'Laporan' },
  { id: 'setting', n: '08', l: 'Pengaturan' },
];

export default function DashboardLiaison({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [intake, setIntake] = useState({ key: 0, visit: null }); // visit = kunjungan yang sedang dicatat
  const [selected, setSelected] = useState(null); // id kebutuhan yang dibuka (pemilik proksi)
  const rootRef = useRef(null);
  const [liveKey, setLiveKey] = useState(0);
  const [escalationFocus, setEscalationFocus] = useState(null); // tiket yang dibuka dari notifikasi

  const summaryQ = useApi((signal) => api.get('/liaison/summary', { signal }), []);
  const needsQ = useApi((signal) => api.get('/needs/mine', { signal, query: { limit: 50 } }), []);
  const projectsQ = useApi((signal) => api.get('/projects/mine', { signal, query: { limit: 50 } }), []);
  // Notifikasi baru (moderasi, lamaran, hasil kerja, eskalasi) → papan, ringkasan, antrean, dan detail dimuat ulang.
  const notifications = useNotifications({
    onNew: () => { summaryQ.refetch(); needsQ.refetch(); projectsQ.refetch(); setLiveKey((k) => k + 1); },
  });
  const cards = buildBoard(needsQ.data?.items, projectsQ.data?.items);
  const reload = () => { summaryQ.refetch(); needsQ.refetch(); projectsQ.refetch(); notifications.refetch(); };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selected, intake.key]);

  const onTab = (id) => {
    setTab(id);
    setSelected(null);
    // Papan & ringkasan berubah karena aksi pihak lain (moderasi, lamaran): muat ulang saat dibuka.
    if (['beranda', 'eskalasi', 'kebutuhan', 'laporan'].includes(id)) reload();
  };
  // Form intake baru (key berganti → form bersih), opsional dari kunjungan yang sedang berlangsung.
  const startIntake = (visit = null) => { setIntake((s) => ({ key: s.key + 1, visit })); setTab('catat'); setSelected(null); };
  // Kartu talenta di Tanya SUSI (R3) → buka kebutuhan (pemilik proksi) terkait.
  const onOpenNeedFromChat = useEffectEvent((e) => { setTab('kebutuhan'); setSelected(Number(e.detail?.id)); });
  useEffect(() => {
    const handler = (e) => onOpenNeedFromChat(e);
    window.addEventListener(OPEN_OWNER_NEED_EVENT, handler);
    return () => window.removeEventListener(OPEN_OWNER_NEED_EVENT, handler);
  }, []);
  const openNotification = (n) => {
    if (n.ref_type === 'visit') { onTab('kunjungan'); return; }
    if (n.ref_type === 'escalation') { onTab('eskalasi'); setEscalationFocus(n.ref_id); return; }
    if (n.ref_type === 'community') { onTab('komunitas'); return; } // permintaan bergabung (U1)
    const needId = n.ref_type === 'need' ? n.ref_id
      : n.ref_type === 'project' ? cards.find((c) => Number(c.project?.id) === Number(n.ref_id))?.need.id
        : null;
    onTab('kebutuhan');
    setSelected(needId ?? null);
  };

  return (
    <DashShell user={user} roleLabel="AGENSUSI" nav={NAV} tab={tab} onTab={onTab} notifications={notifications} onNotificationClick={openNotification} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {tab === 'beranda' && (
          <BerandaTab
            first={firstName(user?.name, 'Agen')}
            summaryQ={summaryQ}
            onRecord={startIntake}
            onNewIntake={() => startIntake()}
            onChanged={reload}
            onOpenVisits={() => onTab('kunjungan')}
            onOpenEscalations={() => onTab('eskalasi')}
          />
        )}
        {tab === 'eskalasi' && <EskalasiTab liveKey={liveKey} focusId={escalationFocus} onChanged={reload} />}
        {tab === 'kunjungan' && <VisitsTab onRecord={startIntake} onChanged={reload} />}
        {tab === 'catat' && (
          <IntakeTab
            key={intake.key}
            visit={intake.visit}
            onSaved={reload}
            onAgain={() => startIntake()}
            onOpenNeeds={() => onTab('kebutuhan')}
          />
        )}
        {tab === 'kebutuhan' && (selected ? (
          <NeedDetail needId={selected} liveKey={liveKey} onBack={() => setSelected(null)} onChanged={reload} />
        ) : (
          <BoardTab
            first={firstName(user?.name, 'Agen')}
            title="Kebutuhan yang Anda wakili"
            intro="Anda menjadi pemilik proksi kebutuhan yang dicatat lewat kunjungan: pilih talenta dari pelamar dan benarkan hasilnya bersama komunitas."
            createLabel="+ Catat Kebutuhan"
            cards={cards}
            loading={needsQ.loading || projectsQ.loading}
            error={needsQ.error || projectsQ.error}
            onRetry={reload}
            onOpen={({ need }) => setSelected(need.id)}
            onCreate={() => startIntake()}
          />
        ))}
        {tab === 'komunitas' && <CommunitiesTab liveKey={liveKey} showMine={false} />}
        {tab === 'laporan' && (
          <LaporanTab summaryQ={summaryQ} cards={cards} loading={needsQ.loading || projectsQ.loading} error={needsQ.error || projectsQ.error} onRetry={reload} />
        )}
        {tab === 'setting' && <SettingsPanel onLogout={onLogout} />}
      </div>
      <ChatWidget variant="floating" />
    </DashShell>
  );
}
