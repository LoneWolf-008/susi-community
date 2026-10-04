import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { FaInstagram, FaDiscord, FaGithub, FaWhatsapp } from 'react-icons/fa';
import { CONTACT } from '../../data/contact';

export default function Footer({ navigateTo, goToSection }) {
  const ref = useRef(null);
  const [now, setNow] = useState(null);

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
    }, ref);
    return () => ctx.revert();
  }, []);

  const hh = now ? String(now.getHours()).padStart(2, '0') : '--';
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--';
  const ss = now ? String(now.getSeconds()).padStart(2, '0') : '--';

  const COL1 = [
    { l: 'Cara Kerja', fn: () => goToSection('alur') },
    { l: 'Fitur', fn: () => goToSection('fitur') },
    { l: 'Tentang Kami', fn: () => navigateTo('tentang') },
  ];
  const ICONS = { instagram: FaInstagram, discord: FaDiscord, github: FaGithub };
  // Hanya kontak yang sudah diatur (VITE_CONTACT_*) yang ditampilkan.
  const SOCIALS = [
    ...CONTACT.socials.map((s) => ({ l: s.label, href: s.href, Icon: ICONS[s.key] })),
    ...(CONTACT.whatsappNumber ? [{ l: 'WhatsApp', href: CONTACT.whatsappUrl(), Icon: FaWhatsapp }] : []),
  ];

  return (
    <footer
      ref={ref}
      className="relative overflow-hidden text-[#f2efe6]"
      style={{ background: 'linear-gradient(180deg,#0e2233 0%,#12283c 30%,#5c1216 62%,#a81f28 100%)' }}
    >
      <div className="px-6 lg:px-12 pt-24 pb-10 max-w-[1440px] mx-auto">
        {/* WORDMARK RAKSASA */}
        <h2 className="foot-reveal font-black tracking-tight leading-[0.85] text-[#e62b2b] text-[50px]">
          <span className="text-[#ffffff]">SUSI</span><br />Community<span className="text-[#f2efe6]">.</span>
        </h2>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* KOLOM KIRI: Brand & Info Kontak */}
          <div className="foot-reveal md:col-span-5 lg:col-span-4 space-y-4">
            <p className="font-mono text-[10px] font-bold tracking-[0.35em] text-[#f2efe6]/50">KANTOR</p>
            <p className="text-sm text-[#f2efe6]/80 leading-relaxed">
              {CONTACT.address}
            </p>
            {(CONTACT.email || CONTACT.whatsappDisplay) && (
              <div className="pt-2 font-mono text-xs text-[#f2efe6]/60 space-y-1">
                {CONTACT.email && <p>{CONTACT.email}</p>}
                {CONTACT.whatsappDisplay && <p>{CONTACT.whatsappDisplay}</p>}
              </div>
            )}
          </div>

          {/* KOLOM TENGAH: Navigasi Tautan */}
          <div className="foot-reveal md:col-span-3 lg:col-span-4 grid grid-cols-2 gap-6">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.35em] text-[#f2efe6]/50 mb-4">JELAJAH</p>
              <ul className="space-y-2.5">
                {COL1.map((x) => (
                  <li key={x.l}>
                    <button onClick={x.fn} className="text-sm font-medium text-[#f2efe6]/80 hover:text-white transition-colors">{x.l}</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* KOLOM KANAN: Card Jam Live Digital & Status Bandung */}
          <div className="foot-reveal md:col-span-4 rounded-2xl bg-white/[0.04] border border-white/10 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-[#f2efe6]/50">WAKTU SAAT INI</span>
            </div>
            <p className="font-mono text-4xl lg:text-5xl font-black tracking-tight tabular-nums text-white">
              {hh}:{mm}:{ss} <span className="text-xs font-bold text-[#f2efe6]/50">WIB</span>
            </p>
          </div>
        </div>

        {/* BAR BAWAH */}
        <div className="mt-16 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-[#f2efe6]/70">© 2026 - SUSI Community</p>
          <div className="flex items-center gap-5">
            {SOCIALS.map(({ l, href, Icon }) => (
              <a key={l} href={href} target="_blank" rel="noreferrer" title={l} className="text-[#f2efe6]/80 hover:text-white transition-colors">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}