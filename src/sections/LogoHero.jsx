import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import logoSusi from '../assets/logo-susi.svg';

export default function LogoHero() {
  const wrapRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.logo-img',
        { autoAlpha: 0, scale: 0.4, rotation: -20 },
        { autoAlpha: 1, scale: 1, rotation: 0, duration: 1.2, ease: 'elastic.out(1, 0.5)', delay: 0.45 }
      );
      gsap.to('.logo-img', { y: -14, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.8 });
      gsap.to('.logo-ring', { rotation: 360, duration: 10, repeat: -1, ease: 'none' });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  const onMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 16;
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -16;
    gsap.to('.logo-img', { rotationY: ry, rotationX: rx, transformPerspective: 700, duration: 0.4, ease: 'power2.out' });
  };
  const onLeave = () => {
    gsap.to('.logo-img', { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      title="Klik logonya!"
      className="relative w-full max-w-[300px] lg:max-w-[380px] mx-auto flex items-center justify-center cursor-pointer select-none"
      style={{ aspectRatio: '1 / 1' }} 
    >
      <div className="logo-ring absolute inset-2 border-2 border-dashed border-[#FF5733]/40 rounded-full" />
      <div className="absolute inset-8 border-2 border-black/10 rounded-full" />
      <img
        src={logoSusi}
        alt="Logo SUSI Community"
        draggable={false}
        className="logo-img relative z-10 w-[100%] h-[100%] object-contain drop-shadow-[6px_6px_0_rgba(255,87,51,0.25)]"
      />
    </div>
  );
}