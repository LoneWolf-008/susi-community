import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { findReply } from '../../utils/askSusi';

export default function AskSusiPanel({ open, seedQ, seedN, onClose }) {
  const [msgs, setMsgs]     = useState([]);
  const [input, setInput]   = useState('');
  const [typing, setTyping] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  const bodyRef  = useRef(null);
  const inputRef = useRef(null);
  const lastSeed = useRef(0);
  const greeted  = useRef(false);

  /* ===== MOUNT / UNMOUNT =====
     Perubahan `open` disesuaikan saat render (pola "state dari props" React), bukan
     lewat setState sinkron di efek; efek hanya menjadwalkan animasi & unmount. */
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
    else setVisible(false);
  }
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      const focus = setTimeout(() => inputRef.current?.focus(), 700);
      return () => { cancelAnimationFrame(raf); clearTimeout(focus); };
    }
    const t = setTimeout(() => setMounted(false), 650);
    return () => clearTimeout(t);
  }, [open]);

  /* ===== KUNCI SCROLL + ESC ===== */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  /* ===== KIRIM ===== */
  const send = (raw) => {
    const t = (raw ?? input).trim();
    if (!t || typing) return;
    setMsgs((m) => [...m, { who: 'user', id: Date.now() + Math.random(), text: t }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { who: 'ai', id: Date.now() + Math.random(), text: findReply(t) }]);
    }, 700 + Math.random() * 600);
  };

  /* ===== SALAM PERTAMA ===== */
  useEffect(() => {
    if (open && !greeted.current) {
      greeted.current = true;
      const t = setTimeout(() => setMsgs([{ who: 'ai', id: Date.now(), text: 'Halo! Saya **Agen SUSI AI** 👋\nKetik pertanyaanmu — saya jawab langsung di halaman ini.' }]), 800);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* ===== SEED DARI LANDING / MENU ===== */
  useEffect(() => {
    if (open && seedQ && seedN && seedN !== lastSeed.current) {
      lastSeed.current = seedN;
      const t = setTimeout(() => send(seedQ), 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedN]);

  /* ===== AUTO SCROLL ===== */
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, typing]);

  /* ===== RENDER **bold** ===== */
  const renderText = (text) =>
    text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="leading-relaxed">
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} className="font-bold text-[#c9ecd9]">{p.slice(2, -2)}</strong>
              : <span key={j}>{p}</span>
          )}
        </p>
      );
    });

  if (!mounted) return null;

  const pageStyle = {
    transition: 'transform 0.65s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease',
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    opacity: visible ? 1 : 0,
    background: 'radial-gradient(ellipse at 85% 15%, #2a1318 0%, #0e2233 45%, #050a14 100%)',
  };

  return (
    <div className="fixed inset-0 z-[600] overflow-hidden" style={pageStyle}>
      <div className="absolute inset-0 pointer-events-none noise-overlay" style={{ opacity: 0.08 }} />
      <div className="absolute pointer-events-none" style={{ top: '-12%', right: '-6%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(230,43,43,0.16) 0%, transparent 65%)' }} />

      <div className="relative w-full h-full grid grid-cols-1 lg:grid-cols-[38%_1fr]">

        {/* ══════════ KIRI — branding saja, tanpa prompt cards ══════════ */}
        <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-white/5 min-h-0 overflow-y-auto [scrollbar-width:none]">
          {/* logo + tutup */}
          <div className="flex items-center justify-between">
            <button onClick={onClose} aria-label="Tutup" className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-[#e62b2b] hover:border-[#e62b2b] transition-all">
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#f2efe6]/70 group-hover:text-white">TUTUP</span>
              <X className="w-3.5 h-3.5 text-[#f2efe6]/70 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* headline — ukuran pakai vh agar selalu muat layar */}
          <div
            className="py-10"
            style={{ transition: 'opacity 0.6s ease 0.2s, transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.2s', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)' }}
          >
           
            <h1 className="text-[clamp(3.2rem,9vh,6.5rem)] font-black text-[#f2efe6] leading-[0.9] tracking-[-0.03em]">
              Tanya<br /><span className="text-[#e62b2b]">SUSI</span>.
            </h1>
            <p className="mt-6 text-[#f2efe6]/55 text-base leading-relaxed max-w-sm">
              Agen AI kami siap menjawab seputar platform, proses, dan layanan SUSI Community.
            </p>
          </div>

          <p className="font-mono text-[8px] tracking-[0.3em] text-[#f2efe6]/20 font-bold">
            SUSI COMMUNITY · v1.0 Beta
          </p>
        </div>

        {/* ══════════ KANAN — percakapan ══════════ */}
        <div
          className="flex flex-col h-full min-h-0"
          style={{ transition: 'opacity 0.5s ease 0.25s, transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.25s', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)' }}
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 lg:px-10 pt-6 pb-4 lg:pt-10 lg:pb-6 border-b border-white/5">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-[#e62b2b] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white fill-white" strokeWidth={0} />
              </div>
              <div>
                <p className="font-black text-[#f2efe6] text-sm leading-none">SUSI AI</p>
                <p className="font-mono text-[9px] tracking-[0.2em] text-[#f2efe6]/40">AGEN AKTIF</p>
              </div>
            </div>
            <h2 className="hidden lg:block text-xl font-black text-[#f2efe6] tracking-tight">Percakapan</h2>
            
              <button onClick={onClose} aria-label="Tutup" className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-[#f2efe6]/50 hover:text-white border border-white/10 hover:bg-[#e62b2b] hover:border-[#e62b2b] transition-all">
                <X className="w-4 h-4" />
              </button>
          </div>

          {/* body pesan */}
          <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(242,239,230,0.08) transparent' }}>
            {msgs.map((m) => (
              <div key={m.id} className={`flex items-end gap-3 ${m.who === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.who === 'ai' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5" style={{ background: 'rgba(230,43,43,0.15)', border: '1px solid rgba(230,43,43,0.25)' }}>
                    <Sparkles className="w-3.5 h-3.5 text-[#e62b2b] fill-[#e62b2b]" strokeWidth={0} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-5 py-4 text-sm space-y-1.5 ${m.who === 'user' ? 'bg-[#e62b2b] text-white rounded-br-sm' : 'text-[#f2efe6]/90 rounded-bl-sm'}`}
                  style={m.who === 'ai' ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } : {}}
                >
                  {renderText(m.text)}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-end gap-3 justify-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(230,43,43,0.15)', border: '1px solid rgba(230,43,43,0.25)' }}>
                  <Sparkles className="w-3.5 h-3.5 text-[#e62b2b] fill-[#e62b2b]" strokeWidth={0} />
                </div>
                <div className="rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="w-2 h-2 bg-[#f2efe6]/30 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-[#f2efe6]/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#f2efe6]/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <div className="px-6 lg:px-10 py-5 lg:py-7 border-t border-white/5">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-center gap-3 rounded-2xl px-5 py-3.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(230,43,43,0.5)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent text-[#f2efe6] placeholder-[#f2efe6]/30 text-sm outline-none"
                placeholder="Ketik pertanyaanmu di sini..."
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                aria-label="Kirim"
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: input.trim() && !typing ? '#e62b2b' : 'rgba(255,255,255,0.05)',
                  color: input.trim() && !typing ? 'white' : 'rgba(242,239,230,0.2)',
                  cursor: input.trim() && !typing ? 'pointer' : 'not-allowed',
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}