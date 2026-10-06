import { useEffect, useRef, useState } from 'react';
import { Send, Square, RotateCcw, X, Sparkles, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import MarkdownLite from './MarkdownLite';
import ChatCards from './ChatCards';
import { CHAT_THEMES } from './chatTheme';
import { AgentAvatar, AgentMessage, AiPausedNote, HandoffChip, HandoffInfo, HandoffOffer, RatingPrompt } from './Handoff';
import { handoffTitle, hasHandoff } from '../../lib/handoff';
import { MAX_LENGTH } from '../../hooks/useChat';
import { useToast } from '../../context/toastContext';

// Panel percakapan Tanya SUSI yang dipakai kedua varian widget (overlay publik & tombol melayang).
// Transparansi: jawaban asisten selalu berlabel AI; balasan AgenSUSI (manusia) diberi warna berbeda.
// U6: saat percakapan dialihkan, panel berubah menjadi "Ruang AgenSUSI" (identitas agen, status,
// AI dijeda, ringkasan untuk agen, kembali ke AI, penilaian setelah selesai).

const GREETING = 'Halo! Saya **Tanya SUSI**, asisten AI SUSI Community. Tanyakan apa saja seputar SUSI: cara memakai aplikasi, mengajukan kebutuhan atau melamar proyek, kendala akun, sampai masalah komunitas atau usaha Anda. Butuh orang? Minta dihubungkan dengan AgenSUSI.';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" aria-label="Tanya SUSI sedang mengetik">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="w-2 h-2 rounded-full animate-bounce bg-current opacity-40" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
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

function MessageItem({ t, m, chat, isLatest, anonymous, onFocusInput, onNavigate }) {
  const toast = useToast();
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

  if (m.role === 'agent') return <AgentMessage content={m.content} agent={chat.handoff?.agent} />;

  const streaming = m.status === 'streaming';
  const done = m.status === 'done';
  const showSources = done && m.ratable && m.sources?.length > 0 && ['kb', 'llm', 'cache'].includes(m.source);
  const connect = async (contact) => {
    await chat.escalate(contact);
    toast.success('Percakapan diteruskan ke AgenSUSI');
    // Kartu ini hilang setelah tiket dibuat: pindahkan fokus ke kolom tulis agar tidak jatuh ke <body>.
    onFocusInput();
  };
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
      {isLatest && done && m.escalationSuggested && !hasHandoff(chat.handoff) && (
        <HandoffOffer t={t} anonymous={anonymous} onConnect={connect} onDecline={() => { chat.declineHandoff(); onFocusInput(); }} />
      )}
    </div>
  );
}

/** Konfirmasi hapus percakapan dari server (T15): pesan & tiket bantuannya ikut terhapus. */
function DeleteConversation({ t, chat, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

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
        {chat.handoffActive ? ' Permintaan bantuan ke AgenSUSI yang masih terbuka ikut dibatalkan.' : ''}
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
 *   anonymous: boolean, onClose: () => void, titleId: string, inputRef: object, compactHeader?: boolean,
 *   onOpenFull?: () => void }} props
 *   onOpenFull = buka percakapan AgenSUSI di halaman penuh (hanya untuk peran yang punya Ruang AgenSUSI).
 */
