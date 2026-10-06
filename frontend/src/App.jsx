import { lazy, Suspense, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import Navigation from './components/common/Navigation';
import Footer from './components/common/Footer';
import ChatWidget from './components/chat/ChatWidget';
import ProtectedRoute, { GuestOnly } from './components/routing/ProtectedRoute';
import FullPageLoader from './components/ui/FullPageLoader';

// U3: tiap rute dimuat malas (chunk sendiri), jadi bundle awal hanya berisi kerangka aplikasi.
const HomePage = lazy(() => import('./pages/HomePage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const TentangPage = lazy(() => import('./pages/TentangPage'));
const RequestPage = lazy(() => import('./pages/RequestPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DashboardPage = lazy(() => import('./pages/dashboards/DashboardPage'));
const RuangAgenPage = lazy(() => import('./pages/RuangAgenPage'));
const CertificatePage = lazy(() => import('./pages/CertificatePage'));
const VerifyCertificatePage = lazy(() => import('./pages/VerifyCertificatePage'));
import { RUANG_AGEN_ROLES } from './lib/chatNavigation';
import { useAuth } from './context/authContext';
import { useGoToSection, useNavigateTo, useTransitionNavigate } from './context/transitionContext';

// Halaman tanpa navigasi & footer publik.
const STANDALONE_PATHS = ['/masuk', '/admin', '/dashboard', '/ajukan', '/sertifikat'];

export default function App() {
  const [ask, setAsk] = useState({ open: false, q: null, n: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const go = useTransitionNavigate();
  const navigateTo = useNavigateTo();
  const goToSection = useGoToSection();

  const openAsk = (q) => setAsk((a) => ({ open: true, q: q || null, n: a.n + 1 }));
  const closeAsk = () => setAsk((a) => ({ ...a, open: false }));
  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    go('/');
  };

  const isStandalone = STANDALONE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <div className="min-h-dvh bg-[#0e2233] text-[#f2efe6] antialiased selection:bg-[#e62b2b] selection:text-white overflow-x-hidden">
      {/* Grain global ala Think Co */}
      <div className="noise-overlay" />

      {!isStandalone && (
        <Navigation
          currentPage={pathname}
          navigateTo={navigateTo}
          goToSection={goToSection}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onAsk={openAsk}
          user={user}
          onLogout={handleLogout}
        />
      )}

      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage navigateTo={navigateTo} onAsk={openAsk} />} />
          <Route path="/tentang" element={<TentangPage />} />
          {/* U5: sertifikat talenta — publik, tanpa login. */}
          <Route path="/verifikasi/:code" element={<VerifyCertificatePage />} />
          <Route path="/sertifikat/:code" element={<CertificatePage />} />
          <Route path="/masuk" element={<GuestOnly><AuthPage /></GuestOnly>} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route
            path="/ajukan"
            element={(
              <ProtectedRoute roles={['requester']}>
                <RequestPage user={user} navigateTo={navigateTo} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard"
            element={(
              <ProtectedRoute>
                <DashboardPage onLogout={handleLogout} navigateTo={navigateTo} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/ruang-agen"
            element={(
              <ProtectedRoute roles={RUANG_AGEN_ROLES}>
                <RuangAgenPage navigateTo={navigateTo} />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      <ChatWidget variant="overlay" open={ask.open} seed={ask} onClose={closeAsk} />

      {!isStandalone && <Footer navigateTo={navigateTo} goToSection={goToSection} />}
    </div>
  );
}
