import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { formatDate, initialOf } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';

const PAGE_SIZE = 20;
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Kata sandi awal acak 14 karakter (crypto), ditampilkan sekali untuk diserahkan ke AgenSUSI. */
function randomPassword(length = 14) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('');
}

/** Buat akun liaison (POST /admin/liaisons). Liaison tidak bisa mendaftar sendiri (keputusan desain #2). */
function CreateLiaisonForm({ onCreated, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', target_visits_month: '30', target_intake_month: '25' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined, form: undefined })); };

  const save = async (e) => {
    e.preventDefault();
    if (form.password.length < 10) { setErrors({ password: 'Kata sandi minimal 10 karakter' }); return; }
    setSaving(true);
    try {
      const created = await api.post('/admin/liaisons', {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, password: form.password,
        target_visits_month: form.target_visits_month, target_intake_month: form.target_intake_month,
      });
      toast.success(`Akun AgenSUSI ${created.name} dibuat`);
      onCreated({ ...created, initialPassword: form.password });
    } catch (err) {
      setErrors({ form: err.message, ...Object.fromEntries((err.details || []).map((d) => [d.field, d.message])) });
      setSaving(false);
    }
  };
  const fieldError = (key) => errors[key] && <p className="mt-1 font-mono text-[10px] font-bold text-[#e62b2b]">{errors[key]}</p>;

  return (
    <form onSubmit={save} className="dash-item card-light p-6 md:p-7 mb-6 space-y-4" noValidate>
      <h3 className="text-xl font-black">Buat akun AgenSUSI</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="field-label" htmlFor="liaison-name">Nama</label><input id="liaison-name" value={form.name} onChange={set('name')} className="input-line" maxLength={120} required />{fieldError('name')}</div>
        <div><label className="field-label" htmlFor="liaison-email">Email</label><input id="liaison-email" type="email" value={form.email} onChange={set('email')} className="input-line" maxLength={150} required />{fieldError('email')}</div>
        <div><label className="field-label" htmlFor="liaison-phone">WhatsApp (opsional)</label><input id="liaison-phone" value={form.phone} onChange={set('phone')} className="input-line" maxLength={30} />{fieldError('phone')}</div>
        <div>
          <label className="field-label" htmlFor="liaison-password">Kata sandi awal</label>
          <div className="flex gap-2">
            <input id="liaison-password" value={form.password} onChange={set('password')} className="input-line font-mono" minLength={10} maxLength={72} autoComplete="new-password" required />
            <button type="button" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))} className="btn-pill btn-ghost-dark !py-2 !px-4 text-[9px] shrink-0">Acak</button>
          </div>
          {fieldError('password')}
        </div>
        <div><label className="field-label" htmlFor="liaison-tv">Target kunjungan / bulan</label><input id="liaison-tv" type="number" min={0} max={1000} value={form.target_visits_month} onChange={set('target_visits_month')} className="input-line" />{fieldError('target_visits_month')}</div>
        <div><label className="field-label" htmlFor="liaison-ti">Target kebutuhan dicatat / bulan</label><input id="liaison-ti" type="number" min={0} max={1000} value={form.target_intake_month} onChange={set('target_intake_month')} className="input-line" />{fieldError('target_intake_month')}</div>
      </div>
      {errors.form && <p role="alert" className="rounded-lg bg-[#e62b2b] text-white p-3 text-xs font-bold">⚠ {errors.form}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>
        <button type="submit" disabled={saving || !form.name.trim() || !form.email.trim()} className="btn-pill btn-red !py-3 flex-1 text-xs disabled:opacity-50">{saving ? 'Membuat…' : 'Buat akun'}</button>
      </div>
    </form>
  );
}

