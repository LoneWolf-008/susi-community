import { lazy } from 'react';
import { useAuth } from '../../context/authContext';

// U3: dasbor tiap peran di chunk sendiri; pengguna hanya mengunduh dasbor perannya.
const DashboardRequester = lazy(() => import('./DashboardRequester'));
const DashboardTalent = lazy(() => import('./DashboardTalent'));
const DashboardAdmin = lazy(() => import('./DashboardAdmin'));
const DashboardLiaison = lazy(() => import('./DashboardLiaison'));

// /dashboard → dasbor sesuai peran (peran sudah dinormalkan di AuthProvider).
const BY_ROLE = {
  requester: DashboardRequester,
  talent: DashboardTalent,
  liaison: DashboardLiaison,
  admin: DashboardAdmin,
};

export default function DashboardPage({ onLogout, navigateTo }) {
  const { user } = useAuth();
  const Dashboard = BY_ROLE[user?.role];
  if (!Dashboard) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 text-center">
        <p className="font-mono text-xs font-bold tracking-widest opacity-60">PERAN AKUN TIDAK DIKENALI.</p>
      </main>
    );
  }
  return <Dashboard user={user} onLogout={onLogout} navigateTo={navigateTo} />;
}
