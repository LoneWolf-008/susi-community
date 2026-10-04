import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { TALENT_LEVEL } from '../../../lib/statusMap';
import { timeAgo } from '../../../lib/format';
import { ROLE_LABELS } from '../../../context/authContext';
import MiniBars from '../../../components/common/MiniBars';
import ActivityFeed from '../../../components/common/ActivityFeed';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import { AUDIT_ENTITY, auditAction } from './labels';

/** Ringkasan platform: angka utama, kunjungan per minggu, pengguna per peran, status, talenta teratas, aktivitas. */
export default function RingkasanTab({ first, statsQ, onTab }) {
  // /api/health tidak memakai amplop { data }, jadi pakai api.send (badan respons utuh).
  const healthQ = useApi((signal) => api.send('GET', '/health', { signal }), []);
  const topQ = useApi((signal) => api.get('/talent/top', { signal, query: { limit: 5 } }), []);
  const auditQ = useApi((signal) => api.get('/admin/audit-logs', { signal, query: { limit: 6 } }), []);
  const s = statsQ.data;
  const roles = s ? Object.entries(s.users_by_role) : [];
  const activeTotal = roles.reduce((sum, [, n]) => sum + n, 0);
  const weeks = s ? s.weekly_visits.map((v, i, all) => ({ l: i === all.length - 1 ? 'INI' : `-${all.length - 1 - i}`, v })) : [];
  const allOk = !healthQ.error && !statsQ.error && healthQ.data?.status === 'OK';
  const topMax = Math.max(1, ...(topQ.data?.items || []).map((t) => Number(t.reputation_points) || 0));

  const cards = [
    { v: s?.users_active, l: 'PENGGUNA AKTIF' },
    { v: s?.needs_queue, l: 'KEBUTUHAN TERBUKA', tab: null },
    { v: s?.projects_running, l: 'PROYEK BERJALAN' },
    { v: s?.projects_completed, l: 'SELESAI TERVERIFIKASI' },
    { v: s?.moderation_pending, l: 'ANTREAN MODERASI', tab: 'moderasi' },
    { v: s?.disputes_open, l: 'SENGKETA TERBUKA', tab: 'sengketa' },
  ];

  return (
    <>
      <div className="dash-item card-light p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
        <div>
          <p className="label-mono mb-2">Pusat Kendali</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, {first}.</h1>
          <p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed">Moderasi kebutuhan & testimoni, mediasi sengketa, dan kelola akun dari sini.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-5 py-3 ${allOk ? 'bg-[#c9ecd9]' : 'bg-[#e62b2b] text-white'}`}>
          <span className={`w-2 h-2 rotate-45 ${allOk ? 'bg-[#12283c] animate-pulse' : 'bg-white'}`} />
          <span className="font-mono text-[10px] font-black">{healthQ.loading && !healthQ.data ? 'MEMERIKSA…' : allOk ? 'API & DATABASE NORMAL' : 'ADA GANGGUAN'}</span>
        </div>
      </div>

      {statsQ.error && <ErrorState error={statsQ.error} onRetry={statsQ.refetch} />}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
        {cards.map((c) => {
          const Tag = c.tab ? 'button' : 'div';
          return (
            <Tag key={c.l} {...(c.tab ? { type: 'button', onClick: () => onTab(c.tab) } : {})} className="dash-item bg-[#fdfcf7] p-6 text-left hover:bg-[#e62b2b] hover:text-white transition-colors">
              <div className="text-4xl md:text-5xl font-black tabular-nums">{c.v ?? '—'}</div>
              <p className="label-mono mt-1">{c.l}{c.tab ? ' →' : ''}</p>
            </Tag>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="dash-item card-light col-span-12 lg:col-span-5 p-7">
          <h3 className="text-xl font-black mb-1">Kunjungan Situs</h3>
          <p className="label-mono mb-5">PER MINGGU · 6 MINGGU TERAKHIR</p>
          {s ? <MiniBars data={weeks} /> : <SkeletonLines count={4} />}
        </div>
        <div className="dash-item card-light col-span-12 lg:col-span-4 p-7">
          <h3 className="text-xl font-black mb-1">Pengguna Aktif per Peran</h3>
          <p className="label-mono mb-5">{activeTotal} AKUN AKTIF</p>
          <div className="space-y-4">
            {roles.map(([role, n]) => {
              const pct = activeTotal ? Math.round((n / activeTotal) * 100) : 0;
              return (
                <div key={role}>
                  <div className="flex justify-between font-mono text-[10px] font-bold mb-1.5"><span>{ROLE_LABELS[role] || role}</span><span>{n} · {pct}%</span></div>
                  <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden"><div className="h-full rounded-full bg-[#12283c]" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
            {!s && <SkeletonLines count={4} />}
          </div>
        </div>
        <div className="dash-item card-light col-span-12 lg:col-span-3 p-7">
          <h3 className="text-xl font-black mb-5">Status Sistem</h3>
          <div className="space-y-3">
            {[
              ['API', healthQ.error ? 'GANGGUAN' : healthQ.data ? 'OK' : '…'],
              ['DATABASE', statsQ.error ? 'GANGGUAN' : s ? 'OK' : '…'],
            ].map(([label, state]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-[#12283c]/15 px-3 py-2">
                <span className="font-mono text-[10px] font-bold">{label}</span>
                <span className={`flex items-center gap-1.5 font-mono text-[9px] font-black ${state === 'GANGGUAN' ? 'text-[#e62b2b]' : 'text-[#12283c]'}`}>
                  <span className={`w-2 h-2 rotate-45 ${state === 'OK' ? 'bg-[#15803d]' : 'bg-[#e62b2b]'}`} />{state}
                </span>
              </div>
            ))}
            {healthQ.data?.timestamp && <p className="font-mono text-[9px] opacity-50">DICEK {timeAgo(healthQ.data.timestamp).toUpperCase()}</p>}
          </div>
        </div>
        <div className="dash-item card-light col-span-12 lg:col-span-7 p-7">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-black">Aktivitas Terbaru</h3>
            <button type="button" onClick={() => onTab('audit')} className="chip-mono text-[#12283c] hover:border-[#e62b2b]">LOG AUDIT →</button>
          </div>
          {auditQ.error && <ErrorState error={auditQ.error} onRetry={auditQ.refetch} compact />}
          {auditQ.loading && !auditQ.data && <SkeletonLines count={5} />}
          {auditQ.data?.items.length === 0 && <p className="text-sm text-[#12283c]/60">Belum ada aktivitas tercatat.</p>}
          {auditQ.data && (
            <ActivityFeed items={auditQ.data.items.map((a) => ({
              c: auditAction(a.action).color,
              t: `${a.actor_name || 'Sistem'} · ${auditAction(a.action).label.toLowerCase()} ${(AUDIT_ENTITY[a.entity] || a.entity).toLowerCase()}`,
              s: a.title || '',
              time: timeAgo(a.created_at),
            }))} />
          )}
        </div>
        <div className="dash-item rounded-xl col-span-12 lg:col-span-5 bg-[#12283c] text-[#f2efe6] p-7">
          <h3 className="text-xl font-black mt-1 mb-5">Talenta Teratas</h3>
          {topQ.loading && !topQ.data && <SkeletonLines count={3} dark />}
          {topQ.data?.items.length === 0 && <p className="text-sm opacity-70">Belum ada talenta.</p>}
          <div className="space-y-4">
            {(topQ.data?.items || []).map((t, i) => (
              <div key={t.id} className="flex items-center gap-4">
                <span className="text-2xl font-black text-[#e62b2b]">0{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2 text-xs font-bold mb-1"><span className="truncate">{t.name}</span><span className="font-mono shrink-0">{t.reputation_points} POIN · {t.projects_completed} PROYEK</span></div>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-[#e62b2b]" style={{ width: `${(Number(t.reputation_points) / topMax) * 100}%` }} /></div>
                  <p className="font-mono text-[9px] opacity-50 mt-1">{(TALENT_LEVEL[t.level] || t.level).toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
