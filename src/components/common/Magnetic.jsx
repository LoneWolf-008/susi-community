import { useRef } from 'react';
import gsap from 'gsap';

export default function Magnetic({ children, className = '', onClick, strength = 0.35 }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    gsap.to(ref.current, { x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength, duration: 0.3 });
  };
  const onLeave = () => gsap.to(ref.current, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick} className={`inline-block ${className}`}>
      {children}
    </div>
  );
}