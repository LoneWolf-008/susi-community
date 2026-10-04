import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { geocode, sectorOf } from '../../../lib/geocode';
import { initialOf } from '../../../lib/format';
import GoogleMapsEmbed from '../../../components/common/GoogleMapsEmbed';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';

const TYPES = ['UMKM', 'PKK', 'RT/RW', 'KARANG TARUNA', 'PEMUDA', 'HOBI', 'KELUARGA', 'LAINNYA'];

function NewCommunityForm({ onCreated, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', type: 'UMKM', description: '', address: '' });
  const [coords, setCoords] = useState(null);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const search = async () => {
    if (!form.address.trim()) return;
    setSearching(true);
    setMessage('');
    try {
      const found = await geocode(form.address);
      setCoords(found ? { lat: found.lat, lng: found.lng } : null);
      setMessage(found ? 'Lokasi ditemukan. Periksa titik di peta.' : 'Alamat tidak ditemukan. Tambahkan nama jalan atau kelurahan.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSearching(false);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) { setMessage('GPS tidak didukung browser ini.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setMessage('Lokasi GPS ditemukan.'); },
      () => setMessage('Lokasi GPS tidak dapat diakses. Periksa izin lokasi atau cari alamat.'),
    );
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api.post('/communities', {
        name: form.name.trim(), type: form.type, description: form.description || null,
        address: form.address || null, lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      });
      toast.success('Komunitas didaftarkan. Anda tercatat sebagai pengurus.');
      onCreated(created);
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="dash-item card-light p-6 md:p-7 mb-6 space-y-4">
      <h3 className="text-xl font-black">Daftarkan komunitas</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="field-label" htmlFor="comm-name">Nama komunitas</label><input id="comm-name" value={form.name} onChange={set('name')} className="input-line" maxLength={150} placeholder="Mis. PKK RW 05 Sukajadi" required /></div>
        <div>
          <label className="field-label" htmlFor="comm-type">Jenis</label>
          <select id="comm-type" value={form.type} onChange={set('type')} className="input-line">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </div>
        <div className="md:col-span-2"><label className="field-label" htmlFor="comm-desc">Kegiatan singkat (opsional)</label><input id="comm-desc" value={form.description} onChange={set('description')} className="input-line" maxLength={2000} /></div>
      </div>
      <div>
        <label className="field-label" htmlFor="comm-addr">Alamat / titik kumpul</label>
        <div className="flex flex-wrap gap-3">
          <input id="comm-addr" value={form.address} onChange={(e) => { set('address')(e); setCoords(null); }} className="input-line flex-1 min-w-[220px]" maxLength={255} placeholder="Mis. Balai RW 05, Sukajadi" />
          <button type="button" onClick={search} disabled={searching || !form.address.trim()} className="btn-pill btn-navy !py-3 text-[10px]">{searching ? 'MENCARI…' : 'Cari →'}</button>
          <button type="button" onClick={useGps} className="btn-pill btn-ghost-dark !py-3 text-[10px]">GPS</button>
        </div>
        {message && <p role="status" className="font-mono text-[10px] mt-2">{message}{coords ? ` · ${sectorOf(coords)}` : ''}</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="submit" disabled={saving || !form.name.trim()} className="btn-pill btn-red !py-3 flex-1 text-xs disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan komunitas'}</button>
      </div>
    </form>
  );
}

/** `canJoin=false` untuk liaison: daftar & pendaftaran komunitas tanpa aksi gabung/keluar. */
export default function CommunitiesTab({ onOpenMading, canJoin = true }) {
  const toast = useToast();
  const [onlyMine, setOnlyMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [focus, setFocus] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/communities', { signal, query: { limit: 50, mine: onlyMine ? 'true' : undefined } }),
    [onlyMine],
  );
  const items = data?.items || [];
  const focused = focus && items.find((c) => c.id === focus);
  const point = focused && focused.lat != null ? { lat: Number(focused.lat), lng: Number(focused.lng) } : null;

  const toggleMembership = async (c) => {
    setBusyId(c.id);
    try {
      if (c.is_member) await api.delete(`/communities/${c.id}/leave`);
      else await api.post(`/communities/${c.id}/join`);
      toast.success(c.is_member ? `Keluar dari ${c.name}` : `Bergabung dengan ${c.name}`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Komunitas & Peta</h1>
          <p className="label-mono mt-2">{data ? `${data.total} KOMUNITAS ${onlyMine ? 'DIIKUTI' : 'TERDAFTAR'}` : 'MEMUAT…'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canJoin && <button type="button" onClick={() => setOnlyMine((v) => !v)} className={`btn-pill !py-3 text-[10px] ${onlyMine ? 'btn-navy' : 'btn-ghost-dark'}`}>{onlyMine ? 'Tampilkan semua' : 'Komunitasku'}</button>}
          <button type="button" onClick={() => setCreating((v) => !v)} className={`btn-pill !py-3 text-[10px] ${creating ? 'btn-navy' : 'btn-red'}`}>{creating ? '✕ Batal' : '+ Daftarkan Komunitas'}</button>
        </div>
      </div>

      {creating && <NewCommunityForm onCancel={() => setCreating(false)} onCreated={(c) => { setCreating(false); setFocus(c.id); refetch(); }} />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {loading && !data && <><SkeletonCard /><SkeletonCard /></>}
          {data && items.length === 0 && (
            <EmptyState
              title={onlyMine ? 'Belum bergabung dengan komunitas' : 'Belum ada komunitas'}
              description="Daftarkan komunitasmu agar kebutuhan yang diajukan tercatat atas nama komunitas dan tampil di peta."
              action={<button type="button" onClick={() => setCreating(true)} className="btn-pill btn-red">+ Daftarkan Komunitas</button>}
            />
          )}
          {items.map((c) => (
            <div key={c.id} className={`dash-item card-light p-4 flex items-center gap-3 transition-colors ${focus === c.id ? 'border-[#e62b2b]' : ''}`}>
              <button type="button" onClick={() => setFocus(c.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${c.is_member ? 'bg-[#c9ecd9] text-[#12283c]' : 'bg-[#e62b2b] text-white'}`}>{c.is_member ? '★' : initialOf(c.name)}</span>
                <span className="min-w-0">
                  <span className="block font-black text-sm truncate">{c.name}</span>
                  <span className="block font-mono text-[9px] opacity-60">{c.type} · {c.members_count} ANGGOTA{c.sector ? ` · ${c.sector}` : ''}</span>
                </span>
              </button>
              {canJoin && (
                <button type="button" onClick={() => toggleMembership(c)} disabled={busyId === c.id} className={`chip-mono shrink-0 ${c.is_member ? 'text-[#12283c]' : 'border-0 bg-[#12283c] text-[#f2efe6]'}`}>
                  {busyId === c.id ? '…' : c.is_member ? 'KELUAR' : 'GABUNG'}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="col-span-12 lg:col-span-7">
          <div className="dash-item relative h-[480px] md:h-[600px] rounded-xl border border-[#12283c]/15 overflow-hidden">
            <div className="absolute inset-0 z-0"><GoogleMapsEmbed lat={point?.lat} lng={point?.lng} query="Bandung, Indonesia" zoom={point ? 16 : 12} title="Peta komunitas" /></div>
            {focused && (
              <div className="absolute top-3 right-3 z-10 w-[290px] card-light p-5 shadow-xl">
                <button type="button" onClick={() => setFocus(null)} aria-label="Tutup" className="absolute top-2 right-2 w-7 h-7 rounded-full border border-[#12283c]/30 flex items-center justify-center text-sm font-black hover:bg-[#e62b2b] hover:text-white">×</button>
                <h3 className="text-xl font-black leading-tight mb-1 pr-6">{focused.name}</h3>
                <p className="font-mono text-[10px] opacity-60 mb-3">{focused.type} · {focused.source === 'AGENSUSI' ? 'DICATAT AGENSUSI' : 'MANDIRI'}</p>
                {focused.description && <p className="text-xs leading-relaxed mb-3">{focused.description}</p>}
                {focused.leader_name && <p className="text-xs mb-3"><strong>Pengurus:</strong> {focused.leader_name}{focused.leader_role ? ` (${focused.leader_role})` : ''}</p>}
                {point
                  ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`} target="_blank" rel="noreferrer" className="block font-mono text-[10px] font-bold text-[#e62b2b] underline mb-3">BUKA RUTE ↗</a>
                  : <p className="font-mono text-[10px] opacity-60 mb-3">LOKASI BELUM DITANDAI</p>}
                {onOpenMading && <button type="button" onClick={onOpenMading} className="btn-pill btn-navy w-full !py-3 text-[10px]">Ke Mading Komunitas →</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
