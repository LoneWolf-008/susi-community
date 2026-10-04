import { createContext, useCallback, useContext } from 'react';
import { useLocation } from 'react-router';
import gsap from 'gsap';

export const TransitionContext = createContext(null);

// Nama halaman lama (navigasi berbasis state) → path router. Komponen lama tetap bisa
// memanggil navigateTo('dashboard') tanpa diubah satu per satu.
export const PAGE_PATHS = {
  home: '/',
  auth: '/masuk',
  'admin-login': '/admin',
  tentang: '/tentang',
  request: '/ajukan',
  dashboard: '/dashboard',
};

/** go(path, { replace, state }) — jalankan overlay GSAP lalu navigasi. */
export function useTransitionNavigate() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransitionNavigate harus dipakai di dalam <TransitionProvider>');
  return ctx.go;
}

/** navigateTo('dashboard') → go('/dashboard'); path biasa juga diterima. */
export function useNavigateTo() {
  const go = useTransitionNavigate();
  return useCallback((page, options) => go(PAGE_PATHS[page] ?? page, options), [go]);
}

/** Gulir ke section beranda (#alur, #fitur, ...); pindah ke beranda dulu bila perlu. */
export function useGoToSection() {
  const go = useTransitionNavigate();
  const { pathname } = useLocation();
  return useCallback((id) => {
    const scroll = () => gsap.to(window, { scrollTo: { y: `#${id}`, offsetY: 90 }, duration: 1, ease: 'power2.inOut' });
    if (pathname !== '/') {
      go('/');
      gsap.delayedCall(1.2, scroll);
    } else {
      scroll();
    }
  }, [go, pathname]);
}
