import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/authContext';
import { isHandoffActive } from '../lib/handoff';

// Percakapan Tanya SUSI (T14): streaming jawaban, hentikan, coba lagi, 👍/👎, eskalasi ke AgenSUSI,
// dan polling balasan agen. ID sesi disimpan di sessionStorage per pengguna (anonim: "anon"); sesi
// milik pengguna yang masuk dijaga server (pengguna lain mendapat 404). Saat pengunjung anonim
// masuk, percakapannya diadopsi dan diklaim server pada pesan berikutnya.
// Privasi (T15): bila server menjawab `stored: false` (pengguna mematikan penyimpanan riwayat), id sesi
// tidak diingat; percakapan bisa dihapus dari server (remove) atau seluruhnya dari Pengaturan.
// Ruang AgenSUSI (U6): objek `handoff` dari server. Selama aktif, pesan dikirim ke AgenSUSI (tanpa
// jawaban AI), balasan di-polling (8 detik saat terbuka, 20 detik saat tertutup untuk titik penanda),
// dan pengguna bisa kembali ke AI; setelah selesai pengguna menilai atau bertanya lagi ke AI.

export const MAX_LENGTH = 500;
const POLL_MS = 8000;
const POLL_CLOSED_MS = 20000;
const STORAGE_PREFIX = 'susi_chat_session:';
const HISTORY_DELETED_EVENT = 'susi:chat-history-deleted';
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

/** Setelah riwayat pengguna dihapus di server (Pengaturan): lupakan id sesinya & kosongkan widget yang terbuka. */
export function chatHistoryDeleted(user) {
  writeStored(storageKey(user), null);
  window.dispatchEvent(new Event(HISTORY_DELETED_EVENT));
}

