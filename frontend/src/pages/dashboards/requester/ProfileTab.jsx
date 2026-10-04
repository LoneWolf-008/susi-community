import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { formatDate, timeAgo, initialOf } from '../../../lib/format';
import { projectStatus, moderationStatus, needStatus } from '../../../lib/statusMap';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';

export default function ProfileTab({ user, cards, roleLabel = 'KOMUNITAS', onEdit }) {
  const testiQ = useApi((signal) => api.get('/testimonials/mine', { signal, query: { limit: 10 } }), []);
  const commQ = useApi((signal) => api.get('/communities', { signal, query: { mine: 'true', limit: 1 } }), []);
  const completed = cards.filter((c) => c.project?.status === 'COMPLETED');
  const history = [...cards].sort((a, b) => new Date(b.need.created_at) - new Date(a.need.created_at)).slice(0, 8);

  const statusOf = ({ need, project }) => (project
    ? projectStatus(project.status)
    : need.moderation_status !== 'APPROVED' ? moderationStatus(need.moderation_status) : needStatus(need.status));

  return (
    <>
      <div className="dash-item rounded-2xl bg-[#12283c] text-[#f2efe6] p-8 md:p-10 mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 border-2 border-[#e62b2b]/30 rounded-full" />
        <div className="grid grid-cols-12 gap-6 relative z-10">
          <div className="col-span-12 md:col-span-4 flex flex-col items-center md:items-start gap-4">
            <div className="w-28 h-28 rounded-2xl bg-[#e62b2b] flex items-center justify-center text-5xl font-black">{initialOf(user?.name)}</div>
            <div>
              <h2 className="text-2xl font-black">{user?.name}</h2>
              <p className="font-mono text-[10px] text-[#e62b2b] font-bold mt-1">{roleLabel}</p>
              {user?.extra_info && <p className="text-xs opacity-70 mt-1">{user.extra_info}</p>}
            </div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <p className="text-sm leading-relaxed opacity-80 mb-6">
              {user?.bio || 'Belum ada bio. Ceritakan singkat tentang komunitasmu di Pengaturan agar talenta lebih mengenal.'}
            </p>
            <div className="grid grid-cols-3 gap-px bg-white/10 rounded-xl overflow-hidden">
              {[
                { v: cards.length, l: 'TOTAL KEBUTUHAN' },
                { v: completed.length, l: 'SELESAI' },
                { v: commQ.data?.total ?? '—', l: 'KOMUNITAS' },
              ].map((s) => (
                <div key={s.l} className="bg-[#12283c] p-4"><div className="text-3xl font-black tabular-nums text-[#e62b2b]">{s.v}</div><p className="label-mono mt-1">{s.l}</p></div>
              ))}
            </div>
            {onEdit && <button type="button" onClick={onEdit} className="btn-pill btn-ghost-light !py-2.5 !px-5 text-[10px] mt-5">UBAH PROFIL →</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className="dash-item card-light p-7">
            <h3 className="text-xl font-black mb-5">Riwayat Kebutuhan</h3>
            {history.length === 0 && <p className="text-sm text-[#12283c]/60">Belum ada kebutuhan yang diajukan.</p>}
            <ol className="space-y-0">
              {history.map((c) => (
                <li key={c.need.id} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
                  <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-[#12283c] ${c.project?.status === 'COMPLETED' ? 'bg-[#c9ecd9]' : 'bg-[#e62b2b]'}`} />
                  <div className="flex items-center gap-3 mb-2 flex-wrap"><span className="font-mono text-[10px] font-bold">{formatDate(c.need.created_at)}</span><StatusChip status={statusOf(c)} /></div>
                  <h4 className="font-black text-base mb-1">{c.need.title}</h4>
                  {c.project?.talent_name && <p className="text-xs text-[#12283c]/60">Talenta: {c.project.talent_name}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="dash-item rounded-xl bg-[#c9ecd9] text-[#12283c] p-7">
            <h3 className="text-xl font-black mb-5">Proyek Terverifikasi</h3>
            {completed.length === 0 && <p className="text-sm opacity-70">Belum ada proyek yang selesai diverifikasi.</p>}
            <div className="space-y-5">
              {completed.map(({ need, project }) => (
                <div key={need.id} className="border-b-2 border-[#12283c]/15 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2"><span className="font-mono text-[10px] font-bold">{formatDate(project.community_verified_at)}</span><span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">✓ SELESAI</span></div>
                  <h4 className="font-black text-base mb-1">{need.title}</h4>
                  <p className="text-xs">Dikerjakan {project.talent_name}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-item rounded-xl bg-[#e62b2b] text-white p-7">
            <h3 className="text-xl font-black mb-5">Testimoni dari Talenta</h3>
            {testiQ.error && <ErrorState error={testiQ.error} onRetry={testiQ.refetch} compact />}
            {testiQ.loading && !testiQ.data && <SkeletonLines count={3} dark />}
            {testiQ.data?.items.length === 0 && <p className="text-sm opacity-80">Belum ada testimoni. Talenta bisa memberi testimoni setelah proyek selesai.</p>}
            <div className="space-y-5">
              {testiQ.data?.items.map((t) => (
                <div key={t.id} className="border-b-2 border-white/20 pb-4 last:border-0">
                  <p className="text-sm italic leading-relaxed mb-2">“{t.text}”</p>
                  <p className="font-mono text-[10px] opacity-70">— {t.from_name} · {t.project_title} · {timeAgo(t.created_at)}{t.moderation_status !== 'APPROVED' ? ' · MENUNGGU MODERASI' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
