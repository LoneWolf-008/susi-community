import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import SettingsPanel from '../../components/settings/SettingsPanel';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useNotifications } from '../../hooks/useNotifications';
import { firstName } from '../../lib/format';
import RingkasanTab from './admin/RingkasanTab';
import ModerasiTab from './admin/ModerasiTab';
import SengketaTab from './admin/SengketaTab';
import PenggunaTab from './admin/PenggunaTab';
import LiaisonTab from './admin/LiaisonTab';
import AuditTab from './admin/AuditTab';

const NAV = [
  { id: 'ringkasan', n: '01', l: 'Ringkasan' },
  { id: 'moderasi', n: '02', l: 'Moderasi' },
  { id: 'sengketa', n: '03', l: 'Sengketa' },
  { id: 'pengguna', n: '04', l: 'Pengguna' },
  { id: 'liaison', n: '05', l: 'AgenSUSI' },
  { id: 'audit', n: '06', l: 'Log Audit' },
  { id: 'setting', n: '07', l: 'Pengaturan' },
];

export default function DashboardAdmin({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('ringkasan');
  const rootRef = useRef(null);
  const notifications = useNotifications();
  const statsQ = useApi((signal) => api.get('/admin/stats', { signal }), []);
  const refreshStats = () => { statsQ.refetch(); notifications.refetch(); };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.04, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [tab]);

  // Angka ringkasan dimuat ulang setiap pindah tab (antrean berubah karena pengguna lain).
  const onTab = (id) => { setTab(id); refreshStats(); };

  return (
    <DashShell user={user} roleLabel="ADMIN" nav={NAV} tab={tab} onTab={onTab} notifs={notifications.items} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {tab === 'ringkasan' && <RingkasanTab first={firstName(user?.name, 'Admin')} statsQ={statsQ} onTab={onTab} />}
        {tab === 'moderasi' && <ModerasiTab statsQ={statsQ} onChanged={refreshStats} />}
        {tab === 'sengketa' && <SengketaTab statsQ={statsQ} onChanged={refreshStats} />}
        {tab === 'pengguna' && <PenggunaTab currentUserId={user?.id} onChanged={refreshStats} />}
        {tab === 'liaison' && <LiaisonTab onChanged={refreshStats} />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'setting' && <SettingsPanel onLogout={onLogout} />}
      </div>
    </DashShell>
  );
}
