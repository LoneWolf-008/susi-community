import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import AiAgent from '../../components/common/AiAgent';
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
  const notifications = useNotifications();

  const needsQ = useApi((signal) => api.get('/needs/mine', { signal, query: { limit: 50 } }), []);
  const projectsQ = useApi((signal) => api.get('/projects/mine', { signal, query: { limit: 50 } }), []);
  const cards = buildBoard(needsQ.data?.items, projectsQ.data?.items);
  const reload = () => { needsQ.refetch(); projectsQ.refetch(); notifications.refetch(); };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, selected]);

  const onTab = (id) => { setTab(id); setSelected(null); };
  const openCard = ({ need }) => setSelected(need.id);

  return (
    <DashShell user={user} roleLabel="KOMUNITAS" nav={NAV} tab={tab} onTab={onTab} notifs={notifications.items} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {tab === 'beranda' && (selected ? (
          <NeedDetail needId={selected} onBack={() => setSelected(null)} onChanged={reload} />
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
        {tab === 'map' && <CommunitiesTab onOpenMading={() => onTab('komunitas')} />}
        {tab === 'profile' && <ProfileTab user={user} cards={cards} onEdit={() => onTab('setting')} />}
        {tab === 'setting' && <SettingsPanel onLogout={onLogout} />}
      </div>
      <AiAgent role="komunitas" />
    </DashShell>
  );
}
