import { useAuth } from '../../context/authContext';
import DashboardRequester from './DashboardRequester';
import DashboardTalent from './DashboardTalent';
import DashboardAdmin from './DashboardAdmin';
import DashboardLiaison from './DashboardLiaison';

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
