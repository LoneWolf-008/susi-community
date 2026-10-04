import { useEffect, useId, useRef } from 'react';

/**
 * Modal dasar: overlay, Esc menutup, fokus awal ke dialog dan kembali ke pemicu saat ditutup,
 * Tab tetap di dalam dialog. Isi bebas lewat children.
 */
export default function Modal({ title, eyebrow, onClose, children, size = 'max-w-2xl', busy = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || []);
    (focusable()[1] || focusable()[0] || dialog)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-[500] bg-[#0e2233]/90 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-[#12283c] text-[#f2efe6] w-full ${size} border border-white/10 rounded-2xl p-6 md:p-8 relative max-h-[90vh] overflow-y-auto outline-none`}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup"
          className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl font-black hover:bg-[#e62b2b] hover:border-[#e62b2b] transition-colors disabled:opacity-40"
        >
          ×
        </button>
        {eyebrow && <span className="chip-mono border-0 bg-[#e62b2b] text-white">{eyebrow}</span>}
        <h3 id={titleId} className="text-2xl md:text-3xl font-black tracking-tight mt-3 mb-6 pr-12">{title}</h3>
        {children}
      </div>
    </div>
  );
}
