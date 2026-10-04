import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import { disputeStatus } from '../../lib/statusMap';
import { formatDateTime } from '../../lib/format';
import StatusChip from '../common/StatusChip';
import { SkeletonLines } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';

/** Form membuka sengketa (pihak proyek). POST /projects/:id/dispute */
export function OpenDisputeForm({ projectId, onOpened, onCancel }) {
  const toast = useToast();
  const [summary, setSummary] = useState('');
  const [statement, setStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/dispute`, { summary: summary.trim(), statement: statement.trim() || undefined });
      toast.success('Sengketa dibuka. Admin SUSI akan memediasi.');
      onOpened();
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-[#12283c]/70 leading-relaxed">
        Gunakan bila kesepakatan tidak bisa diselesaikan berdua. Admin akan membaca pernyataan kedua pihak lalu memutuskan.
      </p>
      <div>
        <label className="field-label" htmlFor="dispute-summary">Ringkasan masalah</label>
        <input id="dispute-summary" value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 1000))} className="input-line" placeholder="Mis. Hasil belum sesuai definisi selesai" required />
      </div>
      <div>
        <label className="field-label" htmlFor="dispute-statement">Pernyataan Anda (opsional)</label>
        <textarea id="dispute-statement" value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 2000))} className="input-line h-24 resize-none" placeholder="Ceritakan kronologinya." />
      </div>
      <div className="flex gap-3">
        {onCancel && <button type="button" onClick={onCancel} className="btn-pill btn-ghost-dark !py-3 flex-1 text-xs">Batal</button>}
        <button type="submit" disabled={!summary.trim() || submitting} className="btn-pill btn-navy !py-3 flex-1 text-xs disabled:opacity-50">{submitting ? 'Mengirim…' : 'Buka Sengketa'}</button>
      </div>
    </form>
  );
}

/** Status sengketa yang berjalan + pernyataan + pesan admin. `side`: 'talent' | 'community'. */
export default function DisputePanel({ projectId, side, onChanged }) {
  const toast = useToast();
  const { data: dispute, loading, error, refetch } = useApi((signal) => api.get(`/projects/${projectId}/dispute`, { signal }), [projectId]);
  const [statement, setStatement] = useState('');
  const [saving, setSaving] = useState(false);
  const mine = side === 'talent' ? dispute?.statement_talent : dispute?.statement_community;
  const theirs = side === 'talent' ? dispute?.statement_community : dispute?.statement_talent;

  const save = async () => {
    if (!statement.trim()) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/dispute/statement`, { statement: statement.trim() });
      toast.success('Pernyataan tersimpan');
      setStatement('');
      refetch();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState error={error} onRetry={refetch} compact />;
  if (loading && !dispute) return <SkeletonLines count={4} />;
  if (!dispute) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusChip status={disputeStatus(dispute.status)} />
        <span className="font-mono text-[10px] opacity-60">DIBUKA {formatDateTime(dispute.opened_at).toUpperCase()}</span>
      </div>
      <p className="text-sm font-bold">{dispute.summary}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#12283c]/5 p-4">
          <p className="label-mono mb-2">PERNYATAAN ANDA</p>
          <p className="text-sm whitespace-pre-line">{mine || '— belum diisi —'}</p>
        </div>
        <div className="rounded-xl bg-[#12283c]/5 p-4">
          <p className="label-mono mb-2">PERNYATAAN PIHAK LAIN</p>
          <p className="text-sm whitespace-pre-line">{theirs || '— belum diisi —'}</p>
        </div>
      </div>
      {dispute.messages.length > 0 && (
        <div>
          <p className="label-mono mb-2">PESAN ADMIN</p>
          <ul className="space-y-2">
            {dispute.messages.map((m) => (
              <li key={m.id} className="rounded-lg bg-[#12283c] text-[#f2efe6] p-3 text-sm">
                {m.body}
                <span className="block font-mono text-[9px] opacity-60 mt-1">{m.sender_name} · {formatDateTime(m.sent_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dispute.status !== 'SELESAI' ? (
        <div>
          <label className="field-label" htmlFor="dispute-own">{mine ? 'Perbarui pernyataan Anda' : 'Isi pernyataan Anda'}</label>
          <textarea id="dispute-own" value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 2000))} className="input-line h-24 resize-none" placeholder="Jelaskan sudut pandang Anda untuk mediasi." />
          <button type="button" onClick={save} disabled={!statement.trim() || saving} className="btn-pill btn-navy !py-3 w-full mt-3 text-xs disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan Pernyataan'}</button>
        </div>
      ) : (
        <p className="rounded-xl bg-[#c9ecd9] p-4 font-mono text-[10px] font-bold">
          ✓ DIPUTUS ADMIN: {dispute.decision === 'MARK_COMPLETE' ? 'PROYEK DINYATAKAN SELESAI' : 'TENGGAT DIPERPANJANG 7 HARI'}
        </p>
      )}
    </div>
  );
}
