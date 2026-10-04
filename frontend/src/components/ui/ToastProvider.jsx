import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToastContext } from '../../context/toastContext';

const TONES = {
  success: { bg: 'bg-[#c9ecd9] text-[#12283c] border-[#12283c]/15', icon: '✓' },
  error: { bg: 'bg-[#e62b2b] text-white border-[#e62b2b]', icon: '!' },
  info: { bg: 'bg-[#12283c] text-[#f2efe6] border-white/10', icon: 'i' },
};

let nextId = 1;

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const tone = TONES[toast.tone] || TONES.info;
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl ${tone.bg}`}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-black">
        {tone.icon}
      </span>
      <p className="flex-1 text-sm font-bold leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="font-mono text-[10px] font-bold opacity-60 hover:opacity-100"
        aria-label="Tutup notifikasi"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((message, { tone = 'info', duration = 4000 } = {}) => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-3), { id, message, tone, duration }]);
  }, []);

  const value = useMemo(() => ({
    show,
    success: (message) => show(message, { tone: 'success' }),
    error: (message) => show(message, { tone: 'error', duration: 6000 }),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-20 z-[500] flex w-[min(92vw,380px)] flex-col gap-2"
      >
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}
