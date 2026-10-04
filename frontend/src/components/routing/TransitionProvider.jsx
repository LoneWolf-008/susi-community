import { useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import gsap from 'gsap';
import logoSusi from '../../assets/logo-susi.svg';
import { TransitionContext } from '../../context/transitionContext';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Layar transisi antar halaman (dipindah dari App.jsx). Overlay merah naik menutup layar,
// rute berganti di balik overlay, lalu overlay navy turun membuka halaman baru.
export default function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const overlayRef = useRef(null);
  const logoRef = useRef(null);
  const busyRef = useRef(false);

  const go = useCallback((to, { replace = false, state } = {}) => {
    if (to === pathname && !state) return;
    const overlay = overlayRef.current;
    const finish = () => {
      navigate(to, { replace, state });
      window.scrollTo(0, 0);
    };
    if (!overlay || prefersReducedMotion()) {
      finish();
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    gsap.timeline({ onComplete: () => { busyRef.current = false; } })
      .set(overlay, { y: '100%', backgroundColor: '#e62b2b' })
      .to(overlay, { y: '0%', duration: 0.55, ease: 'power4.inOut' })
      .add(finish)
      .set(overlay, { backgroundColor: '#0e2233' })
      .to(overlay, { y: '-100%', duration: 0.55, ease: 'power4.inOut' })
      .set(overlay, { y: '100%' });
  }, [navigate, pathname]);

  const onOverlayMove = (e) => {
    if (!logoRef.current) return;
    gsap.to(logoRef.current, {
      x: (e.clientX / window.innerWidth - 0.5) * 30,
      y: (e.clientY / window.innerHeight - 0.5) * 30,
      duration: 0.4, ease: 'power2.out',
    });
  };

  const value = useMemo(() => ({ go }), [go]);

  return (
    <TransitionContext.Provider value={value}>
      <div
        ref={overlayRef}
        onMouseMove={onOverlayMove}
        aria-hidden="true"
        className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden"
        style={{ transform: 'translateY(100%)', backgroundColor: '#e62b2b' }}
      >
        <div ref={logoRef}>
          <img src={logoSusi} alt="" draggable={false} className="w-32 md:w-44 h-auto object-contain brightness-0 invert" />
        </div>
      </div>
      {children}
    </TransitionContext.Provider>
  );
}
