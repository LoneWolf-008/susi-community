/** Pesan gagal memuat + tombol coba lagi. `error` boleh ApiError atau string. */
export default function ErrorState({ error, onRetry, title = 'Gagal memuat data', compact = false }) {
  const message = typeof error === 'string' ? error : error?.message;
  return (
    <div role="alert" className={`card-light border-[#e62b2b]/30 ${compact ? 'p-4' : 'p-8'} text-center`}>
      <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-[#e62b2b]">⚠ {title.toUpperCase()}</p>
      {message && <p className="mt-3 text-sm text-[#12283c]/70 leading-relaxed">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-pill btn-navy !py-2.5 !px-6 mt-5 text-xs">
          Coba lagi ↻
        </button>
      )}
    </div>
  );
}
