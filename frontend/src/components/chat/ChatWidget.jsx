import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import { useChat } from '../../hooks/useChat';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/authContext';
import { useNavigateTo } from '../../context/transitionContext';
import { PUBLIC_SUGGESTIONS } from '../../data/askSuggestions';
import { OPEN_CHAT_EVENT, RUANG_AGEN_ROLES, ruangAgenPath } from '../../lib/chatNavigation';
import { hasHandoff } from '../../lib/handoff';

// Widget Tanya SUSI tunggal (T14), menggantikan AskSusiPanel (publik) dan AiAgent (dasbor).
//  - variant "overlay": layar penuh untuk halaman publik, dibuka dari landing/navigasi (boleh
//    membawa pertanyaan awal lewat `seed`).
//  - variant "floating": tombol melayang + panel untuk dasbor.
// Mode publik vs masuk mengikuti AuthContext (useChat). Saran dimuat saat dibuka; riwayat juga, kecuali
// tombol melayang yang memulihkan percakapan tersimpan sejak awal agar balasan AgenSUSI yang masuk
// saat widget tertutup bisa ditandai titik di peluncur (U6). Di layar kecil panel tampil penuh.

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fokus awal ke kolom tanya, Tab tetap di dalam dialog, Esc menutup, fokus kembali ke pemicu.
 * Didengarkan di tingkat dokumen: fokus bisa jatuh ke <body> saat elemen yang sedang fokus hilang
 * (mis. tombol form eskalasi setelah terkirim). Tombol yang ditujukan ke dialog lain (Modal) diabaikan.
 */
function useDialogFocus(open, dialogRef, inputRef, onClose) {
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = dialogRef.current;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e) => {
      const owner = e.target instanceof Element ? e.target.closest('[role="dialog"]') : null;
      if (!node || (owner && owner !== node)) return;
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!node.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, dialogRef, inputRef]);
}

