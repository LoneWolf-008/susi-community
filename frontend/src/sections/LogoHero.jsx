import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import logoSusi from '../assets/logo-susi.svg';

export default function LogoHero() {
  const wrapRef = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Masuk halus (power3), bukan elastic
      gsap.fromTo('.logo-img',
        { autoAlpha: 0, scale: 0.6, rotation: -10 },
        { autoAlpha: 1, scale: 1, rotation: 0, duration: 1.1, ease: 'power3.out', delay: 0.45 });
      // Mengambang pelan
      gsap.to('.logo-img', { y: -12, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.6 });
      gsap.to('.logo-ring', { rotation: 360, duration: 12, repeat: -1, ease: 'none' });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  const onMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 14;
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -14;
    gsap.to('.logo-img', { rotationY: ry, rotationX: rx, transformPerspective: 700, duration: 0.5, ease: 'power2.out' });
  };
  const onLeave = () => gsap.to('.logo-img', { rotationX: 0, rotationY: 0, duration: 0.8, ease: 'power3.out' });

  return (
    <div ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave} title="Klik logonya!"
      className="relative w-full max-w-[300px] lg:max-w-[380px] mx-auto flex items-center justify-center cursor-pointer select-none"
      style={{ aspectRatio: '1 / 1' }}>
      <div className="logo-ring absolute inset-2 border-2 border-dashed border-[#FF5733]/40 rounded-full" />
      <div className="absolute inset-8 border-2 border-black/10 rounded-full" />
      <img src={logoSusi} alt="Logo SUSI Community" draggable={false}
        className="logo-img relative z-10 w-[100%] h-[100%] object-contain drop-shadow-[6px_6px_0_rgba(255,87,51,0.25)]" />
    </div>
  );
}