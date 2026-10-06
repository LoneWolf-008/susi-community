import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { NEED_CATEGORY, applicationStatus } from '../../../lib/statusMap';
import { timeAgo } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import { MatchBadge } from '../../../components/recommendation/MatchBits';
import TalentAiCard from './AiCard';

const PAGE_SIZE = 10;
const SECTORS = ['BARAT–UTARA', 'BARAT–SELATAN', 'TIMUR–UTARA', 'TIMUR–SELATAN'];
const NO_FILTERS = { category: '', sector: '', skill: '' };
const SORTS = [{ id: 'match', label: 'Paling cocok' }, { id: 'new', label: 'Terbaru' }];

function NeedCard({ need, onOpen }) {
  const applied = need.my_application_status;
  return (
    <article className="dash-item card-light relative p-6 pt-8 flex flex-col hover:-translate-y-1 hover:border-[#e62b2b] hover:shadow-[0_14px_35px_rgba(230,43,43,0.15)] transition-all">
      <span className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-[#e62b2b] border-2 border-[#12283c] rotate-45" />
      <div className="flex justify-between items-start gap-2 mb-3">
        <span className="chip-mono">{NEED_CATEGORY[need.category] || need.category}</span>
        <span className="font-mono text-[9px] opacity-50 text-right">{timeAgo(need.created_at).toUpperCase()} · {need.applicants} PELAMAR</span>
      </div>
      {(need.match || need.my_invite_status === 'SENT') && (
        <div className="flex flex-wrap gap-2 mb-2">
          {need.match && <MatchBadge score={need.match.score} />}
          {need.my_invite_status === 'SENT' && <span className="rounded-full bg-[#e62b2b] text-white px-3 py-1 font-mono text-[10px] font-black">✉ DIUNDANG</span>}
        </div>
      )}
      <h4 className="font-black text-lg leading-tight mb-1">{need.title}</h4>
      <p className="font-mono text-[10px] opacity-60 mb-2">{need.community_name || 'Tanpa komunitas'}{need.sector ? ` · ${need.sector}` : ''}</p>
      <p className="text-xs text-[#12283c]/60 leading-relaxed mb-4 line-clamp-3">{need.summary || need.description}</p>
      {need.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">{need.skills.slice(0, 4).map((s) => <span key={s.id} className="chip-mono text-[#12283c]">{s.name}</span>)}</div>
      )}
      <div className="mt-auto">
        {applied && <div className="mb-2"><StatusChip status={applicationStatus(applied)} /></div>}
        <button type="button" onClick={() => onOpen(need)} className={`btn-pill w-full !py-3 text-[10px] ${applied ? 'bg-[#c9ecd9] text-[#12283c]' : 'btn-navy'}`}>
          {applied ? '✓ Sudah melamar — lihat detail' : 'Lihat & ajukan diri →'}
        </button>
      </div>
    </article>
  );
}

/**
 * Katalog kebutuhan terbuka (GET /needs/catalog) dengan filter, pencarian, dan paginasi.
 * `version` dinaikkan shell untuk memuat ulang (mis. setelah melamar) tanpa mereset filter.
 * Kartu "Rekomendasi AI" paling atas (rekomendasi, tip keahlian, progres sertifikasi) dan urutan
 * bawaan "Paling cocok" untuk talenta berkeahlian (`sort=match`); tanpa keahlian → urutan terbaru.
 */
export default function CatalogTab({ first, stats, onOpen, onCompleteProfile, onOpenSettings, version = 0 }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState('match');
  const q = useDebouncedValue(search.trim(), 350);
  // Halaman kembali ke 1 setiap filter/pencarian/urutan berubah (diturunkan, tanpa effect).
  const filterKey = JSON.stringify([filters, q, sort]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const skillsQ = useApi((signal) => api.get('/skills', { signal }), []);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/needs/catalog', {
      signal, query: { page, limit: PAGE_SIZE, search: q, ...filters, sort: sort === 'match' ? 'match' : undefined },
    }),
    [page, filters, q, sort, version],
  );
  // Server hanya mengurutkan per kecocokan bila talenta punya keahlian.
  const matchUnavailable = sort === 'match' && data && data.sort !== 'match';
  const items = data?.items || [];
  const filtered = Boolean(q) || Object.values(filters).some(Boolean);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const reset = () => { setSearch(''); setFilters(NO_FILTERS); };

  // "Lihat semua" di kartu AI → daftar katalog, diurutkan "Paling cocok" tanpa filter.
  const seeAllMatches = () => {
    reset();
    setSort('match');
    document.getElementById('katalog-semua')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <TalentAiCard version={version} onOpen={onOpen} onCompleteProfile={onCompleteProfile} onOpenSettings={onOpenSettings} onSeeAll={seeAllMatches} />

      <div className="dash-item card-light p-8 md:p-10 mb-6">
        <p className="label-mono mb-2">Katalog Kebutuhan</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, {first}.</h1>
        <p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed mb-6">Baca dulu cerita masalah komunitas, lalu ajukan diri dengan pesan singkat. Komunitas memilih dari rekam jejak dan pesan Anda.</p>
        <label className="sr-only" htmlFor="catalog-search">Cari kebutuhan</label>
        <input id="catalog-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-line mb-4" placeholder="Cari judul atau cerita masalah…" />
        <div className="flex flex-wrap gap-2 mb-4">
          {[['', 'SEMUA'], ...Object.entries(NEED_CATEGORY)].map(([value, label]) => (
            <button type="button" key={value || 'all'} onClick={() => setFilter('category', value)} className={`chip-mono transition-colors ${filters.category === value ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{label.toUpperCase()}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="catalog-sector">Sektor kota</label>
            <select id="catalog-sector" value={filters.sector} onChange={(e) => setFilter('sector', e.target.value)} className="input-line">
              <option value="">Semua sektor</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="catalog-skill">Keahlian</label>
            <select id="catalog-skill" value={filters.skill} onChange={(e) => setFilter('skill', e.target.value)} className="input-line">
              <option value="">Semua keahlian</option>
              {(skillsQ.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
        {[
          { v: data && !filtered ? data.total : '—', l: 'KEBUTUHAN TERBUKA' },
          { v: stats.applications ?? '—', l: 'LAMARAN TERKIRIM' },
          { v: stats.completed ?? '—', l: 'PROYEK TERVERIFIKASI' },
        ].map((s) => (
          <div key={s.l} className="dash-item bg-[#fdfcf7] p-6 hover:bg-[#e62b2b] hover:text-white transition-colors">
            <div className="text-4xl md:text-5xl font-black tabular-nums">{s.v}</div>
            <p className="label-mono mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="dash-item flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 id="katalog-semua" className="text-2xl font-black tracking-tight scroll-mt-24">Semua kebutuhan terbuka</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Urutan katalog">
          {SORTS.map((s) => (
            <button type="button" key={s.id} role="radio" aria-checked={sort === s.id} onClick={() => setSort(s.id)} className={`rounded-full px-4 min-h-[44px] text-[11px] font-black uppercase tracking-wider transition-colors ${sort === s.id ? 'bg-[#12283c] text-[#f2efe6]' : 'border border-[#12283c]/20 hover:border-[#12283c]'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {matchUnavailable && <p className="dash-item font-mono text-[10px] opacity-70 mb-4">Urutan "Paling cocok" aktif setelah Anda menambahkan keahlian di Profil — sementara ditampilkan yang terbaru.</p>}

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState
          title={filtered ? 'Tidak ada kebutuhan yang cocok' : 'Belum ada kebutuhan terbuka'}
          description={filtered
            ? 'Coba kata kunci lain atau longgarkan filter sektor dan keahlian.'
            : 'Kebutuhan baru tampil di sini setelah lolos pemeriksaan admin. Lengkapi keahlian di Profil agar mudah dipilih komunitas.'}
          action={filtered && <button type="button" onClick={reset} className="btn-pill btn-navy">Hapus filter</button>}
        />
      )}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
        {items.map((n) => <NeedCard key={n.id} need={n} onOpen={onOpen} />)}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ key: filterKey, page: p })} />}
    </>
  );
}
