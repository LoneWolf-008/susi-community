import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { NEED_CATEGORY, NEED_SOURCE, moderationStatus } from '../../../lib/statusMap';
import { formatDateTime, timeAgo } from '../../../lib/format';
import StatusChip, { TagChip } from '../../../components/common/StatusChip';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import { RISK_TONE } from './labels';

const PAGE_SIZE = 15;
const TYPES = ['', 'KEBUTUHAN', 'TESTIMONI', 'TALENTA'];
const DECISIONS = [['PENDING', 'MENUNGGU'], ['APPROVED', 'DISETUJUI'], ['REJECTED', 'DITOLAK']];
const REJECT_REASONS = ['SPAM', 'DUPLIKAT', 'SALAH KATEGORI', 'TIDAK LAYAK'];

function NeedDetailBlock({ d }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 rounded-xl border border-[#12283c]/15 p-4">
        <p className="label-mono mb-2">CERITA KEBUTUHAN</p>
        {d.summary && <p className="text-sm font-bold mb-2">{d.summary}</p>}
        <p className="text-sm text-[#12283c]/80 leading-relaxed whitespace-pre-line">{d.description}</p>
      </div>
      <div className="rounded-xl border border-[#12283c]/15 p-4 space-y-2 font-mono text-[10px]">
        <p className="label-mono">DETAIL</p>
        <div className="flex justify-between gap-2"><span>KATEGORI</span><span className="font-bold text-right">{NEED_CATEGORY[d.category] || d.category}</span></div>
        <div className="flex justify-between gap-2"><span>SUMBER</span><span className="font-bold">{NEED_SOURCE[d.source] || d.source}</span></div>
        <div className="flex justify-between gap-2"><span>KOMUNITAS</span><span className="font-bold text-right">{d.community_name || '—'}</span></div>
        <div className="flex justify-between gap-2"><span>DICATAT</span><span className="font-bold text-right">{d.created_by_name || '—'}</span></div>
        {d.address && <div className="flex justify-between gap-2"><span>ALAMAT</span><span className="font-bold text-right">{d.address}</span></div>}
      </div>
    </div>
  );
}

function TestimonialDetailBlock({ d }) {
  return (
    <div className="rounded-xl border border-[#12283c]/15 p-4">
      <p className="label-mono mb-2">TESTIMONI · {d.from_name} → {d.to_name}</p>
      <p className="text-sm italic leading-relaxed">“{d.text}”</p>
      <p className="font-mono text-[10px] opacity-60 mt-2">PROYEK: {d.project_title}{d.is_public ? '' : ' · TIDAK PUBLIK'}{d.moderation_status === 'REJECTED' ? ' · SUDAH DITURUNKAN' : ''}</p>
    </div>
  );
}

/** U5: pengajuan sertifikasi talenta; bukti lengkap (testimoni, hasil kerja) ada di tab Sertifikasi. */
function CertificationDetailBlock({ d, onOpenCertifications }) {
  return (
    <div className="rounded-xl border border-[#12283c]/15 p-4">
      <p className="label-mono mb-2">SERTIFIKASI · {d.focus_label} · {d.talent_name}</p>
      <p className="text-sm leading-relaxed whitespace-pre-line break-words">{d.pitch}</p>
      <p className="font-mono text-[10px] opacity-60 mt-2">{d.evidence_projects} PROYEK BUKTI · {d.completed_projects} PROYEK SELESAI</p>
      {onOpenCertifications && (
        <button type="button" onClick={onOpenCertifications} className="chip-mono mt-3 min-h-[36px] text-[#12283c] hover:border-[#e62b2b]">LIHAT BUKTI LENGKAP DI TAB SERTIFIKASI →</button>
      )}
    </div>
  );
}

const CHECK_LABEL = {
  KEBUTUHAN: 'Kategori sesuai cerita',
  TESTIMONI: 'Isi wajar, tanpa data pribadi',
  TALENTA: 'Bukti proyek sesuai bidang',
};

