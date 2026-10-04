import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import DashShell from '../../components/common/DashShell';
import AiAgent from '../../components/common/AiAgent';
import MadingBoard from '../../components/mading/MadingBoard';
import SettingsPanel from '../../components/settings/SettingsPanel';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useNotifications } from '../../hooks/useNotifications';
import { firstName } from '../../lib/format';
import CatalogTab from './talent/CatalogTab';
import NeedView from './talent/NeedView';
import HistoryTab from './talent/HistoryTab';
import ProjectsTab from './talent/ProjectsTab';
import ProjectView from './talent/ProjectView';
import ProfileTab from './talent/ProfileTab';

const NAV = [
  { id: 'jelajahi', n: '01', l: 'Lihat Proyek' },
  { id: 'histori', n: '02', l: 'Histori' },
  { id: 'projek', n: '03', l: 'Proyek Saya' },
  { id: 'mading', n: '04', l: 'Mading' },
  { id: 'profil', n: '05', l: 'Profil' },
  { id: 'setting', n: '06', l: 'Pengaturan' },
];

export default function DashboardTalent({ user, onLogout, navigateTo }) {
  const [tab, setTab] = useState('jelajahi');
  const [needId, setNeedId] = useState(null); // detail kebutuhan dari katalog/histori
  const [projectId, setProjectId] = useState(null); // detail proyek
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [liveKey, setLiveKey] = useState(0);
  const rootRef = useRef(null);

  const projectsQ = useApi((signal) => api.get('/projects/mine', { signal, query: { limit: 50 } }), []);
  const appsQ = useApi((signal) => api.get('/applications/mine', { signal, query: { limit: 1 } }), []);
  // Notifikasi baru (lamaran diputus, verifikasi, revisi) → daftar & detail yang terbuka dimuat ulang.
  const notifications = useNotifications({
    onNew: () => { projectsQ.refetch(); appsQ.refetch(); setCatalogVersion((v) => v + 1); setLiveKey((k) => k + 1); },
  });
  const stats = {
    applications: appsQ.data?.total,
    completed: projectsQ.data ? projectsQ.data.items.filter((p) => p.status === 'COMPLETED').length : undefined,
  };
  const reload = () => { projectsQ.refetch(); appsQ.refetch(); notifications.refetch(); };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-item', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, needId, projectId]);

  const onTab = (id) => {
    setTab(id);
    setNeedId(null);
    setProjectId(null);
    // Daftar proyek berubah karena aksi komunitas (memilih, verifikasi): muat ulang saat dibuka.
    if (id === 'projek') projectsQ.refetch();
  };
  const openNeed = (id) => { setTab('jelajahi'); setProjectId(null); setNeedId(id); };
  const openProject = (id) => { setTab('projek'); setNeedId(null); setProjectId(id); };
  const openNotification = (n) => {
    if (n.ref_type === 'project') openProject(n.ref_id);
    else if (n.ref_type === 'need') openNeed(n.ref_id);
    else if (n.ref_type === 'topic') onTab('mading');
    else if (n.ref_type === 'application') onTab('histori');
    else onTab('projek');
  };

  return (
    <DashShell user={user} roleLabel="TALENTA" nav={NAV} tab={tab} onTab={onTab} notifications={notifications} onNotificationClick={openNotification} onLogout={onLogout} navigateTo={navigateTo}>
      <div ref={rootRef}>
        {tab === 'jelajahi' && (
          <>
            {needId && (
              <NeedView
                needId={needId}
                liveKey={liveKey}
                onBack={() => setNeedId(null)}
                onApplied={() => { setCatalogVersion((v) => v + 1); reload(); }}
                onOpenHistory={() => onTab('histori')}
                onOpenProjects={() => onTab('projek')}
              />
            )}
            {/* Katalog tetap terpasang saat detail dibuka agar pencarian, filter, dan halaman tidak hilang. */}
            <div hidden={Boolean(needId)}>
              <CatalogTab first={firstName(user?.name, 'Talenta')} stats={stats} version={catalogVersion} onOpen={(need) => setNeedId(need.id)} />
            </div>
          </>
        )}
        {tab === 'histori' && <HistoryTab onOpenNeed={openNeed} onOpenProject={openProject} onBrowse={() => onTab('jelajahi')} />}
        {tab === 'projek' && (projectId ? (
          <ProjectView projectId={projectId} userId={user?.id} liveKey={liveKey} onBack={() => setProjectId(null)} onChanged={reload} />
        ) : (
          <ProjectsTab query={projectsQ} onOpen={setProjectId} onBrowse={() => onTab('jelajahi')} />
        ))}
        {tab === 'mading' && <MadingBoard user={user} />}
        {tab === 'profil' && <ProfileTab onEdit={() => onTab('setting')} />}
        {tab === 'setting' && <SettingsPanel onLogout={onLogout} />}
      </div>
      <AiAgent role="talent" />
    </DashShell>
  );
}
