import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { applicationStatus, needStatus } from '../../../lib/statusMap';
import { formatDate } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';

const PAGE_SIZE = 15;
const FILTERS = ['', 'MENUNGGU', 'DITERIMA', 'DITOLAK'];
const DOT = { DITERIMA: 'bg-[#c9ecd9]', MENUNGGU: 'bg-[#fdfcf7]', DITOLAK: 'bg-[#12283c]' };

/** Histori lamaran (GET /applications/mine?status=). */
export default function HistoryTab({ onOpenNeed, onOpenProject, onBrowse }) {
  const [status, setStatus] = useState('');
  const [paging, setPaging] = useState({ status: '', page: 1 });
  const page = paging.status === status ? paging.page : 1;
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/applications/mine', { signal, query: { status, page, limit: PAGE_SIZE } }),
    [status, page],
  );
  const items = data?.items || [];

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Histori Lamaran</h1>
          <p className="label-mono mt-2">{data ? `${data.total} LAMARAN${status ? ` ${status}` : ''}` : 'SEMUA LAMARAN YANG PERNAH ANDA KIRIM'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((s) => (
            <button type="button" key={s || 'all'} onClick={() => setStatus(s)} className={`chip-mono transition-colors ${status === s ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s || 'SEMUA'}</button>
          ))}
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="card-light p-7"><SkeletonLines count={6} /></div>}
      {data && items.length === 0 && (
        <EmptyState
          title={status ? `Tidak ada lamaran berstatus ${status.toLowerCase()}` : 'Belum ada lamaran'}
          description="Buka katalog, baca cerita masalah komunitas, lalu ajukan diri dengan pesan singkat."
          action={<button type="button" onClick={onBrowse} className="btn-pill btn-red">Lihat katalog →</button>}
        />
      )}
      {items.length > 0 && (
        <div className="dash-item card-light p-7">
          <ol>
            {items.map((a) => (
              <li key={a.id} className="relative pl-8 pb-6 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
                <span className={`absolute left-[-9px] top-0 w-4 h-4 rotate-45 border-2 border-[#12283c] ${DOT[a.status] || 'bg-[#fdfcf7]'}`} />
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="font-mono text-[10px] font-bold">{formatDate(a.created_at)}</span>
                  <StatusChip status={applicationStatus(a.status)} />
                  {a.status === 'MENUNGGU' && a.need_status !== 'OPEN' && <StatusChip status={needStatus(a.need_status)} />}
                </div>
                <button type="button" onClick={() => onOpenNeed(a.need_id)} className="text-left font-black text-base mb-1 hover:text-[#e62b2b] transition-colors">{a.title}</button>
                <p className="font-mono text-[10px] opacity-50">{a.community_name || 'Tanpa komunitas'}</p>
                {a.message && <p className="text-xs text-[#12283c]/60 mt-2 line-clamp-2">“{a.message}”</p>}
                {a.status === 'DITERIMA' && a.project_id && (
                  <button type="button" onClick={() => onOpenProject(a.project_id)} className="chip-mono mt-2 text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white transition-colors">LIHAT PROYEK →</button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ status, page: p })} />}
    </>
  );
}
