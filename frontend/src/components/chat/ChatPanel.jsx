import { useEffect, useRef, useState } from 'react';
import { Send, Square, RotateCcw, X, Sparkles, ThumbsUp, ThumbsDown, Headset, Trash2 } from 'lucide-react';
import MarkdownLite from './MarkdownLite';
import ChatCards from './ChatCards';
import { MAX_LENGTH } from '../../hooks/useChat';
import { useToast } from '../../context/toastContext';
import { CONTACT } from '../../data/contact';
import { escalationStatus } from '../../lib/statusMap';

// Panel percakapan Tanya SUSI yang dipakai kedua varian widget (overlay publik & tombol melayang).
// Transparansi: jawaban asisten selalu berlabel AI; balasan AgenSUSI (manusia) diberi warna berbeda.

const GREETING = 'Halo! Saya **Tanya SUSI**, asisten AI SUSI Community. Tanyakan cara kerja SUSI, cara mengajukan kebutuhan atau melamar proyek, atau minta dihubungkan dengan AgenSUSI.';

const THEMES = {
  dark: {
    text: 'text-[#f2efe6]',
    muted: 'text-[#f2efe6]/55',
    divider: 'border-white/10',
    ai: 'bg-white/[0.06] border border-white/10 text-[#f2efe6]/90',
    chip: 'border border-white/15 text-[#f2efe6]/85 hover:bg-white/10',
    action: 'border border-white/15 text-[#f2efe6]/70 hover:bg-white/10',
    input: 'bg-white/5 border border-white/10 text-[#f2efe6] placeholder-[#f2efe6]/35 focus-within:border-[#e62b2b]/60',
    field: 'bg-white/5 border border-white/15 text-[#f2efe6] placeholder-[#f2efe6]/40',
    link: 'underline underline-offset-2 break-all text-[#c9ecd9]',
    alert: 'bg-[#e62b2b]/15 border border-[#e62b2b]/40 text-[#f2efe6]',
  },
  light: {
    text: 'text-[#12283c]',
    muted: 'text-[#12283c]/55',
    divider: 'border-[#12283c]/10',
    ai: 'bg-white border border-[#12283c]/10 text-[#12283c] shadow-sm',
    chip: 'border border-[#12283c]/15 bg-white text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6]',
    action: 'border border-[#12283c]/15 text-[#12283c]/70 hover:bg-[#12283c]/5',
    input: 'bg-[#f2efe6] border border-[#12283c]/10 text-[#12283c] placeholder-[#12283c]/40 focus-within:border-[#e62b2b]',
    field: 'bg-white border border-[#12283c]/15 text-[#12283c] placeholder-[#12283c]/40',
    link: 'underline underline-offset-2 break-all text-[#e62b2b]',
    alert: 'bg-[#e62b2b]/10 border border-[#e62b2b]/30 text-[#12283c]',
  },
};

const CONTACT_HINT = 'Email atau nomor WhatsApp';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" aria-label="Tanya SUSI sedang mengetik">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="w-2 h-2 rounded-full animate-bounce bg-current opacity-40" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

/** Tombol "Hubungi AgenSUSI"; pengunjung anonim mengisi kontak balik dulu. */
function EscalationOffer({ t, chat, anonymous, onDone }) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await chat.escalate(anonymous ? contact.trim() : undefined);
      toast.success('Percakapan diteruskan ke AgenSUSI');
      // Form ini hilang setelah tiket dibuat: pindahkan fokus ke kolom tanya agar tidak jatuh ke <body>.
      onDone?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!asking) {
    return (
      <button type="button" onClick={() => (anonymous ? setAsking(true) : submit())} disabled={busy} className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#e62b2b] text-white px-4 py-2 font-mono text-[10px] font-bold tracking-widest hover:bg-[#c51f1f] transition-colors disabled:opacity-50">
        <Headset className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'MENERUSKAN…' : 'HUBUNGI AGENSUSI'}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className={`mt-2 rounded-xl p-3 space-y-2 ${t.ai}`}>
      <label htmlFor="chat-contact" className={`block font-mono text-[10px] font-bold tracking-widest ${t.muted}`}>KONTAK UNTUK DIHUBUNGI KEMBALI</label>
      <input
        id="chat-contact"
        value={contact}
        onChange={(e) => setContact(e.target.value.slice(0, 150))}
        placeholder={CONTACT_HINT}
        autoComplete="email"
        className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${t.field}`}
      />
      <p className={`text-[11px] leading-snug ${t.muted}`}>Kontak hanya dilihat AgenSUSI untuk membalas Anda, dan tidak dikirim ke AI.</p>
      {error && <p role="alert" className="text-[11px] font-bold text-[#e62b2b]">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setAsking(false)} disabled={busy} className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-bold ${t.action}`}>BATAL</button>
        <button type="submit" disabled={busy || contact.trim().length < 5} className="flex-1 rounded-full bg-[#e62b2b] text-white px-3 py-1.5 font-mono text-[10px] font-bold tracking-widest disabled:opacity-40">{busy ? 'MENGIRIM…' : 'KIRIM KE AGENSUSI'}</button>
      </div>
    </form>
  );
}