function ModerationItem({ item, open, onToggle, onDone, onOpenCertifications }) {
  const toast = useToast();
  const [checks, setChecks] = useState({ layak: false, kategori: false });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = checks.layak && checks.kategori;
  const d = item.detail;

  const decide = async (decision) => {
    setBusy(true);
    try {
      await api.patch(`/admin/moderation/${item.id}`, {
        decision,
        reject_reason: decision === 'REJECTED' ? reason : null,
        checklist_layak: checks.layak,
        checklist_kategori: checks.kategori,
      });
      toast.success(decision === 'APPROVED' ? `"${item.title}" disetujui` : `"${item.title}" ditolak (${reason})`);
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const takedown = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/testimonials/${item.ref_id}/takedown`, { reason: 'Diturunkan dari antrean moderasi' });
      toast.success('Testimoni diturunkan dari profil publik');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <article className={`dash-item card-light transition-all ${open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full p-6 text-left flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TagChip>{item.item_type}</TagChip>
            <StatusChip status={{ label: `RISIKO ${item.risk_level}`, tone: RISK_TONE[item.risk_level] || 'muted' }} />
            {item.decision !== 'PENDING' && <StatusChip status={moderationStatus(item.decision)} />}
            <span className="font-mono text-[9px] opacity-50">{timeAgo(item.created_at).toUpperCase()}</span>
          </div>
          <h4 className="font-black text-lg leading-tight mb-1">{item.title}</h4>
          <p className="label-mono">{item.source === 'AGENSUSI' ? 'DICATAT AGENSUSI' : 'MANDIRI'} · {item.submitter_name || '—'}</p>
        </div>
        <span className={`text-[10px] font-black shrink-0 transition-transform ${open ? 'rotate-90 text-[#e62b2b]' : ''}`}>→</span>
      </button>
      {open && (
        <div className="px-6 pb-6 space-y-4">
          {!d && <p className="text-sm text-[#12283c]/60">Data asal item ini tidak ditemukan.</p>}
          {d && item.item_type === 'KEBUTUHAN' && <NeedDetailBlock d={d} />}
          {d && item.item_type === 'TESTIMONI' && <TestimonialDetailBlock d={d} />}
          {d && item.item_type === 'TALENTA' && <CertificationDetailBlock d={d} onOpenCertifications={onOpenCertifications} />}

          {item.decision === 'PENDING' ? (
            <>
              <div>
                <p className="label-mono mb-2">CHECKLIST — WAJIB SEBELUM MENYETUJUI</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[['layak', 'Konten layak & bukan spam'], ['kategori', CHECK_LABEL[item.item_type] || CHECK_LABEL.TESTIMONI]].map(([key, label]) => (
                    <button type="button" key={key} role="checkbox" aria-checked={checks[key]} onClick={() => setChecks((c) => ({ ...c, [key]: !c[key] }))} className={`rounded-xl p-3 border text-left text-[10px] font-bold transition-colors ${checks[key] ? 'bg-[#c9ecd9] border-[#12283c] text-[#12283c]' : 'border-[#12283c]/20 hover:border-[#12283c]'}`}>
                      {checks[key] ? '✓' : '○'} {label}
                    </button>
                  ))}
                </div>
              </div>
              {rejecting ? (
                <div className="rounded-xl border-2 border-[#e62b2b] p-4 space-y-3">
                  <p className="label-mono !text-[#e62b2b] !opacity-100">ALASAN PENOLAKAN (WAJIB, DIKIRIM KE PENGAJU)</p>
                  <div className="flex flex-wrap gap-2">
                    {REJECT_REASONS.map((r) => (
                      <button type="button" key={r} onClick={() => setReason(r)} aria-pressed={reason === r} className={`chip-mono transition-colors ${reason === r ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c]'}`}>{r}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decide('REJECTED')} disabled={!reason || busy} className="flex-1 btn-pill btn-red !py-2.5 text-[10px] disabled:opacity-40">{busy ? '…' : `Konfirmasi tolak${reason ? ` (${reason})` : ''}`}</button>
                    <button type="button" onClick={() => setRejecting(false)} className="flex-1 btn-pill btn-ghost-dark !py-2.5 text-[10px]">Batal</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-3 flex-wrap">
                    <button type="button" onClick={() => decide('APPROVED')} disabled={!ready || busy} className="flex-1 btn-pill bg-[#c9ecd9] text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] disabled:bg-[#12283c]/10 disabled:text-[#12283c]/40 disabled:cursor-not-allowed">{busy ? '…' : '✓ Setujui'}</button>
                    <button type="button" onClick={() => setRejecting(true)} className="flex-1 btn-pill btn-ghost-dark hover:!bg-[#e62b2b] hover:!text-white hover:!border-[#e62b2b]">Tolak</button>
                  </div>
                  {!ready && <p className="font-mono text-[9px] opacity-50">CENTANG KEDUA CHECKLIST UNTUK MENGAKTIFKAN TOMBOL SETUJUI.</p>}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-[#12283c]/5 p-4">
              <p className="font-mono text-[10px] font-bold">
                {item.decision === 'APPROVED' ? 'DISETUJUI' : `DITOLAK (${item.reject_reason})`} OLEH {item.reviewer_name || '—'} · {formatDateTime(item.reviewed_at)}
              </p>
              {item.item_type === 'TESTIMONI' && item.decision === 'APPROVED' && d?.moderation_status === 'APPROVED' && (
                <button type="button" onClick={takedown} disabled={busy} className="chip-mono text-[#e62b2b] hover:bg-[#e62b2b] hover:text-white">{busy ? '…' : 'TURUNKAN TESTIMONI'}</button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Antrean moderasi (GET/PATCH /admin/moderation) dengan isi item, checklist, dan alasan penolakan. */
export default function ModerasiTab({ statsQ, onChanged, onOpenCertifications }) {
  const [type, setType] = useState('');
  const [decision, setDecision] = useState('PENDING');
  const filterKey = `${type}|${decision}`;
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/admin/moderation', { signal, query: { item_type: type, decision, page, limit: PAGE_SIZE } }),
    [type, decision, page],
  );
  const items = data?.items || [];
  const m = statsQ.data?.moderation;
  const done = () => { setOpenId(null); refetch(); onChanged(); };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Moderasi</h1><p className="label-mono mt-2">KEBUTUHAN, TESTIMONI & SERTIFIKASI TALENTA</p></div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button type="button" key={t || 'all'} onClick={() => setType(t)} className={`chip-mono transition-colors ${type === t ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{t || 'SEMUA JENIS'}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
        {DECISIONS.map(([value, label]) => (
          <button type="button" key={value} onClick={() => setDecision(value)} aria-pressed={decision === value} className={`dash-item p-6 text-left transition-colors ${decision === value ? 'bg-[#12283c] text-[#f2efe6]' : 'bg-[#fdfcf7] hover:bg-[#e62b2b] hover:text-white'}`}>
            <div className="text-4xl md:text-5xl font-black tabular-nums">{m ? m[value.toLowerCase()] : '—'}</div>
            <p className="label-mono mt-1">{label}</p>
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState
          icon="✓"
          title={decision === 'PENDING' ? 'Antrean kosong' : 'Belum ada item'}
          description={decision === 'PENDING' ? 'Semua kebutuhan, testimoni, dan pengajuan sertifikasi sudah diputus. Item baru muncul saat komunitas, AgenSUSI, atau talenta mengirimkannya.' : 'Belum ada item dengan keputusan ini.'}
        />
      )}
      <div className="space-y-4">
        {items.map((item) => (
          <ModerationItem key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} onDone={done} onOpenCertifications={onOpenCertifications} />
        ))}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ key: filterKey, page: p })} />}
    </>
  );
}
