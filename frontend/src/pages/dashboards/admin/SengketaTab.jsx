import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { disputeStatus, projectStatus } from '../../../lib/statusMap';
import { formatDate, formatDateTime } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import Modal from '../../../components/modals/Modal';
import { SkeletonCard, SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import { DISPUTE_DECISION, daysSince } from './labels';

const PAGE_SIZE = 15;
const FILTERS = ['', 'MEDIASI', 'ESKALASI', 'SELESAI'];
const QUICK_MESSAGES = [
  'Mohon tanggapan kedua pihak dalam 3 hari kerja.',
  'Lampirkan bukti pendukung (tangkapan layar atau tautan hasil).',
  'Admin akan memutus berdasarkan definisi selesai yang disepakati.',
];
const parties = (d) => `${d.community_name || d.requester_name || 'Komunitas'} × ${d.talent_name || 'Talenta'}`;

function ResolveModal({ dispute, onClose, onResolved }) {
  const toast = useToast();
  const [decision, setDecision] = useState('');
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/disputes/${dispute.id}/resolve`, { decision, statement_admin: statement.trim() || null });
      toast.success(decision === 'MARK_COMPLETE' ? 'Sengketa diputus: proyek selesai' : 'Sengketa diputus: tenggat diperpanjang 7 hari');
      onResolved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={dispute.project_title} eyebrow="KEPUTUSAN ADMIN" onClose={onClose} busy={busy} size="max-w-lg">
      <p className="font-mono text-[10px] opacity-60 mb-5">{parties(dispute)}</p>
      <div className="space-y-3" role="radiogroup" aria-label="Keputusan">
        {[
          ['MARK_COMPLETE', 'Tandai proyek selesai', 'Talenta mendapat +1 reputasi. Pilih bila hasil memenuhi definisi selesai.'],
          ['EXTEND_7_DAYS', 'Perpanjang tenggat 7 hari', 'Proyek kembali dikerjakan; talenta perlu mengirim hasil lagi.'],
        ].map(([value, title, sub]) => (
          <button type="button" key={value} role="radio" aria-checked={decision === value} onClick={() => setDecision(value)} className={`w-full rounded-xl border p-4 text-left transition-colors ${decision === value ? 'border-[#e62b2b] bg-[#e62b2b]/15' : 'border-white/15 hover:bg-white/5'}`}>
            <p className="font-mono text-[10px] font-black uppercase tracking-widest">{decision === value ? '● ' : '○ '}{title}</p>
            <p className="text-[11px] opacity-70 mt-1">{sub}</p>
          </button>
        ))}
      </div>
      <label className="field-label mt-5" htmlFor="resolve-statement">Catatan keputusan (opsional, tercatat di riwayat)</label>
      <textarea id="resolve-statement" value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 1000))} className="input-line input-line-dark h-20 resize-none" />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button type="button" onClick={onClose} disabled={busy} className="btn-pill btn-ghost-light">Batal</button>
        <button type="button" onClick={submit} disabled={!decision || busy} className="btn-pill btn-red disabled:opacity-40">{busy ? 'Memproses…' : 'Putuskan →'}</button>
      </div>
    </Modal>
  );
}

function DisputeDetail({ id, onChanged }) {
  const toast = useToast();
  const { data: d, loading, error, refetch } = useApi((signal) => api.get(`/admin/disputes/${id}`, { signal }), [id]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await api.post(`/admin/disputes/${id}/messages`, { body: message.trim() });
      toast.success('Pesan terkirim ke kedua pihak');
      setMessage('');
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (error) return <ErrorState error={error} onRetry={refetch} compact />;
  if (loading && !d) return <SkeletonLines count={6} />;
  const open = d.status !== 'SELESAI';

  return (
    <div className="space-y-4 mt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#12283c]/15 p-4">
          <p className="label-mono !text-[#e62b2b] !opacity-100 mb-2">PERNYATAAN KOMUNITAS</p>
          <p className="text-xs leading-relaxed whitespace-pre-line">{d.statement_community || '— belum diisi —'}</p>
        </div>
        <div className="rounded-xl border border-[#12283c]/15 p-4">
          <p className="label-mono !text-[#e62b2b] !opacity-100 mb-2">PERNYATAAN TALENTA</p>
          <p className="text-xs leading-relaxed whitespace-pre-line">{d.statement_talent || '— belum diisi —'}</p>
        </div>
      </div>
      <div className="rounded-xl bg-[#12283c]/5 p-4 text-xs leading-relaxed">
        <p className="label-mono mb-2">KESEPAKATAN AWAL · PROYEK <StatusChip status={projectStatus(d.project_status)} /></p>
        <p><strong>Lingkup:</strong> {d.scope}</p>
        <p className="mt-1"><strong>Definisi selesai:</strong> {d.done_definition || '—'}</p>
        <p className="mt-1"><strong>Tenggat:</strong> {d.deadline ? formatDate(d.deadline) : '—'}</p>
      </div>
      <div className="rounded-xl border border-[#12283c]/15 p-4">
        <p className="label-mono mb-3">RIWAYAT</p>
        <ol>
          <li className="relative pl-8 pb-4 border-l-2 border-[#12283c]/10">
            <span className="absolute left-[-7px] top-0 w-3.5 h-3.5 rotate-45 border-2 border-[#12283c] bg-[#fdfcf7]" />
            <p className="text-xs"><span className="font-mono text-[10px] font-bold mr-2">{formatDateTime(d.opened_at)}</span>Sengketa dibuka: {d.summary}</p>
          </li>
          {d.events.map((ev, i) => (
            <li key={ev.id} className="relative pl-8 pb-4 last:pb-0 border-l-2 border-[#12283c]/10 last:border-transparent">
              <span className={`absolute left-[-7px] top-0 w-3.5 h-3.5 rotate-45 border-2 border-[#12283c] ${i === d.events.length - 1 ? 'bg-[#e62b2b]' : 'bg-[#fdfcf7]'}`} />
              <p className="text-xs"><span className="font-mono text-[10px] font-bold mr-2">{formatDateTime(ev.created_at)}</span>{ev.label}</p>
            </li>
          ))}
        </ol>
      </div>
      {d.messages.length > 0 && (
        <div>
          <p className="label-mono mb-2">PESAN ADMIN</p>
          <ul className="space-y-2">
            {d.messages.map((m) => (
              <li key={m.id} className="rounded-lg bg-[#12283c] text-[#f2efe6] p-3 text-sm">{m.body}<span className="block font-mono text-[9px] opacity-60 mt-1">{m.sender_name} · {formatDateTime(m.sent_at)}</span></li>
            ))}
          </ul>
        </div>
      )}
      {open ? (
        <>
          <div className="rounded-xl border border-[#12283c]/15 p-4">
            <label className="field-label" htmlFor={`dispute-msg-${id}`}>Pesan resmi ke kedua pihak</label>
            <textarea id={`dispute-msg-${id}`} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} className="input-line h-20 resize-none" placeholder="Tulis pesan resmi…" />
            <div className="flex flex-wrap gap-2 mt-2">
              {QUICK_MESSAGES.map((q) => <button type="button" key={q} onClick={() => setMessage(q)} className="chip-mono text-[#12283c]">+ {q}</button>)}
            </div>
            <button type="button" onClick={send} disabled={!message.trim() || sending} className="btn-pill btn-navy w-full !py-3 mt-3 text-[10px] disabled:opacity-40">{sending ? 'Mengirim…' : '✉ Kirim pesan'}</button>
          </div>
          <button type="button" onClick={() => setResolving(true)} className="btn-pill btn-red w-full">Putuskan sengketa →</button>
        </>
      ) : (
        <p className="rounded-xl bg-[#c9ecd9] p-4 font-mono text-[10px] font-bold">✓ {DISPUTE_DECISION[d.decision]?.toUpperCase()} · {formatDateTime(d.decided_at)}</p>
      )}
      {resolving && <ResolveModal dispute={d} onClose={() => setResolving(false)} onResolved={() => { setResolving(false); refetch(); onChanged(); }} />}
    </div>
  );
}

