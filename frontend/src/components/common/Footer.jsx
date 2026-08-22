import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { FaInstagram, FaDiscord, FaGithub, FaWhatsapp } from 'react-icons/fa';

export default function Footer({ navigateTo, goToSection }) {
  const ref = useRef(null);
 
  const [now, setNow] = useState(null);
  const [copied, setCopied] = useState(false);

  /* Jam markas live (WIB) */
  useEffect(() => {
    const tick = () => setNow(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.foot-reveal', { y: 40, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 88%' },
      });
      gsap.to('.foot-marquee', { xPercent: -50, ease: 'none', duration: 25, repeat: -1 });
        gsap.to('.foot-giant', { xPercent: -50, ease: 'none', duration: 40, repeat: -1 });
    }, ref);
    return () => ctx.revert();
  }, []);

  const hh = now ? String(now.getHours()).padStart(2, '0') : '--';
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--';
  const ss = now ? String(now.getSeconds()).padStart(2, '0') : '--';

  const copyEmail = () => {
    try { navigator.clipboard.writeText('halosusi@gmail.com'); } catch (_) {}  
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollTop = () => gsap.to(window, { scrollTo: { y: 0 }, duration: 1.2, ease: 'power3.inOut' });

  const LINKS = [
    { l: 'CARA KERJA', fn: () => (goToSection ? goToSection('alur') : navigateTo('home')) },
    { l: 'FITUR', fn: () => (goToSection ? goToSection('fitur') : navigateTo('home')) },
    { l: 'TENTANG KAMI', fn: () => navigateTo('tentang') },
  ];
 const SOCIALS = [
  { l: 'Instagram', href: 'https://instagram.com', Icon: FaInstagram },
  { l: 'Discord', href: 'https://discord.com', Icon: FaDiscord },
  { l: 'GitHub', href: 'https://github.com', Icon: FaGithub },
  { l: 'WhatsApp', href: 'https://wa.me/62221234567', Icon: FaWhatsapp },
];

  return (
    <footer ref={ref} className="bg-black text-white relative overflow-hidden">
    
    
      {/* GRID INFO */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 grid grid-cols-2 lg:grid-cols-4 gap-10">
        {/* LOGO + SOSMED */}
        <div className="foot-reveal col-span-2 lg:col-span-1">
          <h2 className="text-3xl font-black tracking-tighter">SUSI<span className="text-[#FF5733]">.</span></h2>
          <p className="text-xs opacity-40 mt-4 leading-relaxed">BUILD THE FUTURE.</p>
          <div className="flex gap-2 mt-6">
              {SOCIALS.map(({ l, href, Icon }) => (
                <a
                  key={l}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={l}
                  className="w-10 h-10 border-2 border-white/30 flex items-center justify-center hover:bg-[#FF5733] hover:border-[#FF5733] hover:-translate-y-1 transition-all"
                >
                      <Icon className="w-4 h-4" />
                    </a>
                  ))}
                </div>
        </div>

        {/* NAVIGASI */}
        <div className="foot-reveal">
          <p className="text-[10px] font-mono font-bold opacity-40 mb-5">JELAJAH</p>
          <ul className="space-y-3">
            {LINKS.map((l) => (
              <li key={l.l}>
                <button onClick={l.fn} className="group flex items-center gap-2 text-sm font-bold hover:text-[#FF5733] transition-colors">
                  <span className="w-0 group-hover:w-3 h-0.5 bg-[#FF5733] transition-all" />
                  {l.l}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* KONTAK */}
        <div className="foot-reveal">
          <p className="text-[10px] font-mono font-bold opacity-40 mb-5">KONTAK</p>
          <button onClick={copyEmail} className="group flex items-center gap-2 text-sm font-bold hover:text-[#FF5733] transition-colors">
            {copied ? '✓ TERSALIN!' : 'halosusi@gmail.com'}
            {!copied && <span className="text-[10px] font-mono opacity-40 group-hover:opacity-100">⧉</span>}
          </button>
          <p className="text-sm font-bold mt-3">+62 22 123 4567</p>
          <p className="text-xs opacity-40 mt-4 leading-relaxed">Jl. Kliningan No. 4<br />Kota Bandung, Jawa Barat, Indonesia, 40132</p>
        </div>

        {/* JAM MARKAS LIVE */}
        <div className="foot-reveal">
          <p className="text-[10px] font-mono font-bold opacity-40 mb-5">WAKTU SAAT INI</p>
          <p className="text-3xl font-mono font-black tabular-nums">{hh}:{mm}:{ss}<span className="text-xs ml-1 opacity-40">WIB</span></p>
          
          
        </div>
      </div>


      {/* BAR BAWAH */}
      <div className="border-t border-white/10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[10px] font-mono opacity-40">© 2026 · SUSI COMMUNITY</p>
          <button onClick={scrollTop} className="group flex items-center gap-2 text-[10px] font-mono font-bold hover:text-[#FF5733] transition-colors">
            KEMBALI KE ATAS <span className="inline-block group-hover:-translate-y-1 transition-transform">↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
}