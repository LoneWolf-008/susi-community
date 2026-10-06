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
   (4 tab + Menu) dan drawer berisi semua tab, notifikasi tampil sebagai sheet layar penuh.
   U10 (opsional, per peran): `mobileNav` = [{ id, l, icon }] → bilah bawah berikon dengan label satu baris
   ≥ 12 px tanpa nomor, penanda tab aktif, tinggi ±60 px; tab lain (mis. Profil, Pengaturan) lewat "Menu".
   Item `nav` boleh punya `m` = label pendek untuk mobile (mis. "Komunitas" untuk "Komunitas & Peta"). */
export default function DashShell({ user, roleLabel, nav, mobileNav, tab, onTab, notifications, onNotificationClick, onLogout, navigateTo, children }) {
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
  const iconNav = Array.isArray(mobileNav) && mobileNav.length > 0;
  useEffect(() => {
    document.documentElement.dataset.bottomNav = iconNav ? 'icons' : '1';
    return () => { delete document.documentElement.dataset.bottomNav; };
  }, [iconNav]);

  const openNotification = (n) => {
    notifications?.markRead(n.id);
    if (onNotificationClick) {
      onNotificationClick(n.raw);
      setOpen(false);
    }
  };
  const go = (id) => { setDrawer(false); onTab(id); };
  const first = (user?.name || 'SUSI').split(' ')[0];
  const primary = iconNav ? mobileNav : nav.slice(0, BOTTOM_ITEMS);
  const activeInMenu = !primary.some((n) => n.id === tab);
  const mobileLabel = (n) => (iconNav && n.m) || n.l;

  return (
    <div className="min-h-dvh bg-[#0e2233] text-[#f2efe6]">
      {/* TOPBAR (lengket). backdrop-blur hanya ≥ 768 px: backdrop-filter menjadikan header "containing block"
          bagi turunan position:fixed, sehingga panel notifikasi layar penuh di mobile terpotong setinggi header. */}
      {/* Panel notifikasi tinggal di dalam header: saat terbuka di mobile, header dinaikkan di atas bilah bawah
          (z-50) dan peluncur Tanya SUSI (z-400) agar keduanya tidak tergambar di atas panel. */}
      <header className={`fixed top-0 left-0 right-0 h-16 ${open ? 'z-[500] md:z-50' : 'z-50'} bg-[#0e2233] md:bg-[#0e2233]/90 md:backdrop-blur-md border-b border-white/10`}>
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
                {/* Kepala panel. Mobile (< 768 px): judul & jumlah lebih besar, tombol ≥ 44 px; desktop: ringkas seperti semula. */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 md:p-4 border-b border-white/10 shrink-0">
                  <div className="min-w-0">
                    <p className="text-lg md:text-sm font-black">
                      <span className="md:hidden">Notifikasi</span>
                      <span className="hidden md:inline">NOTIFIKASI</span>
                    </p>
                    <p className="text-[12px] text-[#f2efe6]/60 md:font-mono md:text-[9px] md:text-[#f2efe6] md:opacity-50">
                      <span className="md:hidden">{unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}</span>
                      <span className="hidden md:inline">{unread} BELUM DIBACA</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => notifications?.markAllRead()} disabled={unread === 0} className="min-h-[44px] px-3 md:px-2 rounded-full text-[12px] md:rounded-none md:font-mono md:text-[9px] font-bold text-[#e62b2b] hover:underline disabled:opacity-40 disabled:no-underline">
                      <span className="md:hidden">Tandai dibaca</span>
                      <span className="hidden md:inline">TANDAI SEMUA</span>
                    </button>
                    <button onClick={() => setOpen(false)} aria-label="Tutup notifikasi" className="md:hidden w-11 h-11 rounded-full border border-white/15 flex items-center justify-center">
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:max-h-[320px] pb-[env(safe-area-inset-bottom)] md:pb-0">
                  {notifications?.loading && <p className="p-6 text-center text-[13px] md:font-mono md:text-xs opacity-60 md:opacity-50">Memuat…</p>}
                  {notifications?.error && (
                    <div className="p-6 text-center">
                      <p className="text-[13px] md:font-mono md:text-xs opacity-70">Notifikasi gagal dimuat.</p>
                      <button onClick={() => notifications.refetch()} className="min-h-[44px] text-[13px] md:font-mono md:text-[10px] font-bold text-[#e62b2b] underline mt-2">Coba lagi</button>
                    </div>
                  )}
                  {!notifications?.loading && !notifications?.error && items.length === 0 && (
                    <p className="p-8 md:p-6 text-center text-[14px] md:font-mono md:text-xs opacity-60 md:opacity-50">Belum ada notifikasi.</p>
                  )}
                  {items.map((n) => (
                    <div
                      key={n.id}
                      data-notif={n.read ? 'dibaca' : 'baru'}
                      className={`group relative flex items-stretch border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${n.read ? 'md:opacity-50' : 'bg-white/[0.04] md:bg-transparent'}`}
                    >
                      {/* Belum dibaca (mobile): garis merah di kiri, bukan hanya warna/pudar. */}
                      {!n.read && <span aria-hidden="true" className="md:hidden absolute left-0 top-0 bottom-0 w-[3px] bg-[#e62b2b]" />}
                      <button onClick={() => openNotification(n)} className="flex-1 min-w-0 text-left px-4 py-4 pr-1 md:p-4 md:pr-2 flex gap-3">
                        <span className="w-2 h-2 mt-2 md:mt-1.5 shrink-0 rotate-45" style={{ background: n.color || '#e62b2b' }} />
                        <span className="flex-1 min-w-0">
                          <span className="chip-mono border-0 px-2 py-0.5 text-[10px] md:px-1.5 md:text-[8px] mb-1.5 md:mb-1 inline-block text-white" style={{ background: n.color || '#e62b2b' }}>{n.label || 'INFO'}</span>
                          <span className={`block text-[15px] md:text-xs leading-snug ${n.read ? 'font-bold text-[#f2efe6]/75 md:font-black md:text-[#f2efe6]' : 'font-black'}`}>{n.title}</span>
                          {/* Mobile: isi (maks. 2 baris) dan waktu di baris sendiri. Desktop: satu baris ringkas. */}
                          {n.body && <span className="md:hidden text-[13px] leading-snug text-[#f2efe6]/70 mt-1 line-clamp-2 break-words">{n.body}</span>}
                          {n.time && <span className="md:hidden block text-[12px] text-[#f2efe6]/50 mt-1">{n.time}</span>}
                          <span className="hidden md:block text-[10px] text-[#f2efe6]/50 mt-0.5 break-words">{n.sub}</span>
                        </span>
                        {!n.read && <span className="w-2 h-2 md:w-1.5 md:h-1.5 rounded-full bg-[#e62b2b] mt-2 md:mt-1 shrink-0" aria-label="Belum dibaca" />}
                      </button>
                      <button onClick={() => notifications?.remove(n.id)} aria-label={`Hapus notifikasi: ${n.title}`} className="min-w-[48px] md:min-w-[44px] px-3 flex items-center justify-center text-[#f2efe6]/50 md:text-sm md:font-black md:opacity-40 hover:opacity-100 hover:text-[#e62b2b] transition-opacity">
                        <X className="w-5 h-5 md:hidden" aria-hidden="true" />
                        <span className="hidden md:inline">×</span>
                      </button>
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

      {/* BILAH NAVIGASI BAWAH (< 768 px), varian berikon (U10): tab utama + Menu */}
      {iconNav && (
        <nav data-dash-nav aria-label="Navigasi dasbor" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0e2233] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileNav.length + 1}, minmax(0, 1fr))` }}>
            {[...mobileNav, { id: '__menu', l: 'Menu', icon: Menu }].map((n) => {
              const isMenu = n.id === '__menu';
              const active = isMenu ? activeInMenu : tab === n.id;
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  ref={isMenu ? menuRef : undefined}
                  {...(isMenu ? { 'data-dash-menu': true, 'aria-expanded': drawer, 'aria-label': 'Menu: tab lain, profil, pengaturan' } : { 'data-tab': n.l, 'aria-current': active ? 'page' : undefined })}
                  onClick={() => (isMenu ? setDrawer(true) : go(n.id))}
                  className={`relative h-[60px] min-w-0 px-1 flex flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-[#e62b2b]' : 'text-[#f2efe6]/75'}`}
                >
                  {/* Penanda aktif: garis atas + latar ikon (bukan warna saja). */}
                  {active && <span aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-b-full bg-[#e62b2b]" />}
                  <span className={`flex items-center justify-center w-11 h-7 rounded-full ${active ? 'bg-[#e62b2b]/15' : ''}`}>
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  </span>
                  <span className={`text-[12px] leading-none whitespace-nowrap truncate max-w-full ${active ? 'font-black' : 'font-semibold'}`}>{n.l}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* BILAH NAVIGASI BAWAH (< 768 px): 4 tab + Menu */}
      {!iconNav && (
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
      )}

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
                <button key={n.id} data-tab={mobileLabel(n)} onClick={() => go(n.id)} aria-current={tab === n.id ? 'page' : undefined} className={`w-full text-left rounded-full px-5 min-h-[48px] text-sm font-bold flex items-center gap-3 transition-colors ${tab === n.id ? 'bg-[#e62b2b] text-white' : 'text-[#f2efe6]/80 hover:bg-white/5'}`}>
                  {!iconNav && <span className="font-mono text-[10px] opacity-60">{n.n}</span>}{mobileLabel(n)}
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
      {/* Varian berikon: ruang bawah = bilah (60) + peluncur Tanya SUSI (56) + jarak, agar tombol di akhir
          halaman bisa digulir ke atas peluncur dan tidak tertutup. */}
      <main className={`pt-16 md:pt-28 lg:pt-16 lg:pl-60 ${iconNav ? 'pb-[calc(9.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'} md:pb-0 min-h-dvh bg-[#f2efe6] text-[#12283c]`}>
        <div className="px-4 sm:px-5 lg:px-10 py-6 md:py-10 max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
