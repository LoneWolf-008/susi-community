import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/authContext';

// Percakapan Tanya SUSI (T14): streaming jawaban, hentikan, coba lagi, 👍/👎, eskalasi ke AgenSUSI,
// dan polling balasan agen. ID sesi disimpan di sessionStorage per pengguna (anonim: "anon"); sesi
// milik pengguna yang masuk dijaga server (pengguna lain mendapat 404). Saat pengunjung anonim
// masuk, percakapannya diadopsi dan diklaim server pada pesan berikutnya.

export const MAX_LENGTH = 500;
const POLL_MS = 8000;
const OPEN_ESCALATION = ['pending', 'assigned'];
const STORAGE_PREFIX = 'susi_chat_session:';
export const OFFLINE_MESSAGE = 'Tanya SUSI sedang tidak dapat dihubungi. Periksa koneksi Anda lalu coba lagi, atau hubungi tim SUSI lewat WhatsApp di halaman Tentang Kami.';

const storageKey = (user) => `${STORAGE_PREFIX}${user ? `u${user.id}` : 'anon'}`;
// sessionStorage bisa tidak tersedia (mode privat, kebijakan peramban): chat tetap jalan tanpa riwayat.
const readStored = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key, value) => {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // abaikan
  }
};

let seq = 0;
const nextKey = () => `m${Date.now()}-${(seq += 1)}`;
const fromServer = (m) => ({ key: `s${m.id}`, id: m.id, role: m.role, content: m.content, status: 'done' });
const patchMessage = (setConv, key, patch) => setConv((c) => ({
  ...c,
  messages: c.messages.map((m) => (m.key === key ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
}));
const EMPTY = { key: null, sessionId: null, messages: [], escalation: null, available: true, restore: false, adopted: false };
const maxId = (messages) => messages.reduce((max, m) => (m.id > max ? m.id : max), 0);
// Urut kronologis menurut id server; pesan yang belum punya id (jawaban yang sedang di-stream) di akhir.
const inOrder = (messages) => [...messages].sort((a, b) => (a.id ?? Infinity) - (b.id ?? Infinity));

/**
 * @param {{ enabled?: boolean, active?: boolean }} options
 *   enabled = widget pernah dibuka (riwayat dimuat saat perlu saja); active = widget sedang terbuka
 *   (polling balasan AgenSUSI hanya saat terbuka).
 */
export function useChat({ enabled = true, active = enabled } = {}) {
  const { user, status: authStatus } = useAuth();
  const key = storageKey(user);
  const [conv, setConv] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);
  const busyRef = useRef(false);
  // Titik acuan polling: id pesan terbesar yang sudah DISINKRONKAN dari server (pemulihan/polling),
  // bukan dari pesan yang dikirim sendiri. Balasan agen yang masuk sebelum pertanyaan baru pengguna
  // punya id lebih kecil dari jawaban terbaru, jadi acuan "id terbesar yang diketahui" akan
  // melewatkannya (ditemukan lewat uji browser T14).
  const syncedIdRef = useRef(0);
  const controllerRef = useRef(null);

  // Pengguna masuk/keluar → percakapan milik kunci baru (pola "state dari props" saat render).
  if (enabled && authStatus !== 'loading' && conv.key !== key) {
    const own = readStored(key);
    const adopted = !own && user ? readStored(storageKey(null)) : null;
    setConv({ ...EMPTY, key, sessionId: own || adopted, restore: Boolean(own || adopted), adopted: Boolean(adopted) });
    setError(null);
  }

  useEffect(() => {
    sessionRef.current = conv.sessionId;
  }, [conv.sessionId]);
  useEffect(() => {
    syncedIdRef.current = 0;
  }, [conv.key]);
  // Stream yang masih berjalan dibatalkan saat percakapan berganti atau komponen dilepas.
  useEffect(() => () => controllerRef.current?.abort(), [conv.key]);

  // Muat ulang riwayat sesi tersimpan (setelah reload atau saat mengadopsi percakapan anonim).
  const { key: convKey, sessionId: storedSession, restore: needsRestore, adopted } = conv;
  useEffect(() => {
    if (!needsRestore || !storedSession) return undefined;
    const controller = new AbortController();
    api.get(`/chatbot/session/${storedSession}`, { signal: controller.signal }).then(
      (data) => {
        writeStored(convKey, storedSession);
        // Percakapan anonim yang diadopsi kini milik kunci pengguna (diklaim server di pesan berikutnya).
        if (adopted) writeStored(storageKey(null), null);
        syncedIdRef.current = maxId(data.messages);
        setConv((c) => (c.key === convKey
          ? { ...c, restore: false, messages: data.messages.map(fromServer), escalation: data.escalation }
          : c));
      },
      (err) => {
        if (err?.name === 'AbortError') return;
        // Sesi sudah tidak bisa diakses (milik orang lain / diklaim / dihapus): mulai baru.
        const gone = err.status === 404 || err.status === 401;
        if (gone) writeStored(convKey, null);
        setConv((c) => (c.key === convKey ? { ...c, restore: false, sessionId: gone ? null : c.sessionId } : c));
      },
    );
    return () => controller.abort();
  }, [convKey, storedSession, needsRestore, adopted]);

  // Selama tiket eskalasi terbuka & widget terbuka: ambil pesan baru (balasan AgenSUSI) segera, lalu
  // tiap 8 detik selama tab peramban aktif.
  const polling = enabled && active && Boolean(conv.sessionId) && OPEN_ESCALATION.includes(conv.escalation?.status);
  useEffect(() => {
    if (!polling) return undefined;
    let timer;
    let controller;
    const tick = async () => {
      if (document.visibilityState === 'visible' && !busyRef.current && sessionRef.current) {
        controller = new AbortController();
        try {
          const data = await api.get(`/chatbot/session/${sessionRef.current}`, {
            signal: controller.signal, query: { after: syncedIdRef.current },
          });
          syncedIdRef.current = Math.max(syncedIdRef.current, maxId(data.messages));
          setConv((c) => {
            const known = new Set(c.messages.map((m) => m.id).filter(Boolean));
            const fresh = data.messages.filter((m) => !known.has(m.id)).map(fromServer);
            return {
              ...c,
              escalation: data.escalation ?? c.escalation,
              messages: fresh.length ? inOrder([...c.messages, ...fresh]) : c.messages,
            };
          });
        } catch {
          // dicoba lagi pada putaran berikutnya
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, 0);
    return () => {
      clearTimeout(timer);
      controller?.abort();
    };
  }, [polling]);

  const send = async (raw) => {
    const message = String(raw ?? '').trim().slice(0, MAX_LENGTH);
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const userKey = nextKey();
    const botKey = nextKey();
    setConv((c) => ({
      ...c,
      messages: [
        ...c.messages.map((m) => (m.escalationSuggested ? { ...m, escalationSuggested: false } : m)),
        { key: userKey, role: 'user', content: message, status: 'done' },
        { key: botKey, role: 'assistant', content: '', status: 'streaming' },
      ],
    }));
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await api.stream('/chatbot/stream', { session_id: sessionRef.current || undefined, message }, {
        signal: controller.signal,
        onEvent: (event, data) => {
          if (event === 'start') {
            sessionRef.current = data.session_id;
            writeStored(key, data.session_id);
            setConv((c) => ({
              ...c,
              sessionId: data.session_id,
              messages: c.messages.map((m) => (m.key === userKey ? { ...m, id: data.user_message_id } : m)),
            }));
          } else if (event === 'delta') {
            patchMessage(setConv, botKey, (m) => ({ content: m.content + data.content }));
          } else if (event === 'done') {
            // Isi akhir dari server selalu menang (mis. `replace` saat LLM gagal di tengah jalan).
            setConv((c) => ({
              ...c,
              messages: c.messages
                .filter((m) => m.key === botKey || m.id !== data.message.id)
                .map((m) => (m.key === botKey ? {
                  ...m,
                  id: data.message.id,
                  content: data.message.content,
                  status: 'done',
                  source: data.source,
                  sources: data.sources,
                  intent: data.intent,
                  escalationSuggested: data.escalation_suggested,
                  ratable: true,
                } : m)),
            }));
          } else if (event === 'error') {
            patchMessage(setConv, botKey, { content: data.message, status: 'error' });
          }
        },
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        patchMessage(setConv, botKey, { status: 'stopped' });
      } else {
        setConv((c) => ({
          ...c,
          messages: c.messages.filter((m) => m.key !== botKey).map((m) => (m.key === userKey ? { ...m, status: 'failed' } : m)),
        }));
        if (err.status === 404) {
          sessionRef.current = null;
          writeStored(key, null);
          setConv((c) => ({ ...c, sessionId: null }));
        }
        setError({ message: err.status === 0 ? OFFLINE_MESSAGE : err.message, retryText: message, userKey });
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  };

  const stop = () => controllerRef.current?.abort();

  const retry = () => {
    if (!error) return;
    setConv((c) => ({ ...c, messages: c.messages.filter((m) => m.key !== error.userKey) }));
    setError(null);
    send(error.retryText);
  };

  /** 👍 = 1, 👎 = -1 untuk jawaban asisten di percakapan ini. Melempar galat bila gagal disimpan. */
  const rate = async (message, value) => {
    if (!sessionRef.current || !message.id) return;
    const previous = message.feedback;
    patchMessage(setConv, message.key, { feedback: value });
    try {
      await api.post('/chatbot/feedback', { session_id: sessionRef.current, message_id: message.id, value });
    } catch (err) {
      patchMessage(setConv, message.key, { feedback: previous });
      throw err;
    }
  };

  /** Teruskan percakapan ke AgenSUSI. `contact` wajib untuk pengunjung anonim. */
  const escalate = async (contact) => {
    const data = await api.post('/chatbot/escalate', { session_id: sessionRef.current, contact: contact || undefined });
    setConv((c) => ({
      ...c,
      escalation: { id: data.escalation.id, status: data.escalation.status },
      available: data.available,
      messages: [
        ...c.messages.map((m) => (m.escalationSuggested ? { ...m, escalationSuggested: false } : m)),
        ...(data.message ? [fromServer({ ...data.message })] : []),
      ],
    }));
    return data;
  };

  /** Mulai percakapan baru (riwayat lama tetap di server, hanya dilepas dari tampilan). */
  const reset = () => {
    controllerRef.current?.abort();
    sessionRef.current = null;
    syncedIdRef.current = 0;
    writeStored(key, null);
    setConv((c) => ({ ...EMPTY, key: c.key }));
    setError(null);
  };

  return {
    messages: conv.messages,
    escalation: conv.escalation,
    available: conv.available,
    restoring: conv.restore,
    hasSession: Boolean(conv.sessionId),
    busy,
    error,
    send,
    stop,
    retry,
    rate,
    escalate,
    reset,
  };
}

export default useChat;
