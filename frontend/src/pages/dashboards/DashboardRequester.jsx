import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import ChatWidget from '../../components/chat/ChatWidget';
import MadingBoard from '../../components/mading/MadingBoard';
import SettingsPanel from '../../components/settings/SettingsPanel';
import NeedDetail from '../../components/owner/NeedDetail';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useNotifications } from '../../hooks/useNotifications';
import { firstName } from '../../lib/format';
import BerandaTab from './requester/BerandaTab';
import CommunitiesTab from './requester/CommunitiesTab';
import ProfileTab from './requester/ProfileTab';
import { buildBoard } from './requester/board';

const NAV = [
  { id: 'beranda', n: '01', l: 'Beranda' },
  { id: 'komunitas', n: '02', l: 'Mading' },
  { id: 'map', n: '03', l: 'Komunitas & Peta' },
  { id: 'profile', n: '04', l: 'Profil' },
  { id: 'setting', n: '05', l: 'Pengaturan' },
];

export default function DashboardRequester({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('beranda');
  const [selected, setSelected] = useState(null); // id kebutuhan yang dibuka
  const rootRef = useRef(null);

  const needsQ = useApi((signal) => api.get('/needs/mine', { signal, query: { limit: 50 } }), []);
  const projectsQ = useApi((signal) => api.get('/projects/mine', { signal, query: { limit: 50 } }), []);
  // Notifikasi baru (lamaran, hasil kerja, moderasi) berarti papan/detail berubah: muat ulang.
  const [liveKey, setLiveKey] = useState(0);
  const notifications = useNotifications({ onNew: () => { needsQ.refetch(); projectsQ.refetch(); setLiveKey((k) => k + 1); } });
  const cards = buildBoard(needsQ.data?.items, projectsQ.data?.items);
  const reload = () => { needsQ.refetch(); projectsQ.refetch(); notifications.refetch(); };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selected]);

  const onTab = (id) => {
    setTab(id);
    setSelected(null);
    // Status berubah karena aksi pihak lain (moderasi, lamaran, kiriman hasil): muat ulang saat dibuka.
    if (id === 'beranda' || id === 'profile') reload();
  };
  const openCard = ({ need }) => setSelected(need.id);
  // Klik notifikasi → buka kebutuhan terkait (lewat kebutuhan atau proyeknya) atau mading.
  const openNotification = (n) => {
    if (n.ref_type === 'topic') { onTab('komunitas'); return; }
    if (n.ref_type === 'community') { onTab('map'); return; } // permintaan bergabung (U1)
    const needId = n.ref_type === 'need' ? n.ref_id
      : n.ref_type === 'project' ? cards.find((c) => Number(c.project?.id) === Number(n.ref_id))?.need.id
        : null;
    setTab('beranda');
    setSelected(needId ?? null);
    reload();
  };

  return (
    <DashShell user={user} roleLabel="KOMUNITAS" nav={NAV} tab={tab} onTab={onTab} notifications={notifications} onNotificationClick={openNotification} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {tab === 'beranda' && (selected ? (
          <NeedDetail needId={selected} liveKey={liveKey} onBack={() => setSelected(null)} onChanged={reload} />
        ) : (
          <BerandaTab
            first={firstName(user?.name, 'Warga')}
            cards={cards}
            loading={needsQ.loading || projectsQ.loading}
            error={needsQ.error || projectsQ.error}
            onRetry={reload}
            onOpen={openCard}
            onCreate={() => navigateTo('request')}
          />
        ))}
        {tab === 'komunitas' && <MadingBoard user={user} />}
        {tab === 'map' && <CommunitiesTab liveKey={liveKey} onOpenMading={() => onTab('komunitas')} />}
        {tab === 'profile' && <ProfileTab user={user} cards={cards} onEdit={() => onTab('setting')} />}
        {tab === 'setting' && <SettingsPanel onLogout={onLogout} />}
      </div>
      <ChatWidget variant="floating" />
    </DashShell>
  );
}