/** Mediasi sengketa (GET /admin/disputes, detail, pesan, resolve). */
export default function SengketaTab({ statsQ, onChanged }) {
  const [status, setStatus] = useState('');
  const [paging, setPaging] = useState({ status: '', page: 1 });
  const page = paging.status === status ? paging.page : 1;
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/admin/disputes', { signal, query: { status, page, limit: PAGE_SIZE } }),
    [status, page],
  );
  const items = data?.items || [];
  const changed = () => { refetch(); onChanged(); };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Sengketa</h1>
          <p className="label-mono mt-2">{statsQ.data ? `${statsQ.data.disputes_open} BELUM DIPUTUS` : 'MEDIASI ANTARA KOMUNITAS & TALENTA'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((s) => (
            <button type="button" key={s || 'all'} onClick={() => setStatus(s)} className={`chip-mono transition-colors ${status === s ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{s || 'SEMUA'}</button>
          ))}
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState icon="✓" title="Tidak ada sengketa" description="Sengketa muncul saat komunitas atau talenta mengajukannya dari detail proyek." />
      )}
      <div className="space-y-4">
        {items.map((d) => {
          const open = openId === d.id;
          return (
            <article key={d.id} className={`dash-item card-light p-6 transition-all ${open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''} ${d.status === 'SELESAI' && !open ? 'opacity-70' : ''}`}>
              <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
                <div className="min-w-0">
                  <h4 className="font-black text-lg leading-tight">{d.project_title}</h4>
                  <p className="label-mono mt-1">{parties(d)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={disputeStatus(d.status)} />
                  <button type="button" onClick={() => setOpenId(open ? null : d.id)} aria-expanded={open} className="chip-mono text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors">{open ? 'TUTUP ▴' : 'DETAIL ▾'}</button>
                </div>
              </div>
              <p className="text-sm text-[#12283c]/70 leading-relaxed">{d.summary}</p>
              <p className="font-mono text-[10px] opacity-50 mt-2">
                DIBUKA {formatDate(d.opened_at)}{d.status !== 'SELESAI' ? ` · ${daysSince(d.opened_at)} HARI` : ` · DIPUTUS ${d.decided_by_name || ''}`}
              </p>
              {open && <DisputeDetail id={d.id} onChanged={changed} />}
            </article>
          );
        })}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ status, page: p })} />}
    </>
  );
}
