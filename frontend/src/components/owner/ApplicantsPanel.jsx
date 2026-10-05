import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import { applicationStatus, TALENT_LEVEL } from '../../lib/statusMap';
import { timeAgo, initialOf } from '../../lib/format';
import StatusChip from '../common/StatusChip';
import CertifiedBadge from '../common/CertifiedBadge';
import { SkeletonCard } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import ChooseTalentModal from './ChooseTalentModal';
import { MatchBadge, WhyMatch, RecommendationNote } from '../recommendation/MatchBits';

/**
 * Daftar pelamar beserta rekam jejaknya (PRD P0-3/P0-6) untuk pemilik kebutuhan
 * (requester, atau liaison sebagai pemilik proksi). R2: `matches` (hasil GET
 * /recommendations/talents) menambahkan skor kecocokan; pelamar diurutkan dari yang paling cocok.
 */
export default function ApplicantsPanel({ need, matches, onChanged }) {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get(`/applications/for-need/${need.id}`, { signal, query: { limit: 50 } }),
    [need.id],
  );
  const [choosing, setChoosing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const matchOf = new Map((matches || []).filter((m) => m.applied).map((m) => [Number(m.talent_id), m]));
  const items = [...(data?.items || [])].sort((a, b) => (matchOf.get(Number(b.talent_id))?.score ?? -1) - (matchOf.get(Number(a.talent_id))?.score ?? -1));
  const waiting = items.filter((a) => a.status === 'MENUNGGU');

  const reject = async (app) => {
    setRejecting(app.id);
    try {
      await api.patch(`/applications/${app.id}/decide`, { decision: 'DITOLAK' });
      toast.show(`Lamaran ${app.talent_name} ditolak`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRejecting(null);
    }
  };

  return (
    <section className="dash-item card-light p-6 md:p-7">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h3 className="text-xl font-black">Pelamar</h3>
          <p className="label-mono mt-1">NILAI DARI REKAM JEJAK & TESTIMONI{matchOf.size > 0 ? ' · URUT DARI YANG PALING COCOK' : ''}</p>
          {matchOf.size > 0 && <div className="mt-1"><RecommendationNote /></div>}
        </div>
        <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{waiting.length} MENUNGGU</span>
      </div>

      {error && <ErrorState error={error} onRetry={refetch} compact />}
      {loading && !data && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState
          title="Belum ada pelamar"
          description="Kebutuhan Anda sudah tampil di katalog talenta. Biasanya lamaran pertama masuk dalam beberapa hari; Anda akan mendapat notifikasi."
          icon="⌛"
        />
      )}

      <div className="space-y-4">
        {items.map((a) => {
          const m = matchOf.get(Number(a.talent_id));
          return (
          <article key={a.id} className={`rounded-xl border p-5 ${a.status === 'MENUNGGU' ? 'border-[#12283c]/20' : 'border-[#12283c]/10 opacity-70'}`}>
            <div className="flex items-start gap-4 flex-wrap">
              <span className="w-12 h-12 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center font-black shrink-0">{initialOf(a.talent_name)}</span>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-lg leading-tight">{a.talent_name}</h4>
                  <StatusChip status={applicationStatus(a.status)} />
                  {m && <MatchBadge score={m.score} />}
                  {m?.certified && <CertifiedBadge />}
                  {m?.invite_status === 'ACCEPTED' && <span className="font-mono text-[9px] font-bold opacity-60">MELAMAR SETELAH DIUNDANG</span>}
                </div>
                <p className="font-mono text-[10px] opacity-60 mt-1">
                  {TALENT_LEVEL[a.level] || 'Talenta Muda'} · {a.reputation_points ?? 0} POIN · {a.projects_completed} PROYEK SELESAI · MELAMAR {timeAgo(a.created_at).toUpperCase()}
                </p>
                {a.extra_info && <p className="text-xs mt-2 text-[#12283c]/70">{a.extra_info}</p>}
              </div>
            </div>

            {m && <WhyMatch reasons={m.reasons} matched={m.matched_skills} confidence={m.confidence} />}
            {a.message && <p className="mt-4 text-sm leading-relaxed bg-[#12283c]/5 rounded-lg p-3">“{a.message}”</p>}

            {a.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {a.skills.map((s) => <span key={s.id} className="chip-mono text-[#12283c]">{s.name}</span>)}
              </div>
            )}

            <div className="mt-4">
              <p className="label-mono mb-2">TESTIMONI TERBARU</p>
              {a.recent_testimonials.length === 0
                ? <p className="text-xs text-[#12283c]/50">Belum ada testimoni — talenta ini mungkin baru memulai.</p>
                : (
                  <ul className="space-y-2">
                    {a.recent_testimonials.map((t) => (
                      <li key={t.id} className="text-xs leading-relaxed border-l-2 border-[#c9ecd9] pl-3">
                        <span className="italic">“{t.text}”</span>
                        <span className="block font-mono text-[9px] opacity-50 mt-0.5">— {t.from_name} · {t.project_title}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            {a.status === 'MENUNGGU' && need.status === 'OPEN' && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => setChoosing(a)} className="btn-pill btn-red !py-3 flex-1 min-w-[160px] text-xs">Pilih talenta ini →</button>
                <button type="button" onClick={() => reject(a)} disabled={rejecting === a.id} className="btn-pill btn-ghost-dark !py-3 text-xs">{rejecting === a.id ? '…' : 'Tolak'}</button>
              </div>
            )}
          </article>
          );
        })}
      </div>

      {choosing && (
        <ChooseTalentModal
          application={choosing}
          need={need}
          onClose={() => setChoosing(null)}
          onChosen={() => {
            toast.success(`${choosing.talent_name} dipilih. Menunggu talenta menyetujui kesepakatan.`);
            setChoosing(null);
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}
