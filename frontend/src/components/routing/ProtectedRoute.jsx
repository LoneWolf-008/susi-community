import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../context/authContext';
import FullPageLoader from '../ui/FullPageLoader';

/**
 * Hanya untuk pengguna login (dan peran tertentu bila `roles` diisi).
 * Ini hanya kenyamanan UI: setiap aksi tetap diperiksa backend.
 */
export default function ProtectedRoute({ roles, children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status !== 'authenticated') {
    return <Navigate to="/masuk" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Halaman tamu (masuk/daftar): pengguna yang sudah login langsung ke dasbor. */
export function GuestOnly({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to={location.state?.from || '/dashboard'} replace />;
  return children;
}
