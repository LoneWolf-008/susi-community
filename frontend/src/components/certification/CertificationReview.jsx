import { useState } from 'react';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/toastContext';
import { TALENT_LEVEL } from '../../lib/statusMap';
import { CERT_REQUEST_STATUS, certificatePath, verificationPath } from '../../lib/certification';
import { formatDate, formatDateTime, timeAgo } from '../../lib/format';
import StatusChip from '../common/StatusChip';
import { SkeletonCard } from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import Pagination from '../ui/Pagination';

// Tinjauan sertifikasi talenta (U5) untuk admin & AgenSUSI: bukti proyek (komunitas, testimoni, hasil),
// setujui/tolak dengan catatan; admin juga bisa mencabut sertifikat yang sudah terbit.

const PAGE_SIZE = 10;
const FILTERS = [
  ['PENDING', 'MENUNGGU', 'pending'],
  ['APPROVED', 'DISETUJUI', 'approved'],
  ['REJECTED', 'DITOLAK', 'rejected'],
  ['all', 'SEMUA', null],
];

function Evidence({ projects }) {
  return (
    <ol className="space-y-3">
      {projects.map((p, i) => (
        <li key={p.id} className="rounded-xl border border-[#12283c]/15 p-4">
          <p className="font-mono text-[9px] opacity-50">BUKTI {i + 1}</p>
          <p className="font-black text-sm leading-snug break-words">{p.title}</p>
          <p className="font-mono text-[10px] opacity-60">{p.community_name || '—'} · DIVERIFIKASI KOMUNITAS {formatDate(p.verified_at)}</p>
          {p.testimonial && (
            <blockquote className="mt-2 text-sm italic leading-relaxed border-l-4 border-[#c9ecd9] pl-3">
              “{p.testimonial.text}” <span className="not-italic font-mono text-[10px] opacity-60">— {p.testimonial.from_name}</span>
            </blockquote>
          )}
          {p.delivery?.link_url && (
            <a href={p.delivery.link_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] underline text-[#e62b2b] break-all">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Hasil kerja
            </a>
          )}
          {!p.delivery?.link_url && p.delivery?.file_name && <p className="mt-2 font-mono text-[10px] opacity-70">BERKAS HASIL: {p.delivery.file_name}</p>}
        </li>
      ))}
    </ol>
  );
}

function RevokeForm({ item, onDone, onCancel }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/certifications/${item.id}/revoke`, { reason: reason.trim() });
      toast.success(`Sertifikat ${item.certificate.code} dicabut`);
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border-2 border-[#e62b2b] p-4 space-y-3">
      <label className="label-mono !text-[#e62b2b] !opacity-100 block" htmlFor={`revoke-${item.id}`}>ALASAN PENCABUTAN (DIKIRIM KE TALENTA)</label>
      <textarea id={`revoke-${item.id}`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={2} className="input-line !text-base sm:!text-sm resize-none" placeholder="Mis. bukti proyek ternyata tidak sesuai." />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-pill btn-ghost-dark min-h-[44px] !py-2 text-[10px]">Batal</button>
        <button type="button" onClick={submit} disabled={busy || reason.trim().length < 5} className="btn-pill btn-red min-h-[44px] !py-2 text-[10px] disabled:opacity-40">{busy ? '…' : 'Cabut sertifikat'}</button>
      </div>
    </div>
  );
}

function RequestItem({ item, open, onToggle, onDone, canRevoke }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const t = item.talent;
  const cert = item.certificate;

  const decide = async (decision) => {
    setBusy(true);
    try {
      const res = await api.patch(`/admin/certifications/${item.id}`, { decision, note: note.trim() || undefined });
      toast.success(decision === 'APPROVED' ? `Sertifikat terbit: ${res.code}` : 'Pengajuan ditolak, talenta mendapat catatan Anda');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <article className={`dash-item card-light transition-all ${open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full p-5 md:p-6 text-left flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusChip status={CERT_REQUEST_STATUS[item.status]} />
            {cert && <StatusChip status={cert.status === 'VALID' ? { label: 'SERTIFIKAT BERLAKU', tone: 'success' } : { label: 'DICABUT', tone: 'muted' }} />}
            <span className="font-mono text-[9px] opacity-50">{timeAgo(item.created_at).toUpperCase()}</span>
          </div>
          <h4 className="font-black text-lg leading-tight break-words">{t.name} · {item.focus_label}</h4>
          <p className="label-mono mt-1">{(TALENT_LEVEL[t.level] || t.level).toUpperCase()} · {t.completed_projects} PROYEK SELESAI · {item.projects.length} BUKTI</p>
        </div>
        <span className={`text-[10px] font-black shrink-0 transition-transform ${open ? 'rotate-90 text-[#e62b2b]' : ''}`} aria-hidden="true">→</span>
      </button>
      {open && (
        <div className="px-5 md:px-6 pb-6 space-y-4">
          <div className="rounded-xl bg-[#12283c]/5 p-4">
            <p className="label-mono mb-2">ALASAN PENGAJUAN</p>
            <p className="text-sm leading-relaxed whitespace-pre-line break-words">{item.pitch}</p>
            {t.skills.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{t.skills.map((s) => <span key={s} className="chip-mono !text-[9px]">{s}</span>)}</div>}
          </div>
          <div>
            <p className="label-mono mb-2">BUKTI PROYEK</p>
            <Evidence projects={item.projects} />
          </div>

          {item.status === 'PENDING' ? (
            <div className="space-y-3">
              <div>
                <label className="field-label" htmlFor={`cert-note-${item.id}`}>Catatan untuk talenta (wajib saat menolak)</label>
                <textarea id={`cert-note-${item.id}`} value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2} className="input-line !text-base sm:!text-sm resize-none" placeholder="Mis. bukti sudah lengkap, atau apa yang perlu dilengkapi." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => decide('REJECTED')} disabled={busy || note.trim().length === 0} className="btn-pill btn-ghost-dark min-h-[44px] hover:!bg-[#e62b2b] hover:!text-white hover:!border-[#e62b2b] disabled:opacity-40">Tolak</button>
                <button type="button" onClick={() => decide('APPROVED')} disabled={busy} className="btn-pill min-h-[44px] bg-[#c9ecd9] text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] disabled:opacity-40">{busy ? '…' : '✓ Setujui & terbitkan'}</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#12283c]/5 p-4 space-y-2">
              <p className="font-mono text-[10px] font-bold">
                {item.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'} OLEH {item.reviewer?.name?.toUpperCase() || '—'} · {formatDateTime(item.reviewed_at)}
              </p>
              {item.review_note && <p className="text-sm">{item.review_note}</p>}
              {cert && (
                <div className="pt-2 space-y-2">
                  <p className="font-mono text-[10px] font-bold inline-flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> {cert.code} · TERBIT {formatDate(cert.issued_at)}
                    {cert.revoked_at ? ` · DICABUT ${formatDate(cert.revoked_at)}` : ''}
                  </p>
                  {cert.revoke_reason && <p className="text-sm">Alasan pencabutan: {cert.revoke_reason}</p>}
                  <div className="flex flex-wrap gap-2">
                    <a href={certificatePath(cert.code)} target="_blank" rel="noopener noreferrer" className="chip-mono min-h-[36px] inline-flex items-center text-[#12283c]">LIHAT SERTIFIKAT ↗</a>
                    <a href={verificationPath(cert.code)} target="_blank" rel="noopener noreferrer" className="chip-mono min-h-[36px] inline-flex items-center text-[#12283c]">HALAMAN VERIFIKASI ↗</a>
                    {canRevoke && cert.status === 'VALID' && !revoking && (
                      <button type="button" onClick={() => setRevoking(true)} className="chip-mono min-h-[36px] text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white">CABUT SERTIFIKAT</button>
                    )}
                  </div>
                  {revoking && <RevokeForm item={item} onDone={onDone} onCancel={() => setRevoking(false)} />}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * @param {{ canRevoke?: boolean, onChanged?: () => void, liveKey?: number }} props
 *   canRevoke = admin (pencabutan); liveKey berubah saat notifikasi baru masuk.
 */
export default function CertificationReview({ canRevoke = false, onChanged = () => {}, liveKey = 0 }) {
  const [status, setStatus] = useState('PENDING');
  const [paging, setPaging] = useState({ status: 'PENDING', page: 1 });
  const page = paging.status === status ? paging.page : 1;
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/admin/certifications', { signal, query: { status, page, limit: PAGE_SIZE } }),
    [status, page, liveKey],
  );
  const items = data?.items || [];
  const done = () => { setOpenId(null); refetch(); onChanged(); };

  return (
    <>
      <div className="dash-item mb-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Sertifikasi talenta</h1>
        <p className="label-mono mt-2">SYARAT {data?.min_projects ?? 3} PROYEK SELESAI · TINJAU BUKTI, LALU SETUJUI ATAU TOLAK DENGAN CATATAN</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
        {FILTERS.map(([value, label, countKey]) => (
          <button type="button" key={value} onClick={() => setStatus(value)} aria-pressed={status === value} className={`dash-item p-5 text-left min-h-[44px] transition-colors ${status === value ? 'bg-[#12283c] text-[#f2efe6]' : 'bg-[#fdfcf7] hover:bg-[#e62b2b] hover:text-white'}`}>
            <div className="text-3xl md:text-4xl font-black tabular-nums">{countKey ? (data?.counts?.[countKey] ?? '—') : (data?.counts ? data.counts.pending + data.counts.approved + data.counts.rejected : '—')}</div>
            <p className="label-mono mt-1">{label}</p>
          </button>
        ))}
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState icon="✓" title={status === 'PENDING' ? 'Tidak ada pengajuan menunggu' : 'Belum ada pengajuan'} description="Talenta dengan cukup proyek selesai bisa mengajukan sertifikasi dari tab Profil. Admin dan AgenSUSI mendapat notifikasi." />
      )}
      <div className="space-y-4">
        {items.map((item) => (
          <RequestItem key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} onDone={done} canRevoke={canRevoke} />
        ))}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ status, page: p })} />}
    </>
  );
}
