import { useState, useRef } from 'react';
import gsap from 'gsap';
import logoSusi from './assets/logo-susi.svg';
import Cursor from './components/common/Cursor';
import Navigation from './components/common/Navigation';
import Footer from './components/common/Footer';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import AdminLoginPage from './pages/AdminLoginPage';
import TentangPage from './pages/TentangPage';
import RequestPage from './pages/RequestPage';
import DashboardRequester from './pages/dashboards/DashboardRequester';
import DashboardTalent from './pages/dashboards/DashboardTalent.jsx';
import DashboardAdmin from './pages/dashboards/DashboardAdmin';
import DashboardLiaison from './pages/dashboards/DashboardLiaison';


/* ============ MAIN APP ============ */
export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const userRef = useRef(null); 
  const overlayRef = useRef(null);
  const overlayLogoRef = useRef(null);
  const onOverlayMove = (e) => {
  const logo = overlayLogoRef.current;
  if (!logo) return;
  const x = (e.clientX / window.innerWidth - 0.5) * 30;
  const y = (e.clientY / window.innerHeight - 0.5) * 30;
  gsap.to(logo, { x, y, duration: 0.4, ease: 'power2.out' });
};

  const navigateTo = (page) => {
    if (page === 'dashboard' && !userRef.current) page = 'auth';
    if (page === currentPage) return;
    setMenuOpen(false);
    const overlay = overlayRef.current;
    gsap.timeline()
  .set(overlay, { y: '100%' })
  .set(overlayLogoRef.current, { scale: 0.6, autoAlpha: 0, x: 0, y: 0 })
  .to(overlay, { y: '0%', duration: 0.45, ease: 'power4.inOut' })
  .to(overlayLogoRef.current, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2)' }, '-=0.2')
  .add(() => { setCurrentPage(page); window.scrollTo(0, 0); })
  .to(overlayLogoRef.current, { scale: 0.85, autoAlpha: 0, duration: 0.25, ease: 'power2.in', delay: 0.15 })
  .to(overlay, { y: '-100%', duration: 0.55, ease: 'power4.inOut' })
  .set(overlay, { y: '100%' });
  };

  const goToSection = (id) => {
    setMenuOpen(false);
    if (currentPage !== 'home') {
      navigateTo('home');
      gsap.delayedCall(1.2, () => gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' }));
    } else {
      gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' });
    }
  };

  const handleLogin = (userData) => {
    userRef.current = userData;
    setUser(userData);
    navigateTo('dashboard');
  };

  const handleLogout = () => {
    userRef.current = null;
    setUser(null);
    navigateTo('home');
  };

  const goToHome = () => navigateTo('home');

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased selection:bg-[#FF5733] selection:text-white">
      <style>{`
        @font-face {
        font-family: 'Coolvetica';
        src: url('/fonts/Coolvetica.otf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Nexa';
        src: url('/fonts/Nexa.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Outfit';
        src: url('/fonts/Outfit.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Poppins';
        src: url('/fonts/Poppins.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      * { font-family: 'Nexa', sans-serif; }

      .font-mono { font-family: 'Outfit', monospace !important; }
      html { scroll-behavior: auto; }

      footer, footer * { font-family: 'Poppins', sans-serif !important; }

      @media (min-width: 768px) {
      * { cursor: none !important; }
      input, textarea, select { cursor: text !important; }
    }

        html, body {
    overflow-x: hidden;
    max-width: 100vw;
  }

        html, body { overflow-x: clip; }

      `}</style>

        <div
  ref={overlayRef}
  onMouseMove={onOverlayMove}
  className="fixed inset-0 z-[400] bg-[#F5FBDA] flex items-center justify-center overflow-hidden"
  style={{ transform: 'translateY(100%)' }}
>
  <div ref={overlayLogoRef} className="">
    <img src={logoSusi} alt="SUSI Community" draggable={false} className="w-32 md:w-44 h-auto object-contain" />
  </div>
</div>

      <Cursor />

      {currentPage !== 'auth' && currentPage !== 'admin-login' && currentPage !== 'dashboard' && currentPage !== 'request' && (
        <Navigation
          currentPage={currentPage}
          navigateTo={navigateTo}
          goToSection={goToSection}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'home' && <HomePage navigateTo={navigateTo} goToSection={goToSection} />}
      {currentPage === 'auth' && <AuthPage onLogin={handleLogin} goToHome={goToHome} goAdmin={() => navigateTo('admin-login')} />}
      {currentPage === 'admin-login' && <AdminLoginPage onLogin={handleLogin} goToAuth={() => navigateTo('auth')} />}
      {currentPage === 'request' && user && <RequestPage user={user} navigateTo={navigateTo} />}

      {currentPage === 'dashboard' && user && (
        user.role === 'requester'
          ? <DashboardRequester user={user} onLogout={handleLogout} navigateTo={navigateTo} />
          : user.role === 'talent'
            ? <DashboardTalent user={user} onLogout={handleLogout} navigateTo={navigateTo} />
            : (user.role === 'liaison' || user.role === 'agensusi')
              ? <DashboardLiaison user={user} onLogout={handleLogout} navigateTo={navigateTo} />
              : user.role === 'admin'
                ? <DashboardAdmin user={user} onLogout={handleLogout} navigateTo={navigateTo} />
                : null
      )}

      {currentPage === 'tentang' && <TentangPage />}

      {currentPage !== 'auth' && currentPage !== 'admin-login' && currentPage !== 'dashboard' && currentPage !== 'request' && <Footer navigateTo={navigateTo} goToSection={goToSection} />}
    </div>
  );
}