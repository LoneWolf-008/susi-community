import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { visitStatus } from '../../../lib/statusMap';
import { formatDate } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import GoogleMapsEmbed from '../../../components/common/GoogleMapsEmbed';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import VisitForm from './VisitForm';
import { routeUrl, timeLabel, visitName, visitPoint } from './visits';

const PAGE_SIZE = 20;
const FILTERS = ['', 'DIRENCANAKAN', 'BERLANGSUNG', 'TERDATA'];

/** Selesaikan kunjungan tanpa kebutuhan baru (mis. komunitas belum punya masalah digital). */
function FinishForm({ visit, onDone, onCancel }) {
  const toast = useToast();
  const [note, setNote] = useState(visit.note || '');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/liaison/visits/${visit.id}/finish`, { note: note.trim() || null });
      toast.success('Kunjungan selesai dan terdata');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-[#12283c]/5 p-4">
      <label className="field-label" htmlFor={`finish-note-${visit.id}`}>Catatan hasil kunjungan</label>
      <textarea id={`finish-note-${visit.id}`} value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} className="input-line h-20 resize-none" placeholder="Mis. Belum ada kebutuhan digital; minta dihubungi lagi bulan depan." />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-2.5 flex-1 text-[10px]">Batal</button>
        <button type="submit" disabled={saving} className="btn-pill btn-navy !py-2.5 flex-1 text-[10px]">{saving ? '…' : 'Tandai terdata'}</button>
      </div>
    </form>
  );
}

/** Kartu kunjungan + aksi sesuai status (dipakai juga di agenda beranda). */
export function VisitCard({ visit: v, onRecord, onEdit, onChanged, onFocus, focused }) {
  const toast = useToast();
  const [finishing, setFinishing] = useState(false);
  const [starting, setStarting] = useState(false);
  const route = routeUrl(v);

  const start = async () => {
    setStarting(true);
    try {
      await api.post(`/liaison/visits/${v.id}/start`);
      toast.success(`Kunjungan ke ${visitName(v)} dimulai`);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <article className={`dash-item card-light p-6 transition-colors ${focused ? 'border-[#e62b2b]' : ''}`}>
      <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
        <button type="button" onClick={onFocus} disabled={!onFocus} className="text-left min-w-0">
          <h4 className="font-black text-lg leading-tight">{visitName(v)}</h4>
          <p className="font-mono text-[10px] opacity-50 mt-1">{formatDate(v.scheduled_date)} · {timeLabel(v.scheduled_time)}{v.address ? ` · 📍 ${v.address}` : ''}</p>
        </button>
        <StatusChip status={visitStatus(v.status)} />
      </div>
      {v.contact_person && <p className="text-xs mb-1"><strong>Narahubung:</strong> {v.contact_person}</p>}
      {v.note && <p className="text-xs text-[#12283c]/60 mb-2">{v.note}</p>}
      {v.status === 'TERDATA' && (
        <p className="font-mono text-[10px] font-bold mb-2">✓ TERDATA {formatDate(v.finished_at)}{v.need_title ? ` · KEBUTUHAN: ${v.need_title.toUpperCase()}` : ' · TANPA KEBUTUHAN BARU'}</p>
      )}
      <div className="flex gap-2 flex-wrap mt-3">
        {v.status === 'DIRENCANAKAN' && (
          <>
            <button type="button" onClick={start} disabled={starting} className="flex-1 btn-pill btn-navy !py-2.5 text-[10px] disabled:opacity-60">{starting ? '…' : 'Mulai kunjungan →'}</button>
            {onEdit && <button type="button" onClick={() => onEdit(v)} className="btn-pill btn-ghost-dark !py-2.5 text-[10px]">Ubah</button>}
          </>
        )}
        {v.status === 'BERLANGSUNG' && !finishing && (
          <>
            <button type="button" onClick={() => onRecord(v)} className="flex-1 btn-pill bg-[#c9ecd9] text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] !py-2.5 text-[10px]">Catat kebutuhan →</button>
            <button type="button" onClick={() => setFinishing(true)} className="btn-pill btn-ghost-dark !py-2.5 text-[10px]">Selesai tanpa kebutuhan</button>
          </>
        )}
        {route && <a href={route} target="_blank" rel="noreferrer" className="btn-pill btn-ghost-dark !py-2.5 text-[10px]">🧭 Rute ↗</a>}
      </div>
      {finishing && <FinishForm visit={v} onCancel={() => setFinishing(false)} onDone={() => { setFinishing(false); onChanged(); }} />}
    </article>
  );
}

/** Daftar kunjungan (GET /liaison/visits) dengan filter status, jadwal baru, ubah, mulai, selesai. */
export default function VisitsTab({ onRecord, onChanged }) {
  const [status, setStatus] = useState('');
  const [paging, setPaging] = useState({ status: '', page: 1 });
  const page = paging.status === status ? paging.page : 1;
  const [form, setForm] = useState(null); // null | 'new' | visit
  const [focusId, setFocusId] = useState(null);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/liaison/visits', { signal, query: { status, page, limit: PAGE_SIZE } }),
    [status, page],
  );
  const items = data?.items || [];
  const focused = items.find((v) => v.id === focusId) || items.find((v) => visitPoint(v));
  const point = visitPoint(focused);
  const changed = () => { refetch(); onChanged?.(); };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Kunjungan</h1>
          <p className="label-mono mt-2">{data ? `${data.total} KUNJUNGAN${status ? ` ${status}` : ''}` : 'JADWAL & HASIL KUNJUNGAN LAPANGAN'}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {FILTERS.map((s) => (
            <button type="button" key={s || 'all'} onClick={() => setStatus(s)} className={`chip-mono transition-colors ${status === s ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s || 'SEMUA'}</button>
          ))}
          <button type="button" onClick={() => setForm(form ? null : 'new')} className={`btn-pill !py-3 text-[10px] ${form ? 'btn-navy' : 'btn-red'}`}>{form ? '✕ Tutup form' : '+ Jadwalkan kunjungan'}</button>
        </div>
      </div>

      {form && (
        <VisitForm
          key={form === 'new' ? 'new' : form.id}
          visit={form === 'new' ? null : form}
          onCancel={() => setForm(null)}
          onSaved={(saved) => { setForm(null); setFocusId(saved?.id ?? null); changed(); }}
        />
      )}
      {error && <ErrorState error={error} onRetry={refetch} />}

      <div className="grid grid-cols-12 gap-6">
        {/* Diredupkan saat filter/halaman baru dimuat, agar daftar lama tidak terbaca sebagai hasil filter. */}
        <div className={`col-span-12 lg:col-span-7 space-y-4 transition-opacity ${loading && data ? 'opacity-50' : ''}`} aria-busy={loading}>
          {loading && !data && !error && <><SkeletonCard /><SkeletonCard /></>}
          {data && items.length === 0 && (
            <EmptyState
              title={status ? `Tidak ada kunjungan ${status.toLowerCase()}` : 'Belum ada kunjungan'}
              description="Jadwalkan kunjungan ke komunitas. Saat di lokasi, mulai kunjungan lalu catat kebutuhan mereka langsung dari sini."
              action={<button type="button" onClick={() => setForm('new')} className="btn-pill btn-red">+ Jadwalkan kunjungan</button>}
            />
          )}
          {items.map((v) => (
            <VisitCard
              key={v.id}
              visit={v}
              focused={focused?.id === v.id}
              onFocus={() => setFocusId(v.id)}
              onRecord={onRecord}
              onEdit={(visit) => setForm(visit)}
              onChanged={changed}
            />
          ))}
          {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ status, page: p })} />}
        </div>
        <div className="col-span-12 lg:col-span-5">
          <div className="dash-item lg:sticky lg:top-24 relative h-[420px] rounded-xl border border-[#12283c]/15 overflow-hidden">
            <div className="absolute inset-0 z-0">
              <GoogleMapsEmbed lat={point?.lat} lng={point?.lng} query="Bandung, Indonesia" zoom={point ? 16 : 12} title={focused ? `Peta ${visitName(focused)}` : 'Peta kunjungan'} />
            </div>
            {focused && (
              <p className="absolute bottom-3 left-3 right-3 z-10 card-light px-4 py-3 font-mono text-[10px] font-bold">
                {visitName(focused)}{focused.sector ? ` · ${focused.sector}` : ''}{point ? '' : ' · LOKASI BELUM DITANDAI'}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
