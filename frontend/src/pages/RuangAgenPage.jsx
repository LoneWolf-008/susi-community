import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeft, Headset, Send, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/toastContext';
import { MAX_LENGTH } from '../hooks/useChat';
import { CHAT_THEMES } from '../components/chat/chatTheme';
import { AgentAvatar, AiPausedNote, HandoffChip, HandoffInfo, RatingPrompt, SummaryDisclosure } from '../components/chat/Handoff';
import HandoffTranscript from '../components/chat/HandoffTranscript';
import ChatWidget from '../components/chat/ChatWidget';
import StatusChip from '../components/common/StatusChip';
import ErrorState from '../components/ui/ErrorState';
import { SkeletonLines } from '../components/ui/Skeleton';
import { escalationStatus } from '../lib/statusMap';
import { handoffTitle, hasHandoff, isHandoffActive } from '../lib/handoff';
import { requestOpenChat } from '../lib/chatNavigation';
import { timeAgo } from '../lib/format';

// Ruang AgenSUSI (U6): halaman penuh untuk percakapan pengguna dengan AgenSUSI. Daftar tiket di kiri,
// percakapan di kanan; di layar kecil daftar dulu, lalu detail (dengan tombol kembali). Tiket yang
// dibuka ada di ?tiket=<id> agar bisa ditautkan dari widget & notifikasi.

const t = CHAT_THEMES.light;
const LIST_POLL_MS = 20000;
const THREAD_POLL_MS = 8000;
const SPEAKER = { user: 'Anda', agent: 'AgenSUSI', assistant: 'AI' };
const maxId = (messages) => messages.reduce((max, m) => (m.id > max ? m.id : max), 0);

/** Chip daftar: status handoff (menunggu/ditangani/selesai) atau status akhir tiket (dibatalkan/ditutup). */
function TicketChip({ item }) {
  if (hasHandoff(item.handoff)) return <HandoffChip handoff={item.handoff} />;
  return <StatusChip status={escalationStatus(item.status)} className="!px-2 !py-0.5 !text-[9px]" />;
}

