import { useId } from 'react';
import { RecommendationNote } from './MatchBits';

/**
 * Bingkai kartu "Rekomendasi AI" di Beranda (talenta & komunitas). Isinya dari skor deterministik
 * /recommendations/* (tanpa LLM); label "keputusan tetap di tangan Anda" selalu tampil.
 */
export default function AiCard({ title, aside, children }) {
  const id = useId();
  return (
    <section data-ai-card aria-labelledby={id} className="dash-item rounded-2xl bg-[#12283c] text-[#f2efe6] p-5 sm:p-6 md:p-8 mb-6">
      <div className="flex items-start justify-between flex-wrap gap-x-4 gap-y-2 mb-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-black tracking-[0.3em] text-[#e62b2b] mb-1">✦ REKOMENDASI AI</p>
          <h2 id={id} className="text-2xl md:text-3xl font-black tracking-tight mb-1">{title}</h2>
          <RecommendationNote dark />
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Kotak terang di dalam kartu (tip, progres, pesan kosong). */
export function AiPanel({ className = '', children }) {
  return <div className={`rounded-xl bg-[#fdfcf7] text-[#12283c] p-4 sm:p-5 ${className}`}>{children}</div>;
}

/** Pemberitahuan saat personalisasi dimatikan: kartu tidak membaca data pribadi sama sekali. */
export function AiPersonalizationOff({ onOpenSettings, children }) {
  return (
    <AiPanel>
      <p className="font-black mb-1">Personalisasi AI sedang dimatikan</p>
      <p className="text-sm text-[#12283c]/70 leading-relaxed mb-4">
        Sesuai pilihan Anda di Pengaturan, kartu ini tidak membaca {children}. Nyalakan &ldquo;Personalisasi Tanya SUSI&rdquo; bila ingin melihat saran pribadi di sini.
      </p>
      {onOpenSettings && <button type="button" onClick={onOpenSettings} className="btn-pill btn-navy !py-2.5 !px-5 min-h-[44px] text-xs">Buka Pengaturan</button>}
    </AiPanel>
  );
}

/** Rangka saat memuat. */
export function AiCardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="status" aria-label="Memuat rekomendasi">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-white/5 p-4 space-y-3">
          <span className="block h-5 w-20 animate-pulse rounded-full bg-white/10" />
          <span className="block h-5 w-3/4 animate-pulse rounded-md bg-white/10" />
          <span className="block h-4 w-full animate-pulse rounded-md bg-white/10" />
          <span className="block h-11 w-full animate-pulse rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

/** Galat yang tidak memecahkan halaman: pesan singkat + coba lagi. */
export function AiCardError({ onRetry, children = 'Rekomendasi belum bisa dimuat.' }) {
  return (
    <div role="alert" className="rounded-xl border border-[#e62b2b]/50 p-4 flex items-center justify-between flex-wrap gap-3">
      <p className="text-sm">{children}</p>
      {onRetry && <button type="button" onClick={onRetry} className="btn-pill btn-ghost-light !py-2 !px-4 min-h-[44px] text-xs">Coba lagi ↻</button>}
    </div>
  );
}
