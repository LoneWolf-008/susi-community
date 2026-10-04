import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CONTACT, contactHref } from '../../data/contact';

const helpHref = contactHref('Halo tim SUSI, saya butuh bantuan.');

/* Shell dasbor gaya Think Co: chrome navy gelap + area konten krem.
   Pemakaian di setiap dashboard:
   const notifications = useNotifications({ onNew: reload });
   <DashShell user={user} roleLabel="KOMUNITAS" nav={NAV} tab={tab} onTab={setTab}
              notifications={notifications} onNotificationClick={(n) => ...}
              onLogout={onLogout} navigateTo={navigateTo}>
     ...isi tab...
   </DashShell>
   `onNotificationClick` menerima baris notifikasi backend ({ type, ref_type, ref_id, ... }). */
export default function DashShell({ user, roleLabel, nav, tab, onTab, notifications, onNotificationClick, onLogout, navigateTo, children }) {
  const items = notifications?.items || [];
  const unread = notifications?.unread ?? 0;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    if (open) gsap.fromTo('.notif-panel', { y: -10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
  }, [open]);
  const openNotification = (n) => {
    notifications?.markRead(n.id);
    if (onNotificationClick) {
      onNotificationClick(n.raw);
      setOpen(false);
    }
  };
  const first = (user?.name || 'SUSI').split(' ')[0];
  return (
    <div className="min-h-screen bg-[#0e2233] text-[#f2efe6]">
      {/* TOPBAR */}
      <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-[#0e2233]/90 backdrop-blur-md border-b border-white/10">
        <div className="h-full px-5 lg:px-8 flex items-center gap-4">
          <button onClick={() => navigateTo('home')} className="font-black tracking-tight text-lg hover:opacity-80 transition-opacity">
            SUSI <span className="text-[#e62b2b]">Community.</span>
          </button>
          <span className="chip-mono hidden md:inline-block text-[#f2efe6]/60">{roleLabel}</span>
          <div className="flex-1" />
          <div className="relative" ref={ref}>
            <button onClick={() => setOpen(!open)} aria-label={`Notifikasi, ${unread} belum dibaca`} aria-expanded={open} className={`relative w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${open ? 'bg-[#e62b2b] border-[#e62b2b]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="w-5 h-5" aria-hidden="true">
                <path d="M12 3v2" /><path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3v-4z" /><path d="M10 20h4" />
              </svg>
              {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 rounded-full bg-[#e62b2b] text-white text-[9px] font-black flex items-center justify-center border-2 border-[#0e2233]">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {open && (
              <div className="notif-panel absolute right-0 top-12 w-[340px] md:w-[380px] bg-[#12283c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[60]">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div>
                    <p className="text-sm font-black">NOTIFIKASI</p>
                    <p className="font-mono text-[9px] opacity-50">{unread} BELUM DIBACA</p>
                  </div>
                  <button onClick={() => notifications?.markAllRead()} disabled={unread === 0} className="font-mono text-[9px] font-bold text-[#e62b2b] hover:underline disabled:opacity-40 disabled:no-underline">TANDAI SEMUA</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications?.loading && <p className="p-6 text-center font-mono text-xs opacity-50">MEMUAT…</p>}
                  {notifications?.error && (
                    <div className="p-6 text-center">
                      <p className="font-mono text-xs opacity-70">NOTIFIKASI GAGAL DIMUAT.</p>
                      <button onClick={() => notifications.refetch()} className="font-mono text-[10px] font-bold text-[#e62b2b] underline mt-2">COBA LAGI</button>
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
                      <button onClick={() => notifications?.remove(n.id)} aria-label={`Hapus notifikasi: ${n.title}`} className="px-3 text-sm font-black opacity-40 hover:opacity-100 hover:text-[#e62b2b] transition-opacity">×</button>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/10 text-right">
                  <button onClick={() => setOpen(false)} className="font-mono text-[9px] font-bold opacity-50 hover:opacity-100">TUTUP</button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 pl-1 pr-4 py-1">
            <span className="w-7 h-7 rounded-full bg-[#e62b2b] text-white text-[10px] font-black flex items-center justify-center">{(user?.name || 'S').charAt(0).toUpperCase()}</span>
            <span className="text-xs font-bold hidden sm:block">{first}</span>
          </div>
          <button onClick={onLogout} className="chip-mono hover:text-[#e62b2b] transition-colors">KELUAR</button>
        </div>
      </header>

      {/* SIDEBAR DESKTOP */}
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

      {/* NAV MOBILE */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-[#0e2233]/95 backdrop-blur border-b border-white/10 overflow-x-auto">
        <div className="flex gap-2 px-4 py-3 w-max">
          {nav.map((n) => (
            <button key={n.id} onClick={() => onTab(n.id)} className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${tab === n.id ? 'bg-[#e62b2b] text-white' : 'bg-white/5 text-[#f2efe6]/70'}`}>
              {n.l}
            </button>
          ))}
        </div>
      </div>

      {/* KONTEN (KREM) */}
      <main className="pt-28 lg:pt-16 lg:pl-60 min-h-screen bg-[#f2efe6] text-[#12283c]">
        <div className="px-5 lg:px-10 py-10 max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}