function Feedback({ t, chat, message }) {
  const toast = useToast();
  const rate = async (value) => {
    try {
      await chat.rate(message, value);
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Nilai jawaban ini">
      <button type="button" onClick={() => rate(1)} aria-pressed={message.feedback === 1} aria-label="Jawaban membantu" className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${message.feedback === 1 ? 'bg-[#c9ecd9] text-[#12283c]' : t.action}`}>
        <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => rate(-1)} aria-pressed={message.feedback === -1} aria-label="Jawaban tidak membantu" className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${message.feedback === -1 ? 'bg-[#e62b2b] text-white' : t.action}`}>
        <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function MessageItem({ t, m, chat, isLatest, anonymous, onEscalated, onNavigate }) {
  if (m.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#e62b2b] text-white px-4 py-3 text-sm whitespace-pre-wrap break-words">
          <span className="sr-only">Anda: </span>{m.content}
        </div>
        {m.status === 'failed' && <span className="font-mono text-[9px] font-bold text-[#e62b2b] mt-1">GAGAL TERKIRIM</span>}
      </div>
    );
  }

  if (m.role === 'agent') {
    return (
      <div className="flex flex-col items-start">
        <span className="font-mono text-[9px] font-bold tracking-widest mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#c9ecd9] text-[#12283c] px-2 py-0.5">
          <Headset className="w-3 h-3" aria-hidden="true" /> AGENSUSI · TIM SUSI
        </span>
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#c9ecd9] text-[#12283c] border-l-4 border-[#12283c] px-4 py-3 text-sm">
          <MarkdownLite text={m.content} linkClass="underline underline-offset-2 break-all" />
        </div>
      </div>
    );
  }

  const streaming = m.status === 'streaming';
  const done = m.status === 'done';
  const showSources = done && m.ratable && m.sources?.length > 0 && ['kb', 'llm', 'cache'].includes(m.source);
  return (
    <div className="flex flex-col items-start">
      <span className={`font-mono text-[9px] font-bold tracking-widest mb-1 inline-flex items-center gap-1.5 ${t.muted}`}>
        <Sparkles className="w-3 h-3 text-[#e62b2b]" aria-hidden="true" /> TANYA SUSI · AI
      </span>
      <div className={`max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm ${m.status === 'error' ? t.alert : t.ai}`}>
        {streaming && !m.content ? <TypingDots /> : (
          <>
            <MarkdownLite text={m.content} linkClass={t.link} />
            {streaming && <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-current animate-pulse" aria-hidden="true" />}
          </>
        )}
        {m.status === 'stopped' && <p className={`mt-1 font-mono text-[9px] font-bold ${t.muted}`}>{m.content ? '— DIHENTIKAN' : 'JAWABAN DIHENTIKAN'}</p>}
      </div>
      {done && m.cards?.length > 0 && <ChatCards t={t} cards={m.cards} onNavigate={onNavigate} />}
      {(showSources || (done && m.ratable)) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 max-w-[88%]">
          {m.ratable && <Feedback t={t} chat={chat} message={m} />}
          {showSources && <span className={`text-[10px] leading-snug ${t.muted}`}>Sumber: {m.sources.map((s) => s.title).join(' · ')}</span>}
        </div>
      )}
      {isLatest && done && m.escalationSuggested && !chat.escalation && <EscalationOffer t={t} chat={chat} anonymous={anonymous} onDone={onEscalated} />}
    </div>
  );
}

function EscalationBanner({ t, escalation, available }) {
  const status = escalationStatus(escalation.status);
  const open = escalation.status === 'pending' || escalation.status === 'assigned';
  const whatsapp = !available && open ? CONTACT.whatsappUrl(`Halo SUSI, saya butuh bantuan (tiket #${escalation.id}).`) : null;
  const text = {
    pending: 'Menunggu AgenSUSI membalas di percakapan ini.',
    assigned: 'AgenSUSI sedang menangani percakapan ini.',
    resolved: 'Tiket bantuan sudah diselesaikan AgenSUSI.',
    closed: 'Tiket bantuan sudah ditutup.',
  }[escalation.status];
  return (
    <div className={`mx-4 mb-2 rounded-xl px-3 py-2 text-[11px] flex flex-wrap items-center gap-2 ${t.ai}`} role="status">
      <Headset className="w-3.5 h-3.5 text-[#e62b2b]" aria-hidden="true" />
      <span className="font-mono font-bold">TIKET #{escalation.id}</span>
      <span className="font-mono text-[9px] font-bold rounded-full bg-[#12283c] text-[#f2efe6] px-2 py-0.5">{status.label}</span>
      <span className={t.muted}>{text}</span>
      {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={t.link}>WhatsApp resmi SUSI</a>}
    </div>
  );
}

/** Konfirmasi hapus percakapan dari server (T15): pesan & tiket bantuannya ikut terhapus. */
function DeleteConversation({ t, chat, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ticketOpen = ['pending', 'assigned'].includes(chat.escalation?.status);

  const confirm = async () => {
    setBusy(true);
    try {
      await chat.remove();
      toast.success('Percakapan dihapus dari server');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className={`mx-4 mt-3 rounded-xl px-3 py-2.5 text-[11px] shrink-0 ${t.alert}`} role="group" aria-label="Konfirmasi hapus percakapan">
      <p>
        Hapus percakapan ini dari server SUSI?
        {ticketOpen ? ' Permintaan bantuan ke AgenSUSI yang masih terbuka ikut dibatalkan.' : ''}
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onDone} disabled={busy} className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-widest ${t.action}`}>BATAL</button>
        <button type="button" onClick={confirm} disabled={busy} className="rounded-full bg-[#e62b2b] text-white px-3 py-1 font-mono text-[10px] font-bold tracking-widest disabled:opacity-60">
          {busy ? 'MENGHAPUS…' : 'YA, HAPUS'}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{ chat: ReturnType<import('../../hooks/useChat').useChat>, suggestions: string[], dark?: boolean,
 *   anonymous: boolean, onClose: () => void, titleId: string, inputRef: object, compactHeader?: boolean }} props
 */
export default function ChatPanel({ chat, suggestions, dark = false, anonymous, onClose, titleId, inputRef, compactHeader = false }) {
  const t = dark ? THEMES.dark : THEMES.light;
  const [input, setInput] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const logRef = useRef(null);

  // Ikuti pesan terbaru (termasuk potongan stream yang masuk).
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, chat.error, chat.escalation]);
  const hasUserMessages = chat.messages.some((m) => m.role === 'user');
  const lastAssistant = [...chat.messages].reverse().find((m) => m.role !== 'user');
  // Pembaca layar: umumkan jawaban/balasan yang sudah lengkap saja (bukan setiap potongan stream).
  const announcement = lastAssistant && lastAssistant.status === 'done'
    ? `${lastAssistant.role === 'agent' ? 'AgenSUSI' : 'Tanya SUSI'}: ${lastAssistant.content}` : '';

  const submit = (e) => {
    e.preventDefault();
    if (!input.trim() || chat.busy) return;
    chat.send(input);
    setInput('');
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${t.text}`}>
      <div className={`flex items-center gap-3 px-4 sm:px-5 py-3 border-b ${t.divider} shrink-0`}>
        <div className="w-9 h-9 rounded-xl bg-[#e62b2b] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white fill-white" strokeWidth={0} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id={titleId} className={`font-black tracking-tight leading-tight ${compactHeader ? 'text-sm' : 'text-base'}`}>Tanya SUSI</h2>
          <p className={`font-mono text-[9px] tracking-wider ${t.muted}`}>ASISTEN AI · JAWABAN BISA KELIRU</p>
        </div>
        {chat.messages.length > 0 && (
          <button type="button" onClick={chat.reset} disabled={chat.busy} aria-label="Mulai percakapan baru" title="Percakapan baru" className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${t.action}`}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        {chat.hasSession && chat.messages.length > 0 && (
          <button type="button" onClick={() => setConfirmingDelete(true)} disabled={chat.busy} aria-label="Hapus percakapan dari server" aria-expanded={confirmingDelete} title="Hapus percakapan" className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${t.action}`}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Tutup Tanya SUSI" className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:!bg-[#e62b2b] hover:!text-white ${t.action}`}>
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      {confirmingDelete && chat.hasSession && (
        <DeleteConversation t={t} chat={chat} onDone={() => { setConfirmingDelete(false); inputRef.current?.focus(); }} />
      )}

      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4" role="log" aria-label="Percakapan dengan Tanya SUSI" aria-busy={chat.busy}>
        {!chat.restoring && (
          <div className="flex flex-col items-start">
            <span className={`font-mono text-[9px] font-bold tracking-widest mb-1 inline-flex items-center gap-1.5 ${t.muted}`}>
              <Sparkles className="w-3 h-3 text-[#e62b2b]" aria-hidden="true" /> TANYA SUSI · AI
            </span>
            <div className={`max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm ${t.ai}`}><MarkdownLite text={GREETING} linkClass={t.link} /></div>
          </div>
        )}
        {chat.restoring && <p className={`font-mono text-[10px] ${t.muted}`}>Memuat percakapan…</p>}
        {chat.messages.map((m) => (
          <MessageItem key={m.key} t={t} m={m} chat={chat} isLatest={m === lastAssistant} anonymous={anonymous} onEscalated={() => inputRef.current?.focus()} onNavigate={onClose} />
        ))}
        {chat.error && (
          <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${t.alert}`}>
            <p>{chat.error.message}</p>
            <button type="button" onClick={chat.retry} className="mt-2 rounded-full bg-[#e62b2b] text-white px-4 py-1.5 font-mono text-[10px] font-bold tracking-widest">COBA LAGI</button>
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite">{announcement}</div>

      {chat.escalation && <EscalationBanner t={t} escalation={chat.escalation} available={chat.available} />}

      {!hasUserMessages && !chat.restoring && suggestions.length > 0 && (
        <div className="px-4 sm:px-5 pb-2 flex flex-wrap gap-2 shrink-0" aria-label="Saran pertanyaan">
          {suggestions.map((q) => (
            <button type="button" key={q} onClick={() => chat.send(q)} disabled={chat.busy} className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold text-left transition-colors disabled:opacity-40 ${t.chip}`}>{q}</button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className={`px-4 sm:px-5 py-3 border-t ${t.divider} shrink-0`}>
        <div className={`flex items-center gap-2 rounded-2xl pl-4 pr-1.5 py-1.5 transition-colors ${t.input}`}>
          <label htmlFor={`${titleId}-input`} className="sr-only">Pertanyaan untuk Tanya SUSI</label>
          <input
            id={`${titleId}-input`}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
            disabled={chat.restoring}
            maxLength={MAX_LENGTH}
            autoComplete="off"
            placeholder="Ketik pertanyaan Anda…"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none py-2"
          />
          {chat.busy ? (
            <button type="button" onClick={chat.stop} aria-label="Hentikan jawaban" className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#12283c] text-[#f2efe6] shrink-0">
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || chat.restoring} aria-label="Kirim pertanyaan" className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e62b2b] text-white shrink-0 transition-opacity disabled:opacity-30">
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className={`mt-1.5 text-[10px] leading-snug ${t.muted}`}>
          {input.length > MAX_LENGTH - 100 ? `${input.length}/${MAX_LENGTH} karakter · ` : ''}
          {chat.stored === false ? 'Riwayat chat tidak disimpan (Pengaturan → Privasi). ' : ''}
          Jangan bagikan data pribadi. Untuk hal penting, minta bantuan AgenSUSI.
        </p>
      </form>
    </div>
  );
}