let seq = 0;
const nextKey = () => `m${Date.now()}-${(seq += 1)}`;
const fromServer = (m) => ({ key: `s${m.id}`, id: m.id, role: m.role, content: m.content, status: 'done' });
const patchMessage = (setConv, key, patch) => setConv((c) => ({
  ...c,
  messages: c.messages.map((m) => (m.key === key ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
}));
// stored: null = belum diketahui, false = server tidak menyimpan riwayat percakapan ini.
const EMPTY = { key: null, sessionId: null, messages: [], handoff: null, restore: false, adopted: false, stored: null };
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
          ? { ...c, restore: false, messages: data.messages.map(fromServer), handoff: data.handoff ?? null }
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

  // Selama handoff aktif: ambil pesan baru (balasan AgenSUSI) segera, lalu tiap 8 detik saat widget
  // terbuka atau 20 detik saat tertutup (titik penanda di peluncur), selama tab peramban aktif.
  const handoffActive = isHandoffActive(conv.handoff);
  const polling = enabled && Boolean(conv.sessionId) && handoffActive;
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
              handoff: data.handoff ?? c.handoff,
              messages: fresh.length ? inOrder([...c.messages, ...fresh]) : c.messages,
            };
          });
        } catch {
          // dicoba lagi pada putaran berikutnya
        }
      }
      timer = setTimeout(tick, active ? POLL_MS : POLL_CLOSED_MS);
    };
    timer = setTimeout(tick, 0);
    return () => {
      clearTimeout(timer);
      controller?.abort();
    };
  }, [polling, active]);

  // Widget terbuka & ada balasan AgenSUSI yang belum dilihat → tandai terbaca di server.
  const unread = conv.handoff?.unread ?? 0;
  useEffect(() => {
    if (!active || unread === 0 || !sessionRef.current) return;
    api.post('/chatbot/handoff/read', { session_id: sessionRef.current }).then(
      () => setConv((c) => (c.handoff ? { ...c, handoff: { ...c.handoff, unread: 0 } } : c)),
      () => {}, // dicoba lagi saat balasan berikutnya masuk
    );
  }, [active, unread]);

  const send = async (raw) => {
    const message = String(raw ?? '').trim().slice(0, MAX_LENGTH);
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const userKey = nextKey();
    if (handoffActive) {
      await sendToAgent(message, userKey);
      return;
    }
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
            // Riwayat tidak disimpan (pilihan pengguna): id sesi tidak diingat untuk dipulihkan.
            const stored = data.stored !== false;
            writeStored(key, stored ? data.session_id : null);
            setConv((c) => ({
              ...c,
              sessionId: data.session_id,
              stored,
              messages: c.messages.map((m) => (m.key === userKey ? { ...m, id: data.user_message_id } : m)),
            }));
          } else if (event === 'delta') {
            patchMessage(setConv, botKey, (m) => ({ content: m.content + data.content }));
          } else if (event === 'done' && !data.message) {
            // Server sudah dalam mode AgenSUSI (mis. tiket dibuat dari tab lain): tidak ada jawaban AI.
            setConv((c) => ({ ...c, handoff: data.handoff ?? c.handoff, messages: c.messages.filter((m) => m.key !== botKey) }));
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
                  cards: data.cards ?? [], // R3: kartu rekomendasi (tidak dipulihkan dari riwayat)
                  escalationSuggested: data.escalation_suggested,
                  ratable: true,
                } : m)),
              handoff: data.handoff ?? c.handoff,
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

  /**
   * Handoff aktif (U6): pesan untuk AgenSUSI lewat /message (tanpa stream, tanpa jawaban AI).
   * Dipanggil dari send() setelah status sibuk dipasang.
   */
  const sendToAgent = async (message, userKey) => {
    setConv((c) => ({ ...c, messages: [...c.messages, { key: userKey, role: 'user', content: message, status: 'done' }] }));
    try {
      const data = await api.post('/chatbot/message', { session_id: sessionRef.current, message });
      // Bila AgenSUSI baru saja menyelesaikan tiket, server sudah kembali ke mode AI dan menjawab.
      const answer = data.message
        ? [{ ...fromServer(data.message), source: data.source, sources: data.sources, cards: data.cards ?? [], escalationSuggested: data.escalation_suggested, ratable: true }]
        : [];
      setConv((c) => ({
        ...c,
        handoff: data.handoff ?? c.handoff,
        messages: [...c.messages.map((m) => (m.key === userKey ? { ...m, id: data.user_message_id } : m)), ...answer],
      }));
    } catch (err) {
      setConv((c) => ({ ...c, messages: c.messages.map((m) => (m.key === userKey ? { ...m, status: 'failed' } : m)) }));
      setError({ message: err.status === 0 ? OFFLINE_MESSAGE : err.message, retryText: message, userKey });
    } finally {
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
      handoff: data.handoff ?? c.handoff,
      messages: [
        ...c.messages.map((m) => (m.escalationSuggested ? { ...m, escalationSuggested: false } : m)),
        ...(data.message ? [fromServer({ ...data.message })] : []),
      ],
    }));
    return data;
  };

  /** "Lanjut dengan AI": tutup kartu tawaran AgenSUSI tanpa membuat tiket. */
  const declineHandoff = () => setConv((c) => ({
    ...c,
    messages: c.messages.map((m) => (m.escalationSuggested ? { ...m, escalationSuggested: false } : m)),
  }));

  /** "Kembali ke asisten AI": batalkan permintaan AgenSUSI yang masih terbuka. Melempar galat bila gagal. */
  const cancelHandoff = async () => {
    const data = await api.post('/chatbot/handoff/cancel', { session_id: sessionRef.current });
    setConv((c) => ({
      ...c,
      handoff: data.handoff,
      messages: data.message ? inOrder([...c.messages, fromServer(data.message)]) : c.messages,
    }));
  };

  /** Setelah AgenSUSI selesai: nilai 1–5, atau `null` = langsung bertanya lagi ke AI. */
  const rateHandoff = async (rating) => {
    const data = await api.post('/chatbot/handoff/rate', { session_id: sessionRef.current, rating });
    setConv((c) => ({ ...c, handoff: data.handoff }));
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

  /** Hapus percakapan ini dari server (pesan & tiket bantuannya), lalu mulai baru. Melempar galat bila gagal. */
  const remove = async () => {
    const id = sessionRef.current;
    if (id) {
      try {
        await api.delete(`/chatbot/session/${id}`);
      } catch (err) {
        if (err.status !== 404) throw err; // sudah tidak ada: cukup dilepas dari tampilan
      }
    }
    reset();
  };

  // Seluruh riwayat dihapus dari Pengaturan → lepaskan percakapan yang sedang tampil.
  const onHistoryDeleted = useEffectEvent(() => reset());
  useEffect(() => {
    const handler = () => onHistoryDeleted();
    window.addEventListener(HISTORY_DELETED_EVENT, handler);
    return () => window.removeEventListener(HISTORY_DELETED_EVENT, handler);
  }, []);

  return {
    messages: conv.messages,
    handoff: conv.handoff,
    handoffActive,
    unread,
    sessionId: conv.sessionId,
    restoring: conv.restore,
    hasSession: Boolean(conv.sessionId),
    stored: conv.stored,
    busy,
    error,
    send,
    stop,
    retry,
    rate,
    escalate,
    declineHandoff,
    cancelHandoff,
    rateHandoff,
    reset,
    remove,
  };
}

export default useChat;
