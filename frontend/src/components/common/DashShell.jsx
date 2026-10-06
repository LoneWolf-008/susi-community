import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Menu, X } from 'lucide-react';
import { CONTACT, contactHref } from '../../data/contact';

const helpHref = contactHref('Halo tim SUSI, saya butuh bantuan.');
const BOTTOM_ITEMS = 4; // + tombol "Menu" = 5 item di bilah bawah

/* Shell dasbor gaya Think Co: chrome navy gelap + area konten krem.
   Pemakaian di setiap dashboard:
   const notifications = useNotifications({ onNew: reload });
   <DashShell user={user} roleLabel="KOMUNITAS" nav={NAV} tab={tab} onTab={setTab}
              notifications={notifications} onNotificationClick={(n) => ...}
              onLogout={onLogout} navigateTo={navigateTo}>
     ...isi tab...
   </DashShell>
   `onNotificationClick` menerima baris notifikasi backend ({ type, ref_type, ref_id, ... }).
   Tata letak (U3): ≥ 1024 px sidebar; 768–1023 px bilah tab atas; < 768 px bilah navigasi bawah
   (4 tab + Menu) dan drawer berisi semua tab, notifikasi tampil sebagai sheet layar penuh. */
export default function DashShell({ user, roleLabel, nav, tab, onTab, notifications, onNotificationClick, onLogout, navigateTo, children }) {
  const items = notifications?.items || [];
  const unread = notifications?.unread ?? 0;
  const [open, setOpen] = useState(false); // panel notifikasi
  const [drawer, setDrawer] = useState(false); // drawer navigasi (< 768 px)
  const ref = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    if (open) gsap.fromTo('.notif-panel', { y: -10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
  }, [open]);
  // Esc menutup panel/drawer; halaman di belakang sheet/drawer tidak ikut bergulir di layar kecil.
  const overlayOpen = open || drawer;
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      if (drawer) menuRef.current?.focus();
      setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    const small = window.matchMedia('(max-width: 767px)').matches;
    if (small) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (small) document.body.style.overflow = '';
    };
  }, [overlayOpen, drawer]);
  // Bilah bawah ada: peluncur Tanya SUSI dinaikkan di layar kecil (index.css: html[data-bottom-nav]).
  useEffect(() => {
    document.documentElement.dataset.bottomNav = '1';
    return () => { delete document.documentElement.dataset.bottomNav; };
  }, []);

  const openNotification = (n) => {
    notifications?.markRead(n.id);
    if (onNotificationClick) {
      onNotificationClick(n.raw);
      setOpen(false);
    }
  };
  const go = (id) => { setDrawer(false); onTab(id); };
  const first = (user?.name || 'SUSI').split(' ')[0];
  const primary = nav.slice(0, BOTTOM_ITEMS);
  const activeInMenu = !primary.some((n) => n.id === tab);

  return (
    <div className="min-h-dvh bg-[#0e2233] text-[#f2efe6]">
      {/* TOPBAR (lengket) */}
      <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-[#0e2233]/90 backdrop-blur-md border-b border-white/10">
        <div className="h-full px-4 lg:px-8 flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigateTo('home')} className="font-black tracking-tight text-base sm:text-lg min-h-[44px] hover:opacity-80 transition-opacity">
            SUSI <span className="text-[#e62b2b]">Community.</span>
          </button>
          <span className="chip-mono hidden md:inline-block text-[#f2efe6]/60">{roleLabel}</span>
          <div className="flex-1" />
          <div className="relative" ref={ref}>
            <button onClick={() => setOpen(!open)} aria-label={`Notifikasi, ${unread} belum dibaca`} aria-expanded={open} className={`relative w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${open ? 'bg-[#e62b2b] border-[#e62b2b]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="w-5 h-5" aria-hidden="true">
                <path d="M12 3v2" /><path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3v-4z" /><path d="M10 20h4" />
              </svg>
              {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 rounded-full bg-[#e62b2b] text-white text-[9px] font-black flex items-center justify-center border-2 border-[#0e2233]">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {open && (
              <div role="dialog" aria-label="Notifikasi" className="notif-panel fixed inset-0 z-[60] flex flex-col bg-[#12283c] pt-[env(safe-area-inset-top)] md:absolute md:inset-auto md:right-0 md:top-12 md:w-[380px] md:pt-0 md:border md:border-white/10 md:rounded-2xl md:overflow-hidden md:shadow-2xl">
                <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 shrink-0">
                  <div>
                    <p className="text-sm font-black">NOTIFIKASI</p>
                    <p className="font-mono text-[9px] opacity-50">{unread} BELUM DIBACA</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => notifications?.markAllRead()} disabled={unread === 0} className="min-h-[44px] px-2 font-mono text-[9px] font-bold text-[#e62b2b] hover:underline disabled:opacity-40 disabled:no-underline">TANDAI SEMUA</button>
                    <button onClick={() => setOpen(false)} aria-label="Tutup notifikasi" className="md:hidden w-11 h-11 rounded-full border border-white/15 flex items-center justify-center">
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto md:max-h-[320px] pb-[env(safe-area-inset-bottom)] md:pb-0">
                  {notifications?.loading && <p className="p-6 text-center font-mono text-xs opacity-50">MEMUAT…</p>}
                  {notifications?.error && (
                    <div className="p-6 text-center">
                      <p className="font-mono text-xs opacity-70">NOTIFIKASI GAGAL DIMUAT.</p>
                      <button onClick={() => notifications.refetch()} className="min-h-[44px] font-mono text-[10px] font-bold text-[#e62b2b] underline mt-2">COBA LAGI</button>
                    </div>
                  )}
                  {!notifications?.loading && !notifications?.error && items.length === 0 && <p className="p-6 text-center font-mono text-xs opacity-50">TIDAK ADA NOTIFIKASI.</p>}
                  {items.map((n) => (
                    <div key={n.id} className={`group flex items-stretch border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${n.read ? 'opacity-50' : ''}`}>
                      <button onClick={() => openNotification(n)} className="flex-1 min-w-0 text-left p-4 pr-2 flex gap-3">
                        <span className="w-2 h-2 mt-1.5 shrink-0 rotate-45" style={{ background: n.color || '#e62b2b' }} />
                        <span className="flex-1 min-w-0">
                          <span className="chip-mono border-0 px-1.5 py-0.5 text-[8px] mb-1 inline-block text-white" style={{ background: n.color || '#e62b2b' }}>{n.label || 'INFO'}</span>
                          <span className="block text-xs font-black leading-snug">{n.title}</span>
                          <span className="block text-[10px] text-[#f2efe6]/50 mt-0.5 break-words">{n.sub}</span>
                        </span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#e62b2b] mt-1 shrink-0" aria-label="Belum dibaca" />}
                      </button>
                      <button onClick={() => notifications?.remove(n.id)} aria-label={`Hapus notifikasi: ${n.title}`} className="min-w-[44px] px-3 text-sm font-black opacity-40 hover:opacity-100 hover:text-[#e62b2b] transition-opacity">×</button>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block p-3 border-t border-white/10 text-right">
                  <button onClick={() => setOpen(false)} className="font-mono text-[9px] font-bold opacity-50 hover:opacity-100">TUTUP</button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 pl-1 pr-1 sm:pr-4 py-1">
            <span className="w-7 h-7 rounded-full bg-[#e62b2b] text-white text-[10px] font-black flex items-center justify-center">{(user?.name || 'S').charAt(0).toUpperCase()}</span>
            <span className="text-xs font-bold hidden sm:block">{first}</span>
          </div>
          <button onClick={onLogout} className="chip-mono hidden md:inline-flex hover:text-[#e62b2b] transition-colors">KELUAR</button>
        </div>
      </header>

      {/* SIDEBAR DESKTOP (≥ 1024 px) */}
      <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-60 bg-[#0e2233] border-r border-white/10 p-5 flex-col z-40">
        <p className="label-mono mb-4">Navigasi</p>
        <div className="flex flex-col gap-1">
          {nav.map((n) => (
            <button key={n.id} onClick={() => onTab(n.id)} className={`w-full text-left rounded-full px-5 py-3 text-sm font-bold flex items-center gap-3 transition-colors ${tab === n.id ? 'bg-[#e62b2b] text-white' : 'text-[#f2efe6]/70 hover:bg-white/5 hover:text-[#f2efe6]'}`}>
              <span className="font-mono text-[10px] opacity-60">{n.n}</span>{n.l}
            </button>
          ))}
        </div>
        {helpHref && (
          <div className="mt-auto card-dark p-4">
            <p className="font-mono text-[10px] text-[#f2efe6]/50 leading-relaxed">
              Butuh bantuan?<br />
              <a href={helpHref} target="_blank" rel="noreferrer" className="hover:text-[#e62b2b]">
                {CONTACT.whatsappDisplay ? `WA: ${CONTACT.whatsappDisplay}` : CONTACT.email}
              </a>
            </p>
          </div>
        )}
      </aside>

      {/* BILAH TAB TABLET (768–1023 px) */}
      <div data-dash-nav className="hidden md:block lg:hidden fixed top-16 left-0 right-0 z-40 bg-[#0e2233]/95 backdrop-blur border-b border-white/10 overflow-x-auto">
        <div className="flex gap-2 px-4 py-3 w-max">
          {nav.map((n) => (
            <button key={n.id} data-tab={n.l} onClick={() => onTab(n.id)} className={`shrink-0 rounded-full px-4 min-h-[44px] text-[10px] font-black uppercase tracking-wider transition-colors ${tab === n.id ? 'bg-[#e62b2b] text-white' : 'bg-white/5 text-[#f2efe6]/70'}`}>
              {n.l}
            </button>
          ))}
        </div>
      </div>

      {/* BILAH NAVIGASI BAWAH (< 768 px): 4 tab + Menu */}
      <nav data-dash-nav aria-label="Navigasi dasbor" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0e2233] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {primary.map((n) => (
            <button key={n.id} data-tab={n.l} onClick={() => go(n.id)} aria-current={tab === n.id ? 'page' : undefined} className={`min-h-[56px] px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold leading-tight transition-colors ${tab === n.id ? 'text-[#e62b2b]' : 'text-[#f2efe6]/70'}`}>
              <span className={`font-mono text-[9px] ${tab === n.id ? 'opacity-100' : 'opacity-50'}`}>{n.n}</span>
              <span className="line-clamp-2 text-center break-words">{n.l}</span>
            </button>
          ))}
          <button ref={menuRef} data-dash-menu onClick={() => setDrawer(true)} aria-expanded={drawer} aria-label="Menu: semua tab dasbor" className={`min-h-[56px] px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${activeInMenu ? 'text-[#e62b2b]' : 'text-[#f2efe6]/70'}`}>
            <Menu className="w-5 h-5" aria-hidden="true" />
            Menu
          </button>
        </div>
      </nav>

      {/* DRAWER (< 768 px): semua tab, bantuan, keluar */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Menu dasbor">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="Tutup menu" tabIndex={-1} onClick={() => setDrawer(false)} />
          <aside data-dash-nav className="absolute left-0 top-0 bottom-0 w-[min(300px,85vw)] bg-[#0e2233] border-r border-white/10 flex flex-col overflow-y-auto pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10">
              <span className="chip-mono text-[#f2efe6]/60">{roleLabel}</span>
              <button type="button" autoFocus onClick={() => setDrawer(false)} aria-label="Tutup menu" className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-3">
              {nav.map((n) => (
                <button key={n.id} data-tab={n.l} onClick={() => go(n.id)} aria-current={tab === n.id ? 'page' : undefined} className={`w-full text-left rounded-full px-5 min-h-[48px] text-sm font-bold flex items-center gap-3 transition-colors ${tab === n.id ? 'bg-[#e62b2b] text-white' : 'text-[#f2efe6]/80 hover:bg-white/5'}`}>
                  <span className="font-mono text-[10px] opacity-60">{n.n}</span>{n.l}
                </button>
              ))}
            </div>
            <div className="mt-auto px-5 pt-4 space-y-3">
              {helpHref && (
                <a href={helpHref} target="_blank" rel="noreferrer" className="flex items-center min-h-[44px] font-mono text-[10px] text-[#f2efe6]/60">
                  Butuh bantuan? {CONTACT.whatsappDisplay ? `WA: ${CONTACT.whatsappDisplay}` : CONTACT.email}
                </a>
              )}
              <button type="button" onClick={onLogout} className="w-full btn-pill btn-ghost-light min-h-[44px]">Keluar</button>
            </div>
          </aside>
        </div>
      )}

      {/* KONTEN (KREM) */}
      <main className="pt-16 md:pt-28 lg:pt-16 lg:pl-60 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 min-h-dvh bg-[#f2efe6] text-[#12283c]">
        <div className="px-4 sm:px-5 lg:px-10 py-6 md:py-10 max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
