import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const xDot = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2.out' });
    const yDot = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2.out' });
    const xRing = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3.out' });
    const yRing = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3.out' });

    const move = (e) => {
      xDot(e.clientX); yDot(e.clientY);
      xRing(e.clientX); yRing(e.clientY);
      gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2 });
    };
    const leave = () => gsap.to([dot, ring], { autoAlpha: 0, duration: 0.2 });

    const over = (e) => {
      const el = e.target instanceof Element ? e.target.closest('a,button,[data-hover],input,textarea,select,label') : null;
      if (el) {
        gsap.to(ring, { scale: 1.7, duration: 0.3, ease: 'power2.out' });
        gsap.to(dot, { scale: 0.5, duration: 0.3 });
      } else {
        gsap.to(ring, { scale: 1, duration: 0.3, ease: 'power2.out' });
        gsap.to(dot, { scale: 1, duration: 0.3 });
      }
    };
    const down = () => gsap.to(ring, { scale: 0.8, duration: 0.15 });
    const up = () => gsap.to(ring, { scale: 1, duration: 0.3, ease: 'power2.out' });

    window.addEventListener('mousemove', move);
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, []);

  return (
    <>
      {/* cincin pengikut — warna auto-invert */}
      <div
        ref={ringRef}
        className="fixed left-0 top-0 w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white pointer-events-none z-[9999] hidden md:block"
        style={{ mixBlendMode: 'difference', opacity: 0 }}
      />
      {/* titik pusat */}
      <div
        ref={dotRef}
        className="fixed left-0 top-0 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-white pointer-events-none z-[9999] hidden md:block"
        style={{ mixBlendMode: 'difference', opacity: 0 }}
      />
    </>
  );
}