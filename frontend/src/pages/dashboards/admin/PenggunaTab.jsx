import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useToast } from '../../../context/toastContext';
import { ROLE_LABELS } from '../../../context/authContext';
import { TALENT_LEVEL } from '../../../lib/statusMap';
import { formatDate, timeAgo } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';

const PAGE_SIZE = 20;
const ROLES = ['', 'requester', 'talent', 'liaison', 'admin'];
const STATUSES = ['', 'AKTIF', 'DITANGGUHKAN'];
const statusChip = (s) => ({ label: s, tone: s === 'AKTIF' ? 'success' : 'danger' });

/** Daftar pengguna (GET /admin/users) dengan cari, filter peran/status, tangguhkan/aktifkan. */
export default function PenggunaTab({ currentUserId, onChanged }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ role: '', status: '' });
  const q = useDebouncedValue(search.trim(), 350);
  const filterKey = JSON.stringify([filters, q]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/admin/users', { signal, query: { ...filters, search: q, page, limit: PAGE_SIZE } }),
    [filters, q, page],
  );
  const items = data?.items || [];

  const toggle = async (u) => {
    const next = u.status === 'AKTIF' ? 'DITANGGUHKAN' : 'AKTIF';
    setBusyId(u.id);
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status: next });
      toast.success(`${u.name} ${next === 'AKTIF' ? 'diaktifkan' : 'ditangguhkan'}`);
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Pengguna</h1><p className="label-mono mt-2">{data ? `${data.total} AKUN` : 'SEMUA AKUN TERDAFTAR'}</p></div>
      </div>
      <div className="dash-item card-light p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="field-label" htmlFor="user-search">Cari nama / email</label>
          <input id="user-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-line" placeholder="Mis. siti atau @umkm.test" />
        </div>
        <div>
          <label className="field-label" htmlFor="user-role">Peran</label>
          <select id="user-role" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))} className="input-line">
            {ROLES.map((r) => <option key={r || 'all'} value={r}>{r ? ROLE_LABELS[r] : 'Semua peran'}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="user-status">Status</label>
          <select id="user-status" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="input-line">
            {STATUSES.map((s) => <option key={s || 'all'} value={s}>{s || 'Semua status'}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="card-light p-7"><SkeletonLines count={6} /></div>}
      {data && items.length === 0 && <EmptyState title="Tidak ada pengguna yang cocok" description="Ubah kata kunci atau filter peran/status." />}
      {items.length > 0 && (
        <div className={`dash-item card-light p-7 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table-stack w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#12283c]/15">
                  {['NAMA', 'PERAN', 'BERGABUNG', 'REPUTASI', 'STATUS', ''].map((h, i) => <th key={i} className="py-3 pr-4 label-mono">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#12283c]/10">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-[#12283c]/5 transition-colors">
                    <td className="py-4 pr-4" data-label="Nama">
                      <p className="font-bold">{u.name}</p>
                      <p className="font-mono text-[10px] opacity-60 break-all">{u.email}</p>
                    </td>
                    <td className="py-4 pr-4" data-label="Peran"><span className="chip-mono">{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td className="py-4 pr-4 text-xs opacity-70 whitespace-nowrap" data-label="Bergabung">
                      {formatDate(u.created_at)}
                      <span className="block font-mono text-[9px] opacity-70">{u.last_login_at ? `MASUK ${timeAgo(u.last_login_at).toUpperCase()}` : 'BELUM PERNAH MASUK'}</span>
                    </td>
                    <td className="py-4 pr-4 font-mono text-xs" data-label="Reputasi">{u.role === 'talent' ? `${u.reputation_points ?? 0} · ${(TALENT_LEVEL[u.level] || '').toUpperCase()}` : '—'}</td>
                    <td className="py-4 pr-4" data-label="Status"><StatusChip status={statusChip(u.status)} /></td>
                    <td className="py-4 text-right">
                      {Number(u.id) === Number(currentUserId) ? (
                        <span className="font-mono text-[9px] opacity-50">AKUN ANDA</span>
                      ) : (
                        <button type="button" onClick={() => toggle(u)} disabled={busyId === u.id} className={`chip-mono min-h-[40px] transition-colors ${u.status === 'AKTIF' ? 'text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6]' : 'text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white'}`}>
                          {busyId === u.id ? '…' : u.status === 'AKTIF' ? 'TANGGUHKAN' : 'AKTIFKAN'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ key: filterKey, page: p })} />}
    </>
  );
}
