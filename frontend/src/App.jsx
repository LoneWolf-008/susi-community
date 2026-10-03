import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import logoSusi from './assets/logo-susi.svg';
import Navigation from './components/common/Navigation';
import Footer from './components/common/Footer';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import AdminLoginPage from './pages/AdminLoginPage';
import TentangPage from './pages/TentangPage';
import RequestPage from './pages/RequestPage';
import DashboardRequester from './pages/dashboards/DashboardRequester';
import DashboardTalent from './pages/dashboards/DashboardTalent';
import DashboardAdmin from './pages/dashboards/DashboardAdmin';
import DashboardLiaison from './pages/dashboards/DashboardLiaison';
import AskSusiPanel from './components/common/AskSusiPanel';

export default function App() {
  const [ask, setAsk] = useState({ open: false, q: null, n: 0 });
  const openAsk = (q) => setAsk((a) => ({ open: true, q: q || null, n: a.n + 1 }));
  const closeAsk = () => setAsk((a) => ({ ...a, open: false }));
  const [currentPage, setCurrentPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayLogoRef = useRef(null);

  // Akses admin lewat URL rahasia (contoh: http://localhost:5173/?admin=true atau #admin)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || window.location.hash === '#admin') {
      setCurrentPage('admin-login');
    }
  }, []);

  const onOverlayMove = (e) => {
    const logo = overlayLogoRef.current;
    if (!logo) return;
    gsap.to(logo, {
      x: (e.clientX / window.innerWidth - 0.5) * 30,
      y: (e.clientY / window.innerHeight - 0.5) * 30,
      duration: 0.4, ease: 'power2.out',
    });
  };

  const navigateTo = (page) => {
    if (page === 'dashboard' && !userRef.current) page = 'auth';
    if (page === currentPage) return;
    setMenuOpen(false);
    const overlay = overlayRef.current;
    const overlayLogo = overlayLogoRef.current;
    if (!overlay) return;
    gsap.timeline()
      .set(overlay, { y: '100%', backgroundColor: '#e62b2b' })
      .to(overlay, { y: '0%', duration: 0.55, ease: 'power4.inOut' })
      .add(() => { setCurrentPage(page); window.scrollTo(0, 0); })
      .set(overlay, { backgroundColor: '#0e2233' })
      .to(overlay, { y: '-100%', duration: 0.55, ease: 'power4.inOut' })
      .set(overlay, { y: '100%' });
  };

  const goToSection = (id) => {
    setMenuOpen(false);
    if (currentPage !== 'home') {
      navigateTo('home');
      gsap.delayedCall(1.2, () => {
        gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' });
      });
    } else {
      gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' });
    }
  };

  const handleLogin = (userData) => { userRef.current = userData; setUser(userData); navigateTo('dashboard'); };
  const handleLogout = () => { userRef.current = null; setUser(null); navigateTo('home'); };

  const isStandalonePage = ['auth', 'admin-login', 'dashboard', 'request'].includes(currentPage);

  const renderDashboard = () => {
    if (!user) return null;
    switch (user.role) {
      case 'requester': return <DashboardRequester user={user} onLogout={handleLogout} navigateTo={navigateTo} />;
      case 'talent': return <DashboardTalent user={user} onLogout={handleLogout} navigateTo={navigateTo} />;
      case 'liaison':
      case 'agensusi': return <DashboardLiaison user={user} onLogout={handleLogout} navigateTo={navigateTo} />;
      case 'admin': return <DashboardAdmin user={user} onLogout={handleLogout} navigateTo={navigateTo} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0e2233] text-[#f2efe6] antialiased selection:bg-[#e62b2b] selection:text-white overflow-x-hidden">
      {/* Grain global ala Think Co */}
      <div className="noise-overlay" />

      {/* Layar transisi antar halaman */}
      <div
        ref={overlayRef}
        onMouseMove={onOverlayMove}
        className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden"
        style={{ transform: 'translateY(100%)', backgroundColor: '#e62b2b' }}
      >
        <div ref={overlayLogoRef}>
          <img src={logoSusi} alt="SUSI Community" draggable={false} className="w-32 md:w-44 h-auto object-contain brightness-0 invert" />
        </div>
      </div>

      {!isStandalonePage && (
        <Navigation
          currentPage={currentPage}
          navigateTo={navigateTo}
          goToSection={goToSection}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onAsk={openAsk}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'home' && (
        <HomePage navigateTo={navigateTo} goToSection={goToSection} onAsk={openAsk} />   
      )}
      {currentPage === 'auth' && <AuthPage onLogin={handleLogin} goToHome={() => navigateTo('home')} goAdmin={() => navigateTo('admin-login')} />}
      {currentPage === 'admin-login' && <AdminLoginPage onLogin={handleLogin} goToAuth={() => navigateTo('auth')} />}
      {currentPage === 'request' && user && <RequestPage user={user} navigateTo={navigateTo} />}
      {currentPage === 'dashboard' && renderDashboard()}
      {currentPage === 'tentang' && <TentangPage />}
      <AskSusiPanel open={ask.open} seedQ={ask.q} seedN={ask.n} onClose={closeAsk} />

      {!isStandalonePage && <Footer navigateTo={navigateTo} goToSection={goToSection} />}
    </div>
  );
}