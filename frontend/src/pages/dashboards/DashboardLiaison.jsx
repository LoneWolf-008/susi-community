import { useEffect, useRef, useState } from 'react';
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

const NAV = [
  { id: 'beranda', n: '01', l: 'Beranda' },
  { id: 'kunjungan', n: '02', l: 'Kunjungan' },
  { id: 'catat', n: '03', l: 'Catat Kebutuhan' },
  { id: 'kebutuhan', n: '04', l: 'Kebutuhan Tercatat' },
  { id: 'komunitas', n: '05', l: 'Komunitas & Peta' },
  { id: 'laporan', n: '06', l: 'Laporan' },
  { id: 'setting', n: '07', l: 'Pengaturan' },
];

export default function DashboardLiaison({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [intake, setIntake] = useState({ key: 0, visit: null }); // visit = kunjungan yang sedang dicatat
  const [selected, setSelected] = useState(null); // id kebutuhan yang dibuka (pemilik proksi)
  const rootRef = useRef(null);
  const notifications = useNotifications();

  const summaryQ = useApi((signal) => api.get('/liaison/summary', { signal }), []);
  const needsQ = useApi((signal) => api.get('/needs/mine', { signal, query: { limit: 50 } }), []);
  const projectsQ = useApi((signal) => api.get('/projects/mine', { signal, query: { limit: 50 } }), []);
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
    if (['beranda', 'kebutuhan', 'laporan'].includes(id)) reload();
  };
  // Form intake baru (key berganti → form bersih), opsional dari kunjungan yang sedang berlangsung.
  const startIntake = (visit = null) => { setIntake((s) => ({ key: s.key + 1, visit })); setTab('catat'); setSelected(null); };

  return (
    <DashShell user={user} roleLabel="AGENSUSI" nav={NAV} tab={tab} onTab={onTab} notifs={notifications.items} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {tab === 'beranda' && (
          <BerandaTab
            first={firstName(user?.name, 'Agen')}
            summaryQ={summaryQ}
            onRecord={startIntake}
            onNewIntake={() => startIntake()}
            onChanged={reload}
            onOpenVisits={() => onTab('kunjungan')}
          />
        )}
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
          <NeedDetail needId={selected} onBack={() => setSelected(null)} onChanged={reload} />
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
        {tab === 'komunitas' && <CommunitiesTab canJoin={false} />}
        {tab === 'laporan' && (
          <LaporanTab summaryQ={summaryQ} cards={cards} loading={needsQ.loading || projectsQ.loading} error={needsQ.error || projectsQ.error} onRetry={reload} />
        )}
        {tab === 'setting' && <SettingsPanel onLogout={onLogout} />}
      </div>
    </DashShell>
  );
}