function TicketList({ items, selectedId, onSelect }) {
  return (
    <ul className="divide-y divide-[#12283c]/10">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={selected ? 'true' : undefined}
              className={`w-full text-left px-4 py-3 min-h-[72px] flex gap-3 transition-colors ${selected ? 'bg-[#12283c]/[0.06]' : 'hover:bg-[#12283c]/[0.03]'}`}
            >
              <AgentAvatar agent={item.agent} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black truncate">{item.agent?.name || 'AgenSUSI'}</span>
                  <span className={`shrink-0 font-mono text-[9px] ${t.muted}`}>{timeAgo(item.last_active_at)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <TicketChip item={item} />
                  <span className={`font-mono text-[9px] ${t.muted}`}>TIKET #{item.id}</span>
                </span>
                {item.last_message && (
                  <span className={`mt-1 block text-[12px] leading-snug line-clamp-2 break-words ${item.unread ? 'font-bold' : t.muted}`}>
                    {SPEAKER[item.last_message.role]}: {item.last_message.preview}
                  </span>
                )}
              </span>
              {item.unread > 0 && (
                <span className="self-center shrink-0 min-w-[22px] h-[22px] px-1 rounded-full bg-[#e62b2b] text-white text-[10px] font-black flex items-center justify-center" aria-label={`${item.unread} balasan belum dibaca`}>
                  {item.unread > 9 ? '9+' : item.unread}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Percakapan satu sesi: muat penuh, lalu polling pesan baru selama handoff aktif. */
function useThread(sessionId) {
  const [thread, setThread] = useState({ messages: null, handoff: null, error: null });
  const [version, setVersion] = useState(0);
  const syncedRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/chatbot/session/${sessionId}`, { signal: controller.signal }).then(
      (data) => {
        syncedRef.current = maxId(data.messages);
        setThread({ messages: data.messages, handoff: data.handoff, error: null });
      },
      (error) => {
        if (error?.name !== 'AbortError') setThread((s) => ({ ...s, error }));
      },
    );
    return () => controller.abort();
  }, [sessionId, version]);

  const active = isHandoffActive(thread.handoff);
  useEffect(() => {
    if (!active) return undefined;
    let timer;
    let controller;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        controller = new AbortController();
        try {
          const data = await api.get(`/chatbot/session/${sessionId}`, { signal: controller.signal, query: { after: syncedRef.current } });
          syncedRef.current = Math.max(syncedRef.current, maxId(data.messages));
          setThread((s) => {
            const known = new Set((s.messages ?? []).map((m) => m.id));
            const fresh = data.messages.filter((m) => !known.has(m.id));
            return { ...s, handoff: data.handoff, messages: fresh.length ? [...s.messages, ...fresh].sort((a, b) => a.id - b.id) : s.messages };
          });
        } catch {
          // dicoba lagi pada putaran berikutnya
        }
      }
      timer = setTimeout(tick, THREAD_POLL_MS);
    };
    timer = setTimeout(tick, THREAD_POLL_MS);
    return () => {
      clearTimeout(timer);
      controller?.abort();
    };
  }, [active, sessionId]);

  return { ...thread, setThread, reload: () => setVersion((v) => v + 1) };
}

function Composer({ sessionId, onSent }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      const data = await api.post('/chatbot/message', { session_id: sessionId, message });
      setText('');
      onSent(data, message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className={`px-4 py-3 border-t ${t.divider} bg-[#f2efe6] shrink-0`}>
      <div className={`flex items-end gap-2 rounded-2xl pl-4 pr-1.5 py-1.5 ${t.input}`}>
        <label htmlFor="ruang-agen-input" className="sr-only">Pesan untuk AgenSUSI</label>
        <textarea
          id="ruang-agen-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder="Tulis pesan untuk AgenSUSI…"
          className="flex-1 min-w-0 bg-transparent text-base sm:text-sm outline-none py-2 resize-none max-h-32"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Kirim pesan ke AgenSUSI" className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#e62b2b] text-white shrink-0 disabled:opacity-30">
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <p className={`mt-1.5 text-[10px] leading-snug ${t.muted}`}>Pesan Anda dibaca AgenSUSI (tim SUSI), bukan AI. Jangan bagikan kata sandi.</p>
    </form>
  );
}

function Thread({ item, onBack, onChanged }) {
  const toast = useToast();
  const { messages, handoff, error, setThread, reload } = useThread(item.session_id);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef(null);
  const active = isHandoffActive(handoff);
  const sessionId = item.session_id;

  // Ikuti pesan terbaru.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages?.length, handoff?.status]);

  // Ada balasan yang belum dilihat → tandai terbaca, lalu perbarui lencana di daftar.
  const unread = handoff?.unread ?? 0;
  useEffect(() => {
    if (unread === 0) return;
    api.post('/chatbot/handoff/read', { session_id: sessionId }).then(
      () => {
        setThread((s) => ({ ...s, handoff: { ...s.handoff, unread: 0 } }));
        onChanged();
      },
      () => {},
    );
  }, [unread, sessionId, setThread, onChanged]);

  const backToAi = async () => {
    setCancelling(true);
    try {
      await api.post('/chatbot/handoff/cancel', { session_id: sessionId });
      toast.success('Anda kembali ke asisten AI');
      reload();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };
  const rate = async (rating) => {
    await api.post('/chatbot/handoff/rate', { session_id: sessionId, rating });
    if (rating) toast.success('Terima kasih atas penilaian Anda');
    else requestOpenChat();
    reload();
    onChanged();
  };
  const onSent = (data, content) => {
    setThread((s) => ({
      ...s,
      handoff: data.handoff ?? s.handoff,
      messages: [
        ...s.messages,
        { id: data.user_message_id, role: 'user', content, created_at: new Date().toISOString() },
        // Tiket baru saja selesai di server: pesan ini sudah dijawab AI.
        ...(data.message ? [{ ...data.message, created_at: new Date().toISOString() }] : []),
      ],
    }));
    onChanged();
  };

  // Identitas dari objek handoff saat aktif/selesai; tiket lama memakai data daftar.
  const view = hasHandoff(handoff) ? handoff : null;
  const agent = view?.agent ?? item.agent;
  const sinceId = view?.since_message_id ?? item.since_message_id;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${t.divider} bg-white shrink-0`}>
        <button type="button" onClick={onBack} aria-label="Kembali ke daftar tiket" className={`md:hidden w-11 h-11 -ml-2 rounded-full flex items-center justify-center shrink-0 ${t.action}`}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <AgentAvatar agent={agent} size="w-10 h-10 text-sm" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black leading-tight truncate">{view ? handoffTitle(view) : (agent?.name || 'AgenSUSI')}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <TicketChip item={{ ...item, handoff: view ?? item.handoff }} />
            <span className={`font-mono text-[9px] ${t.muted}`}>TIKET #{item.id}</span>
            {active && <AiPausedNote t={t} />}
          </div>
        </div>
      </div>

      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4" role="log" aria-label="Percakapan dengan AgenSUSI">
        {active ? <HandoffInfo t={t} handoff={handoff} onCancel={backToAi} cancelling={cancelling} /> : <SummaryDisclosure t={t} summary={item.summary} />}
        {error && <ErrorState error={error} onRetry={reload} compact />}
        {!messages && !error && <SkeletonLines count={5} />}
        {messages && <HandoffTranscript messages={messages} sinceId={sinceId} agent={agent} viewer="user" t={t} />}
        {handoff?.status === 'resolved' && <RatingPrompt t={t} handoff={handoff} onRate={rate} />}
        {messages && !active && handoff?.status !== 'resolved' && (
          <div className={`rounded-2xl p-4 text-center space-y-3 ${t.panel}`}>
            <p className={`text-[12px] ${t.muted}`}>
              {item.status === 'cancelled' ? 'Anda kembali ke asisten AI sebelum tiket ini ditangani.' : 'Percakapan dengan AgenSUSI di tiket ini sudah selesai.'}
              {item.rating ? ` Penilaian Anda: ${item.rating}/5.` : ''}
            </p>
            <button type="button" onClick={requestOpenChat} className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#e62b2b] text-white px-4 font-mono text-[10px] font-bold tracking-wider">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> TANYA SUSI LAGI
            </button>
          </div>
        )}
      </div>

      {active && <Composer sessionId={sessionId} onSent={onSent} />}
    </div>
  );
}

export default function RuangAgenPage({ navigateTo }) {
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get('tiket')) || null;
  const list = useApi((signal) => api.get('/chatbot/handoffs', { signal }), []);
  const { refetch } = list;
  const items = list.data?.items ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? null;

  // Daftar diperbarui berkala (lencana & status baru) selama tab aktif.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refetch(); }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [refetch]);

  const select = (id) => setParams(id ? { tiket: String(id) } : {});

  return (
    <div className="h-dvh flex flex-col bg-[#f2efe6] text-[#12283c]">
      <header className="h-16 shrink-0 bg-[#0e2233] text-[#f2efe6] border-b border-white/10 flex items-center gap-3 px-3 sm:px-5">
        <button type="button" onClick={() => navigateTo('dashboard')} aria-label="Kembali ke dasbor" className="w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center shrink-0">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <span className="w-9 h-9 rounded-xl bg-[#c9ecd9] text-[#12283c] flex items-center justify-center shrink-0" aria-hidden="true">
          <Headset className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h1 className="font-black tracking-tight leading-tight truncate">Ruang AgenSUSI</h1>
          <p className="font-mono text-[9px] tracking-wider text-[#f2efe6]/55 truncate">PERCAKAPAN DENGAN TIM PENDAMPING SUSI</p>
        </div>
        {list.data?.unread_total > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-[#e62b2b] text-white px-2.5 py-1 font-mono text-[9px] font-black">{list.data.unread_total} BELUM DIBACA</span>
        )}
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
        <aside className={`${selected ? 'hidden md:flex' : 'flex'} flex-col min-h-0 border-r ${t.divider} bg-white`} aria-label="Daftar tiket AgenSUSI">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {list.error && <div className="p-4"><ErrorState error={list.error} onRetry={refetch} compact /></div>}
            {!list.data && !list.error && <div className="p-4"><SkeletonLines count={6} /></div>}
            {list.data && items.length === 0 && (
              <div className="p-6 text-center space-y-3">
                <p className="font-black">Belum ada percakapan dengan AgenSUSI</p>
                <p className={`text-[13px] leading-relaxed ${t.muted}`}>
                  Bila Tanya SUSI tidak bisa membantu, pilih <b>Ya, hubungkan</b> untuk berbicara dengan AgenSUSI. Percakapannya tersimpan di sini.
                </p>
                <button type="button" onClick={requestOpenChat} className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#e62b2b] text-white px-4 font-mono text-[10px] font-bold tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> TANYA SUSI
                </button>
              </div>
            )}
            <TicketList items={items} selectedId={selectedId} onSelect={select} />
          </div>
        </aside>

        <section className={`${selected ? 'flex' : 'hidden md:flex'} flex-col min-h-0`} aria-label="Percakapan">
          {selected ? (
            <Thread key={selected.id} item={selected} onBack={() => select(null)} onChanged={refetch} />
          ) : (
            <div className="m-auto max-w-sm p-6 text-center">
              <p className="font-black">{selectedId && list.data ? 'Tiket tidak ditemukan' : 'Pilih percakapan'}</p>
              <p className={`mt-1 text-[13px] ${t.muted}`}>Balasan AgenSUSI muncul di sini dan juga di widget Tanya SUSI.</p>
            </div>
          )}
        </section>
      </main>

      <ChatWidget variant="floating" />
    </div>
  );
}