/** Daftar AgenSUSI (GET /admin/liaisons) + buat akun + tangguhkan/aktifkan. */
export default function LiaisonTab({ onChanged }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, refetch } = useApi((signal) => api.get('/admin/liaisons', { signal, query: { page, limit: PAGE_SIZE } }), [page]);
  const items = data?.items || [];

  const toggle = async (l) => {
    const next = l.status === 'AKTIF' ? 'DITANGGUHKAN' : 'AKTIF';
    setBusyId(l.id);
    try {
      await api.patch(`/admin/liaisons/${l.id}/status`, { status: next });
      toast.success(`${l.name} ${next === 'AKTIF' ? 'diaktifkan' : 'ditangguhkan'}`);
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
        <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">AgenSUSI</h1><p className="label-mono mt-2">{data ? `${data.total} AGEN TERDAFTAR` : 'PETUGAS LAPANGAN'}</p></div>
        <button type="button" onClick={() => { setCreating((v) => !v); setJustCreated(null); }} className={`btn-pill !py-3 text-[10px] ${creating ? 'btn-navy' : 'btn-red'}`}>{creating ? '✕ Batal' : '+ Buat akun AgenSUSI'}</button>
      </div>

      {creating && (
        <CreateLiaisonForm onCancel={() => setCreating(false)} onCreated={(l) => { setCreating(false); setJustCreated(l); refetch(); onChanged(); }} />
      )}
      {justCreated && (
        <div role="status" className="dash-item rounded-xl bg-[#c9ecd9] text-[#12283c] p-6 mb-6">
          <p className="font-black mb-1">Akun {justCreated.name} siap dipakai.</p>
          <p className="text-sm">Serahkan langsung (bukan lewat grup): email <strong className="font-mono">{justCreated.email}</strong> · kata sandi awal <strong className="font-mono">{justCreated.initialPassword}</strong>. Kata sandi ini tidak ditampilkan lagi.</p>
          <button type="button" onClick={() => setJustCreated(null)} className="chip-mono mt-3 text-[#12283c]">SUDAH DISERAHKAN ✓</button>
        </div>
      )}

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState title="Belum ada AgenSUSI" description="Buat akun untuk petugas lapangan. Mereka tidak bisa mendaftar sendiri." action={<button type="button" onClick={() => setCreating(true)} className="btn-pill btn-red">+ Buat akun AgenSUSI</button>} />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((l) => (
          <article key={l.id} className={`dash-item card-light p-6 ${l.status !== 'AKTIF' ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-12 h-12 rounded-full bg-[#e62b2b] text-white flex items-center justify-center text-lg font-black shrink-0">{initialOf(l.name)}</span>
                <div className="min-w-0">
                  <p className="font-black truncate">{l.name}</p>
                  <p className="font-mono text-[10px] opacity-60 truncate">{l.email}{l.phone ? ` · ${l.phone}` : ''}</p>
                </div>
              </div>
              <StatusChip status={{ label: l.status, tone: l.status === 'AKTIF' ? 'success' : 'danger' }} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl border border-[#12283c]/15 p-3"><p className="label-mono">KUNJUNGAN</p><p className="text-lg font-black">{l.total_visits}</p><p className="font-mono text-[9px] opacity-50">TARGET {l.target_visits_month}/BLN</p></div>
              <div className="rounded-xl border border-[#12283c]/15 p-3"><p className="label-mono">TERDATA</p><p className="text-lg font-black">{l.total_assisted}</p><p className="font-mono text-[9px] opacity-50">TARGET INTAKE {l.target_intake_month}/BLN</p></div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[9px] opacity-50">SEJAK {formatDate(l.created_at)}</span>
              <button type="button" onClick={() => toggle(l)} disabled={busyId === l.id} className={`chip-mono transition-colors ${l.status === 'AKTIF' ? 'text-[#12283c] hover:bg-[#e62b2b] hover:text-white' : 'bg-[#c9ecd9] text-[#12283c] border-0'}`}>
                {busyId === l.id ? '…' : l.status === 'AKTIF' ? 'TANGGUHKAN' : 'AKTIFKAN'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={setPage} />}
    </>
  );
}
