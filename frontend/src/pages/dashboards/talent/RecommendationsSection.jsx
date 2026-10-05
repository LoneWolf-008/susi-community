import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { NEED_CATEGORY } from '../../../lib/statusMap';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import { MatchBadge, SkillMatchChips, WhyMatch, RecommendationNote } from '../../../components/recommendation/MatchBits';

const LIMIT = 6;

/**
 * "Rekomendasi untuk Anda" (R2): kebutuhan terbuka yang paling cocok dengan keahlian talenta
 * (GET /recommendations/needs), dengan alasan & keahlian yang bisa dipelajari. Kebutuhan yang
 * mengundang talenta ditandai "Diundang" dan selalu di atas.
 */
export default function RecommendationsSection({ version = 0, onOpen, onCompleteProfile }) {
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/recommendations/needs', { signal, query: { limit: LIMIT } }),
    [version],
  );
  const items = data?.items || [];

  return (
    <section className="mb-8" aria-labelledby="recs-title">
      <div className="dash-item flex items-end justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 id="recs-title" className="text-2xl md:text-3xl font-black tracking-tight">Rekomendasi untuk Anda</h2>
          <RecommendationNote />
        </div>
        {data && items.length > 0 && <span className="font-mono text-[10px] opacity-60">{data.total} KEBUTUHAN COCOK</span>}
      </div>

      {error && <ErrorState error={error} onRetry={refetch} compact />}
      {loading && !data && !error && <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><SkeletonCard /><SkeletonCard /></div>}

      {data?.hint && (
        <div className="dash-item card-light p-6 border-l-4 border-l-[#e62b2b]">
          <h3 className="text-lg font-black mb-1">Lengkapi keahlian Anda dulu</h3>
          <p className="text-sm text-[#12283c]/70 mb-4">{data.hint} Rekomendasi muncul begitu keahlian tersimpan.</p>
          <button type="button" onClick={onCompleteProfile} className="btn-pill btn-red !py-3 min-h-[44px] text-xs">Lengkapi keahlian →</button>
        </div>
      )}
      {data && !data.hint && items.length === 0 && (
        <div className="dash-item card-light p-6">
          <p className="text-sm text-[#12283c]/70">Belum ada kebutuhan terbuka yang cocok dengan keahlian Anda. Telusuri katalog di bawah, atau tambah keahlian di Profil.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map((n) => (
          <article key={n.id} className={`dash-item card-light p-5 flex flex-col ${n.invited ? 'border-[#e62b2b]' : ''}`}>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <MatchBadge score={n.score} />
              {n.invited && <span className="rounded-full bg-[#e62b2b] text-white px-3 py-1 font-mono text-[10px] font-black">✉ DIUNDANG</span>}
            </div>
            <h3 className="font-black text-base leading-snug mb-1 break-words">{n.title}</h3>
            <p className="font-mono text-[10px] opacity-60 mb-3">{NEED_CATEGORY[n.category] || n.category} · {n.community_name || 'Tanpa komunitas'}</p>
            <div className="mb-3"><SkillMatchChips matched={n.matched_skills} missing={n.missing_skills} /></div>
            {n.reasons[0] && <p className="text-xs text-[#12283c]/75 leading-relaxed">{n.reasons[0]}</p>}
            <WhyMatch reasons={n.reasons} matched={n.matched_skills} confidence={n.confidence} />
            <div className="mt-auto pt-3 flex gap-2">
              <button type="button" onClick={() => onOpen(n, { apply: true })} className="btn-pill btn-red !py-2 !px-4 min-h-[44px] flex-1 text-xs">Lamar →</button>
              <button type="button" onClick={() => onOpen(n)} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-xs">Detail</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
