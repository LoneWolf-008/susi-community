import { useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/toastContext';
import { TALENT_LEVEL } from '../../lib/statusMap';
import { initialOf } from '../../lib/format';
import { SkeletonCard } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import { MatchBadge, SkillMatchChips, WhyMatch, RecommendationNote } from '../recommendation/MatchBits';

/**
 * Talenta lain yang cocok untuk kebutuhan (R2): bukan pelamar, bersedia tampil di rekomendasi.
 * Pemilik bisa "Undang melamar" (maks. 5 per kebutuhan); talenta tetap memutuskan sendiri.
 * `query` = hasil useApi GET /recommendations/talents dari NeedDetail (dipakai bersama ApplicantsPanel).
 */
export default function MatchingTalentsPanel({ need, query }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, refetch } = query;
  const others = (data?.items || []).filter((t) => !t.applied);
  const quota = data?.invites ?? { used: 0, limit: 5 };
  const left = Math.max(0, quota.limit - quota.used);

  const invite = async (t) => {
    setBusyId(t.talent_id);
    try {
      await api.post(`/needs/${need.id}/invite`, { talent_id: t.talent_id });
      toast.success(`Undangan terkirim ke ${t.name}`);
      refetch();
    } catch (err) {
      toast.error(err.message);
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const action = (t) => {
    if (t.invite_status === 'SENT') return <span className="rounded-full bg-[#c9ecd9] text-[#12283c] px-4 min-h-[44px] inline-flex items-center text-[11px] font-black">✓ Diundang</span>;
    if (left === 0) return <span className="font-mono text-[10px] opacity-60">KUOTA HABIS</span>;
    return (
      <button type="button" onClick={() => invite(t)} disabled={busyId === t.talent_id} className="btn-pill btn-navy !py-2 !px-4 min-h-[44px] text-xs">
        {busyId === t.talent_id ? '…' : 'Undang melamar'}
      </button>
    );
  };

  return (
    <section className="dash-item card-light p-6 md:p-7" aria-labelledby={`match-title-${need.id}`}>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-2">
        <div>
          <h3 id={`match-title-${need.id}`} className="text-xl font-black">Talenta lain yang cocok</h3>
          <RecommendationNote />
        </div>
        <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">SISA UNDANGAN {left}/{quota.limit}</span>
      </div>
      <p className="text-xs text-[#12283c]/60 mb-5">Talenta di bawah belum melamar. Undangan hanya memberi tahu mereka; mereka tetap memutuskan sendiri apakah melamar.</p>

      {error && <ErrorState error={error} onRetry={refetch} compact />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /></div>}
      {data && others.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-[#12283c]/20 p-5 text-center text-sm text-[#12283c]/60">
          Belum ada talenta lain yang keahliannya cocok dengan kebutuhan ini.
        </p>
      )}

      <ul className="space-y-4">
        {others.map((t) => (
          <li key={t.talent_id} className="rounded-xl border border-[#12283c]/15 p-4 md:p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <span className="w-11 h-11 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center font-black shrink-0" aria-hidden="true">{initialOf(t.name)}</span>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black leading-tight">{t.name}</h4>
                  <MatchBadge score={t.score} />
                  {t.certified && <span className="rounded-full border border-[#0f766e] text-[#0f766e] px-2.5 py-0.5 font-mono text-[9px] font-black">✓ TERSERTIFIKASI SUSI</span>}
                </div>
                <p className="font-mono text-[10px] opacity-60 mt-1">{TALENT_LEVEL[t.level] || 'Talenta Muda'} · {t.completed_projects} PROYEK SELESAI</p>
              </div>
            </div>
            <div className="mt-3"><SkillMatchChips matched={t.matched_skills} missing={t.missing_skills} /></div>
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              <WhyMatch reasons={t.reasons} matched={t.matched_skills} confidence={t.confidence} />
              {action(t)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