export default function ChatWidget({ variant = 'floating', open: openProp = false, onClose, seed }) {
  const overlay = variant === 'overlay';
  const [floatingOpen, setFloatingOpen] = useState(false);
  const open = overlay ? openProp : floatingOpen;
  const [activated, setActivated] = useState(open);
  if (open && !activated) setActivated(true);

  const { user } = useAuth();
  const navigateTo = useNavigateTo();
  const chat = useChat({ enabled: activated || !overlay, active: open });
  const suggestionsQ = useApi(
    (signal) => api.get('/chatbot/suggestions', { signal }),
    [user?.role ?? 'public'],
    { enabled: activated },
  );
  const suggestions = suggestionsQ.data?.suggestions ?? (user ? [] : PUBLIC_SUGGESTIONS);

  const titleId = useId();
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const close = () => (overlay ? onClose?.() : setFloatingOpen(false));
  useDialogFocus(open, dialogRef, inputRef, close);

  // Ruang AgenSUSI (U6): halaman penuh untuk peran yang memilikinya → tombol "Buka di ruang penuh".
  const openFull = RUANG_AGEN_ROLES.includes(user?.role) && hasHandoff(chat.handoff)
    ? () => { close(); navigateTo(ruangAgenPath(chat.handoff.ticket_id)); }
    : undefined;
  // Halaman Ruang AgenSUSI meminta widget dibuka ("Pertanyaan baru ke AI").
  const onOpenRequest = useEffectEvent(() => { if (!overlay) setFloatingOpen(true); });
  useEffect(() => {
    const handler = () => onOpenRequest();
    window.addEventListener(OPEN_CHAT_EVENT, handler);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handler);
  }, []);

  // Pertanyaan awal dari landing/navigasi: dikirim sekali per pembukaan, setelah riwayat termuat.
  const lastSeed = useRef(0);
  const { send, restoring } = chat;
  useEffect(() => {
    if (!open || !seed?.q || seed.n === lastSeed.current || restoring) return;
    lastSeed.current = seed.n;
    send(seed.q);
  }, [open, seed?.q, seed?.n, restoring, send]);

  // ===== Overlay: animasi masuk/keluar & kunci scroll halaman =====
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
    else setVisible(false);
  }
  useEffect(() => {
    if (!overlay) return undefined;
    if (open) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
      return () => {
        cancelAnimationFrame(raf);
        document.body.style.overflow = '';
      };
    }
    // Lepas dari DOM setelah animasi keluar — hanya bila memang sedang terpasang. Menjadwalkan
    // setMounted(false) saat sudah false (mis. saat halaman dimuat) meninggalkan update tertunda
    // yang kemudian menimpa setMounted(true) ketika overlay dibuka (regresi uji browser T14).
    if (!mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), 650);
    return () => clearTimeout(timer);
  }, [open, overlay, mounted]);

  const panel = (dark) => (
    <ChatPanel chat={chat} suggestions={suggestions} dark={dark} anonymous={!user} onClose={close} titleId={titleId} inputRef={inputRef} compactHeader={!dark} onOpenFull={openFull} />
  );

  if (overlay) {
    if (!mounted) return null;
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-[600] overflow-hidden"
        style={{
          transition: 'transform 0.65s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          opacity: visible ? 1 : 0,
          background: 'radial-gradient(ellipse at 85% 15%, #2a1318 0%, #0e2233 45%, #050a14 100%)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none noise-overlay" style={{ opacity: 0.08 }} />
        <div className="relative w-full h-full grid grid-cols-1 lg:grid-cols-[38%_1fr]">
          <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-white/5 min-h-0">
            <button type="button" onClick={close} className="self-start group flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-[#e62b2b] hover:border-[#e62b2b] transition-all" aria-label="Tutup Tanya SUSI">
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#f2efe6]/70 group-hover:text-white">TUTUP</span>
              <X className="w-3.5 h-3.5 text-[#f2efe6]/70 group-hover:text-white" aria-hidden="true" />
            </button>
            <div>
              <p className="text-[clamp(3.2rem,9vh,6.5rem)] font-black text-[#f2efe6] leading-[0.9] tracking-[-0.03em]" aria-hidden="true">
                Tanya<br /><span className="text-[#e62b2b]">SUSI</span>.
              </p>
              <p className="mt-6 text-[#f2efe6]/60 text-base leading-relaxed max-w-sm">
                Asisten AI yang menjawab dari panduan resmi SUSI Community. Untuk hal penting atau masalah khusus, AgenSUSI siap membantu langsung.
              </p>
            </div>
            <p className="font-mono text-[9px] tracking-[0.25em] text-[#f2efe6]/30 font-bold flex items-center gap-2">
              <Sparkles className="w-3 h-3" aria-hidden="true" /> JAWABAN DIBUAT AI DAN BISA KELIRU
            </p>
          </div>
          <div className="min-h-0 h-full max-w-3xl w-full mx-auto lg:mx-0">{panel(true)}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFloatingOpen(true)}
        aria-label={chat.unread > 0 ? `Buka Tanya SUSI, ${chat.unread} balasan AgenSUSI belum dibaca` : 'Buka Tanya SUSI'}
        aria-haspopup="dialog"
        className={`${open ? 'hidden' : 'flex'} group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[400] w-14 h-14 rounded-full bg-[#e62b2b] hover:bg-[#12283c] text-white items-center justify-center shadow-[0_10px_30px_rgba(230,43,43,0.4)] transition-colors`}
      >
        <Sparkles className="w-6 h-6 fill-current" strokeWidth={2.5} aria-hidden="true" />
        {chat.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#12283c] text-[#f2efe6] text-[10px] font-black flex items-center justify-center border-2 border-[#f2efe6]" aria-hidden="true">
            {chat.unread > 9 ? '9+' : chat.unread}
          </span>
        )}
        <span className="absolute right-full mr-3 whitespace-nowrap font-mono text-[10px] font-bold tracking-widest text-[#12283c] bg-[#f2efe6] border border-[#12283c]/15 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {chat.unread > 0 ? 'BALASAN AGENSUSI' : 'TANYA SUSI'}
        </span>
      </button>
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed z-[400] inset-0 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[400px] h-dvh sm:h-[min(600px,calc(100dvh-3rem))] flex flex-col sm:rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.35)] sm:border border-[#12283c]/15 bg-[#f2efe6]"
        >
          {panel(false)}
        </div>
      )}
    </>
  );
}