export default function ChatPanel({ chat, suggestions, dark = false, anonymous, onClose, titleId, inputRef, compactHeader = false, onOpenFull }) {
  const t = dark ? CHAT_THEMES.dark : CHAT_THEMES.light;
  const toast = useToast();
  const [input, setInput] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef(null);
  const { handoff, handoffActive } = chat;
  const inHandoff = hasHandoff(handoff);

  // Ikuti pesan terbaru (termasuk potongan stream yang masuk).
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, chat.error, handoff?.status]);
  const hasUserMessages = chat.messages.some((m) => m.role === 'user');
  const lastAssistant = [...chat.messages].reverse().find((m) => m.role !== 'user');
  // Pembaca layar: umumkan jawaban/balasan yang sudah lengkap saja (bukan setiap potongan stream).
  const announcement = lastAssistant && lastAssistant.status === 'done'
    ? `${lastAssistant.role === 'agent' ? 'AgenSUSI' : 'Tanya SUSI'}: ${lastAssistant.content}` : '';
  const focusInput = () => inputRef.current?.focus();

  const submit = (e) => {
    e.preventDefault();
    if (!input.trim() || chat.busy) return;
    chat.send(input);
    setInput('');
  };
  const backToAi = async () => {
    setCancelling(true);
    try {
      await chat.cancelHandoff();
      toast.success('Anda kembali ke asisten AI');
      focusInput();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };
  const rateHandoff = async (rating) => {
    await chat.rateHandoff(rating);
    if (rating) toast.success('Terima kasih atas penilaian Anda');
    focusInput();
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${t.text}`}>
      <div className={`flex items-center gap-3 px-4 sm:px-5 py-3 border-b ${t.divider} shrink-0`}>
        {inHandoff ? <AgentAvatar agent={handoff.agent} /> : (
          <div className="w-9 h-9 rounded-xl bg-[#e62b2b] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white fill-white" strokeWidth={0} aria-hidden="true" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 id={titleId} className={`font-black tracking-tight leading-tight truncate ${compactHeader ? 'text-sm' : 'text-base'}`}>
            {inHandoff ? 'Ruang AgenSUSI' : 'Tanya SUSI'}
          </h2>
          {inHandoff ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <HandoffChip handoff={handoff} />
              {handoffActive && <AiPausedNote t={t} />}
            </div>
          ) : <p className={`font-mono text-[9px] tracking-wider ${t.muted}`}>ASISTEN AI · JAWABAN BISA KELIRU</p>}
        </div>
        {chat.messages.length > 0 && !handoffActive && (
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
        <DeleteConversation t={t} chat={chat} onDone={() => { setConfirmingDelete(false); focusInput(); }} />
      )}
      {handoffActive && (
        <div className={`px-4 sm:px-5 py-3 border-b ${t.divider} shrink-0 max-h-[40%] overflow-y-auto`}>
          <p className="text-sm font-black leading-tight mb-1">{handoffTitle(handoff)}</p>
          <HandoffInfo t={t} handoff={handoff} onCancel={backToAi} cancelling={cancelling} onOpenFull={onOpenFull} />
        </div>
      )}

      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4" role="log" aria-label={inHandoff ? 'Percakapan dengan AgenSUSI' : 'Percakapan dengan Tanya SUSI'} aria-busy={chat.busy}>
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
          <MessageItem key={m.key} t={t} m={m} chat={chat} isLatest={m === lastAssistant} anonymous={anonymous} onFocusInput={focusInput} onNavigate={onClose} />
        ))}
        {handoff?.status === 'resolved' && (
          <>
            <RatingPrompt t={t} handoff={handoff} onRate={rateHandoff} />
            {onOpenFull && <HandoffInfo t={t} handoff={handoff} onOpenFull={onOpenFull} />}
          </>
        )}
        {chat.error && (
          <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${t.alert}`}>
            <p>{chat.error.message}</p>
            <button type="button" onClick={chat.retry} className="mt-2 rounded-full bg-[#e62b2b] text-white px-4 py-1.5 font-mono text-[10px] font-bold tracking-widest">COBA LAGI</button>
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite">{announcement}</div>

      {!hasUserMessages && !chat.restoring && !inHandoff && suggestions.length > 0 && (
        <div className="px-4 sm:px-5 pb-2 flex flex-wrap gap-2 shrink-0" aria-label="Saran pertanyaan">
          {suggestions.map((q) => (
            <button type="button" key={q} onClick={() => chat.send(q)} disabled={chat.busy} className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold text-left transition-colors disabled:opacity-40 ${t.chip}`}>{q}</button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className={`px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t ${t.divider} shrink-0`}>
        <div className={`flex items-center gap-2 rounded-2xl pl-4 pr-1.5 py-1.5 transition-colors ${t.input}`}>
          <label htmlFor={`${titleId}-input`} className="sr-only">{handoffActive ? 'Pesan untuk AgenSUSI' : 'Pertanyaan untuk Tanya SUSI'}</label>
          <input
            id={`${titleId}-input`}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
            disabled={chat.restoring}
            maxLength={MAX_LENGTH}
            autoComplete="off"
            placeholder={handoffActive ? 'Tulis pesan untuk AgenSUSI…' : 'Ketik pertanyaan Anda…'}
            className="flex-1 min-w-0 bg-transparent text-base sm:text-sm outline-none py-2"
          />
          {chat.busy && !handoffActive ? (
            <button type="button" onClick={chat.stop} aria-label="Hentikan jawaban" className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#12283c] text-[#f2efe6] shrink-0">
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || chat.restoring || chat.busy} aria-label={handoffActive ? 'Kirim pesan ke AgenSUSI' : 'Kirim pertanyaan'} className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e62b2b] text-white shrink-0 transition-opacity disabled:opacity-30">
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className={`mt-1.5 text-[10px] leading-snug ${t.muted}`}>
          {input.length > MAX_LENGTH - 100 ? `${input.length}/${MAX_LENGTH} karakter · ` : ''}
          {handoffActive
            ? 'Pesan ke AgenSUSI tetap disimpan agar agen dapat membacanya. Pesan dibaca tim SUSI, bukan AI; jangan bagikan kata sandi.'
            : `${chat.stored === false ? 'Riwayat chat tidak disimpan (Pengaturan → Privasi). ' : ''}Jangan bagikan data pribadi. Untuk hal penting, minta bantuan AgenSUSI.`}
        </p>
      </form>
    </div>
  );
}
