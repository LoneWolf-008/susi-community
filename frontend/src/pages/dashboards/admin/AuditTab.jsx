import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { ROLE_LABELS } from '../../../context/authContext';
import { formatDateTime } from '../../../lib/format';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import { AUDIT_ACTION, AUDIT_ENTITY, auditAction } from './labels';

const PAGE_SIZE = 25;

/** Ringkas meta (mis. { decision: 'APPROVED' }) menjadi teks "decision: APPROVED". */
const metaText = (meta) => (meta && typeof meta === 'object'
  ? Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join(' · ')
  : '');

/** Log audit (GET /admin/audit-logs) dengan filter entitas & aksi. */
export default function AuditTab() {
  const [filters, setFilters] = useState({ entity: '', action: '' });
  const filterKey = JSON.stringify(filters);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/admin/audit-logs', { signal, query: { ...filters, page, limit: PAGE_SIZE } }),
    [filters, page],
  );
  const items = data?.items || [];

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Log Audit</h1><p className="label-mono mt-2">{data ? `${data.total} CATATAN` : 'JEJAK AKSI PENTING'}</p></div>
        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="audit-entity">Entitas</label>
          <select id="audit-entity" value={filters.entity} onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))} className="input-line !w-auto">
            <option value="">Semua entitas</option>
            {Object.entries(AUDIT_ENTITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="sr-only" htmlFor="audit-action">Aksi</label>
          <select id="audit-action" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} className="input-line !w-auto">
            <option value="">Semua aksi</option>
            {Object.entries(AUDIT_ACTION).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="card-light p-7"><SkeletonLines count={8} /></div>}
      {data && items.length === 0 && <EmptyState title="Belum ada catatan" description="Aksi seperti moderasi, keputusan sengketa, dan perubahan status akun tercatat di sini." />}
      {items.length > 0 && (
        <div className={`dash-item card-light p-7 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <ol className="divide-y divide-[#12283c]/10">
            {items.map((a) => {
              const act = auditAction(a.action);
              const meta = metaText(a.meta);
              return (
                <li key={a.id} className="py-3 flex gap-4 items-start">
                  <span className={`mt-1.5 w-2 h-2 shrink-0 rotate-45 ${act.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight">
                      {a.actor_name || 'Sistem'} <span className="font-normal opacity-60">({ROLE_LABELS[a.actor_role] || a.actor_role || '—'})</span> · {act.label.toLowerCase()} {(AUDIT_ENTITY[a.entity] || a.entity).toLowerCase()} #{a.entity_id}
                    </p>
                    {a.title && <p className="text-xs text-[#12283c]/60 mt-0.5">{a.title}</p>}
                    {meta && <p className="font-mono text-[9px] opacity-50 mt-0.5">{meta}</p>}
                  </div>
                  <span className="font-mono text-[10px] opacity-50 shrink-0 text-right">{formatDateTime(a.created_at)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ key: filterKey, page: p })} />}
    </>
  );
}
