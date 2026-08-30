import { useState, useEffect } from 'react';
import Magnetic from './Magnetic';

export default function Navigation({ currentPage, navigateTo, goToSection, menuOpen, setMenuOpen, user, onLogout }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav className={`fixed z-[100] left-1/2 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrolled
        ? 'top-4 w-[min(1100px,94%)] h-16 rounded-full bg-white/60 backdrop-blur-[20px] border border-black/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] scale-[0.97]'
        : 'top-0 w-full h-20 rounded-none bg-white border-b-2 border-black scale-100'
        }`}>
        <div className="h-full px-5 md:px-8 flex items-center justify-between">
          <button onClick={() => navigateTo('home')} className={`font-black tracking-tighter hover:text-[#FF5733] transition-all duration-500 ${scrolled ? 'text-2xl' : 'text-3xl'}`}>
            SUSI<span className="text-[#FF5733]">.</span>
          </button>

          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => goToSection('alur')} className="text-xs uppercase tracking-[0.25em] font-bold hover:text-[#FF5733] transition-colors">Cara Kerja</button>
            <button onClick={() => goToSection('fitur')} className="text-xs uppercase tracking-[0.25em] font-bold hover:text-[#FF5733] transition-colors">Fitur</button>
            <button onClick={() => navigateTo('tentang')} className={`text-xs uppercase tracking-[0.25em] font-bold transition-colors ${currentPage === 'tentang' ? 'text-[#FF5733]' : 'hover:text-[#FF5733]'}`}>Tentang Kami</button>

            {user ? (
              <div className="flex items-center gap-3">
                <button onClick={() => navigateTo('dashboard')} className="flex items-center gap-2 border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors">
                  <span className="w-5 h-5 bg-[#FF5733] text-white text-[10px] font-black flex items-center justify-center">{user.name.charAt(0).toUpperCase()}</span>
                  <span className="text-xs font-bold">{user.name.split(' ')[0]}</span>
                </button>
                <button onClick={onLogout} className="text-xs font-mono font-bold hover:text-[#FF5733] transition-colors">KELUAR</button>
              </div>
            ) : (
              <Magnetic>
                <button onClick={() => navigateTo('dashboard')} className={`text-xs uppercase tracking-wider font-bold transition-all duration-500 ${scrolled ? 'bg-black text-white hover:bg-[#FF5733] px-6 py-2.5 rounded-full' : 'bg-black text-white hover:bg-[#FF5733] px-8 py-3 rounded-none'
                  }`}>Mulai →</button>
              </Magnetic>
            )}
          </div>

          <button className="lg:hidden w-10 h-10 flex flex-col justify-center items-center gap-1.5" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={`block w-6 h-0.5 bg-black transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-black transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-black transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      <div className={`lg:hidden fixed z-[99] left-1/2 -translate-x-1/2 w-[94%] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${menuOpen ? 'top-24 opacity-100 scale-100' : 'top-16 opacity-0 scale-95 pointer-events-none'
        } rounded-3xl bg-white/80 backdrop-blur-[20px] border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden`}>
        <div className="px-8 py-6 flex flex-col gap-4">
          <button onClick={() => { goToSection('alur'); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 border-b border-black/10 hover:text-[#FF5733] transition-colors">Cara Kerja</button>
          <button onClick={() => { goToSection('fitur'); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 border-b border-black/10 hover:text-[#FF5733] transition-colors">Fitur</button>
          <button onClick={() => { navigateTo('tentang'); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 hover:text-[#FF5733] transition-colors">Tentang</button>
          {user && <button onClick={() => { onLogout(); setMenuOpen(false); }} className="text-left text-lg font-bold uppercase tracking-wider py-2 text-[#FF5733]">Keluar</button>}
        </div>
      </div>
    </>
  );
}