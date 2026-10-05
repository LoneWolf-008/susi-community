import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import { initialOf, timeAgo } from '../../lib/format';
import ErrorState from '../ui/ErrorState';

// Permintaan bergabung talenta ke komunitas yang dikelola pengguna (U1): pengurus, atau AgenSUSI
// untuk komunitas yang ia catat tanpa pengurus berakun. Tidak tampil bila tidak ada permintaan.

const LEVEL = { TALENTA_MUDA: 'TALENTA MUDA', TALENTA_TERPERCAYA: 'TERPERCAYA', TALENTA_AHLI: 'AHLI' };

export default function JoinRequestsPanel({ liveKey = 0, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null); // `${community_id}:${user_id}`
  const { data, error, refetch } = useApi((signal) => api.get('/communities/join-requests', { signal }), [liveKey]);
  const items = data?.items || [];

  const decide = async (r, decision) => {
    const key = `${r.community_id}:${r.user_id}`;
    setBusy(key);
    try {
      await api.patch(`/communities/${r.community_id}/join-requests/${r.user_id}`, { decision });
      toast.success(decision === 'ACTIVE' ? `${r.name} kini anggota ${r.community_name}` : `Permintaan ${r.name} ditolak`);
      refetch();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
      refetch();
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div className="mb-6"><ErrorState error={error} onRetry={refetch} compact /></div>;
  if (items.length === 0) return null;

  return (
    <section className="dash-item card-light p-5 md:p-6 mb-6 border-l-4 border-l-[#0f766e]" aria-labelledby="join-requests-title">
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-4">
        <h2 id="join-requests-title" className="text-lg md:text-xl font-black">Permintaan bergabung</h2>
        <span className="chip-mono border-0 bg-[#0f766e] text-white whitespace-nowrap">{items.length} MENUNGGU</span>
      </div>
      <ul className="space-y-3">
        {items.map((r) => {
          const key = `${r.community_id}:${r.user_id}`;
          return (
            <li key={key} className="rounded-xl border border-[#12283c]/15 bg-[#fdfcf7] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="w-10 h-10 rounded-full bg-[#12283c] text-[#f2efe6] font-black flex items-center justify-center shrink-0" aria-hidden="true">{initialOf(r.name)}</span>
                <div className="min-w-0">
                  <p className="font-black text-sm">
                    {r.name}
                    {r.level && <span className="ml-2 font-mono text-[9px] font-bold opacity-60">{LEVEL[r.level] || r.level}</span>}
                  </p>
                  <p className="font-mono text-[10px] opacity-60 break-words">
                    KE {r.community_name.toUpperCase()} · {timeAgo(r.requested_at)} · {r.completed_projects} PROYEK SELESAI
                  </p>
                  {r.skills && <p className="text-xs mt-1 break-words"><strong>Keahlian:</strong> {r.skills}</p>}
                  {r.message && <p className="text-sm mt-1 italic break-words">“{r.message}”</p>}
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <button type="button" onClick={() => decide(r, 'REJECTED')} disabled={busy === key} className="btn-pill btn-ghost-dark !py-3 min-h-[44px] flex-1 sm:flex-none text-xs">Tolak</button>
                <button type="button" onClick={() => decide(r, 'ACTIVE')} disabled={busy === key} className="btn-pill btn-navy !py-3 min-h-[44px] flex-1 sm:flex-none text-xs">{busy === key ? '…' : 'Setujui'}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
