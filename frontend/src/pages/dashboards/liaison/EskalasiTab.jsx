import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { useAuth } from '../../../context/authContext';
import { escalationStatus, ESCALATION_REASON } from '../../../lib/statusMap';
import { formatDateTime, timeAgo, whatsappLink } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import Modal from '../../../components/modals/Modal';
import MarkdownLite from '../../../components/chat/MarkdownLite';
import { SkeletonCard, SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';

// Antrean eskalasi Tanya SUSI (T14): pertanyaan yang tidak bisa dijawab asisten, diteruskan pengguna
// ke AgenSUSI. Dipakai dasbor liaison dan admin (admin boleh menangani tiket siapa pun).

const PAGE_SIZE = 10;
const FILTERS = [
  { key: 'open', label: 'TERBUKA', query: { status: 'open' } },
  { key: 'mine', label: 'KLAIM SAYA', query: { status: 'open', mine: 'true' } },
  { key: 'resolved', label: 'SELESAI', query: { status: 'resolved' } },
  { key: 'all', label: 'SEMUA', query: { status: 'all' } },
];
const ROLE_NAME = { requester: 'Komunitas', talent: 'Talenta', liaison: 'AgenSUSI', admin: 'Admin' };
const SPEAKER = {
  user: { label: 'PENGGUNA', className: 'bg-[#12283c] text-[#f2efe6]' },
  assistant: { label: 'TANYA SUSI · AI', className: 'bg-white border border-[#12283c]/10' },
  agent: { label: 'AGENSUSI', className: 'bg-[#c9ecd9] border-l-4 border-[#12283c]' },
};
const QUICK_REPLIES = [
  'Halo, saya dari AgenSUSI. Saya bantu cek, ya.',
  'Boleh ceritakan lebih detail kendalanya?',
  'Sudah kami teruskan ke admin SUSI. Kabar selanjutnya kami sampaikan di percakapan ini.',
];

const who = (e) => (e.user ? `${e.user.name} · ${ROLE_NAME[e.user.role] || e.user.role}` : 'Pengunjung anonim');
const contactHref = (contact) => {
  if (!contact) return null;
  return contact.includes('@') ? `mailto:${contact}` : whatsappLink(contact);
};

function ResolveModal({ escalation, onClose, onDone }) {
  const toast = useToast();
  const firstQuestion = escalation.messages?.find((m) => m.role === 'user')?.content || '';
  const [outcome, setOutcome] = useState('resolved');
  const [resolution, setResolution] = useState('');
  const [saveAsKb, setSaveAsKb] = useState(false);
  const [kbTitle, setKbTitle] = useState(firstQuestion.slice(0, 200));
  const [kbKeywords, setKbKeywords] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const keywords = kbKeywords.split(',').map((k) => k.trim()).filter(Boolean);
      await api.patch(`/liaison/escalations/${escalation.id}/resolve`, {
        outcome,
        resolution: resolution.trim(),
        save_as_kb: outcome === 'resolved' && saveAsKb,
        kb_title: saveAsKb && kbTitle.trim() ? kbTitle.trim() : undefined,
        kb_keywords: saveAsKb && keywords.length ? keywords : undefined,
      });
      toast.success(outcome === 'resolved'
        ? (saveAsKb ? 'Tiket selesai · draft KB menunggu tinjauan admin' : 'Tiket diselesaikan')
        : 'Tiket ditutup');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Tiket #${escalation.id}`} eyebrow="SELESAIKAN ESKALASI" onClose={onClose} busy={busy} size="max-w-lg">
      <div className="space-y-3" role="radiogroup" aria-label="Hasil">
        {[
          ['resolved', 'Selesai', 'Pertanyaan pengguna sudah terjawab atau masalahnya tertangani.'],
          ['closed', 'Tutup tanpa penyelesaian', 'Mis. pesan iseng, duplikat, atau di luar layanan SUSI.'],
        ].map(([value, title, sub]) => (
          <button type="button" key={value} role="radio" aria-checked={outcome === value} onClick={() => setOutcome(value)} className={`w-full rounded-xl border p-4 text-left transition-colors ${outcome === value ? 'border-[#e62b2b] bg-[#e62b2b]/15' : 'border-white/15 hover:bg-white/5'}`}>
            <p className="font-mono text-[10px] font-black uppercase tracking-widest">{outcome === value ? '● ' : '○ '}{title}</p>
            <p className="text-[11px] opacity-70 mt-1">{sub}</p>
          </button>
        ))}
      </div>
      <label className="field-label mt-5" htmlFor="esc-resolution">Catatan penyelesaian (min. 10 karakter)</label>
      <textarea id="esc-resolution" value={resolution} onChange={(e) => setResolution(e.target.value.slice(0, 2000))} className="input-line input-line-dark h-24 resize-none" placeholder="Apa jawabannya atau tindak lanjutnya?" />
      {outcome === 'resolved' && (
        <div className="mt-4 rounded-xl border border-white/15 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={saveAsKb} onChange={(e) => setSaveAsKb(e.target.checked)} className="mt-1 accent-[#e62b2b]" />
            <span>
              <span className="font-mono text-[10px] font-black tracking-widest">SIMPAN SEBAGAI DRAFT KB</span>
              <span className="block text-[11px] opacity-70 mt-1">Catatan di atas menjadi jawaban draft. Admin meninjaunya sebelum dipakai Tanya SUSI untuk pertanyaan serupa.</span>
            </span>
          </label>
          {saveAsKb && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="field-label" htmlFor="esc-kb-title">Judul entri</label>
                <input id="esc-kb-title" value={kbTitle} onChange={(e) => setKbTitle(e.target.value.slice(0, 200))} className="input-line input-line-dark" />
              </div>
              <div>
                <label className="field-label" htmlFor="esc-kb-keywords">Kata kunci (pisahkan dengan koma, opsional)</label>
                <input id="esc-kb-keywords" value={kbKeywords} onChange={(e) => setKbKeywords(e.target.value)} className="input-line input-line-dark" placeholder="Kosongkan agar diambil dari pertanyaan pengguna" />
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button type="button" onClick={onClose} disabled={busy} className="btn-pill btn-ghost-light">Batal</button>
        <button type="button" onClick={submit} disabled={busy || resolution.trim().length < 10} className="btn-pill btn-red disabled:opacity-40">{busy ? 'Menyimpan…' : 'Simpan →'}</button>
      </div>
    </Modal>
  );
}

function EscalationDetail({ id, liveKey, onChanged }) {
  const toast = useToast();
  const { user } = useAuth();
  const { data: e, loading, error, refetch } = useApi((signal) => api.get(`/liaison/escalations/${id}`, { signal }), [id, liveKey]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);

  if (error) return <ErrorState error={error} onRetry={refetch} compact />;
  if (loading && !e) return <SkeletonLines count={6} />;

  const isAdmin = user?.role === 'admin';
  const mine = e.assigned_to?.id === user?.id;
  const canReply = e.status === 'assigned' && (mine || isAdmin);
  const canResolve = canReply || (e.status === 'pending' && isAdmin);
  const changed = () => { refetch(); onChanged(); };

  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      if (message) toast.success(message);
      changed();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const claim = () => run(() => api.patch(`/liaison/escalations/${id}/claim`), 'Tiket diklaim — Anda yang menangani');
  const send = () => run(async () => {
    await api.post(`/liaison/escalations/${id}/reply`, { message: reply.trim() });
    setReply('');
  }, 'Balasan terkirim ke pengguna');
  const href = contactHref(e.contact);

  return (
    <div className="space-y-4 mt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#12283c]/5 p-4 text-xs leading-relaxed">
          <p className="label-mono mb-2">RINGKASAN {e.summary_source === 'llm' ? '(AI)' : '(OTOMATIS)'}</p>
          <p>{e.summary}</p>
        </div>
        <div className="rounded-xl border border-[#12283c]/15 p-4 text-xs leading-relaxed">
          <p className="label-mono mb-2">PENANYA</p>
          <p className="font-bold">{who(e)}</p>
          {e.contact ? (
            <p className="mt-1">Kontak balik: {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-[#e62b2b] break-all">{e.contact}</a> : e.contact}</p>
          ) : <p className="mt-1 opacity-60">{e.user ? 'Balas lewat percakapan; pengguna mendapat notifikasi.' : 'Tanpa kontak balik.'}</p>}
          <p className="mt-1 opacity-60">Terakhir aktif {timeAgo(e.last_active_at)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#12283c]/15 p-4">
        <p className="label-mono mb-3">PERCAKAPAN ({e.messages.length} PESAN TERAKHIR)</p>
        <ol className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {e.messages.map((m) => (
            <li key={m.id}>
              <p className="font-mono text-[9px] font-bold tracking-widest opacity-60 mb-1">{SPEAKER[m.role]?.label} · {formatDateTime(m.created_at)}</p>
              <div className={`rounded-xl px-3 py-2 text-xs ${SPEAKER[m.role]?.className || ''}`}><MarkdownLite text={m.content} /></div>
            </li>
          ))}
        </ol>
      </div>

      {e.status === 'pending' && (
        <button type="button" onClick={claim} disabled={busy} className="btn-pill btn-navy w-full disabled:opacity-40">{busy ? 'Memproses…' : '✋ Klaim tiket ini'}</button>
      )}
      {e.status === 'assigned' && !canReply && (
        <p className="rounded-xl bg-[#12283c]/5 p-4 font-mono text-[10px] font-bold">DITANGANI {e.assigned_to?.name?.toUpperCase()}</p>
      )}
      {canReply && (
        <div className="rounded-xl border border-[#12283c]/15 p-4">
          <label className="field-label" htmlFor={`esc-reply-${id}`}>Balasan ke pengguna (muncul di percakapan Tanya SUSI-nya)</label>
          <textarea id={`esc-reply-${id}`} value={reply} onChange={(ev) => setReply(ev.target.value.slice(0, 2000))} className="input-line h-20 resize-none" placeholder="Tulis balasan…" />
          <div className="flex flex-wrap gap-2 mt-2">
            {QUICK_REPLIES.map((q) => <button type="button" key={q} onClick={() => setReply(q)} className="chip-mono text-[#12283c]">+ {q}</button>)}
          </div>
          <button type="button" onClick={send} disabled={!reply.trim() || busy} className="btn-pill btn-navy w-full !py-3 mt-3 text-[10px] disabled:opacity-40">{busy ? 'Mengirim…' : '✉ Kirim balasan'}</button>
        </div>
      )}
      {canResolve && <button type="button" onClick={() => setResolving(true)} className="btn-pill btn-red w-full">Selesaikan tiket →</button>}
      {(e.status === 'resolved' || e.status === 'closed') && (
        <div className="rounded-xl bg-[#c9ecd9] p-4 text-xs leading-relaxed">
          <p className="font-mono text-[10px] font-bold mb-1">✓ {escalationStatus(e.status).label} · {formatDateTime(e.resolved_at)}{e.assigned_to ? ` · ${e.assigned_to.name}` : ''}</p>
          {e.resolution && <p>{e.resolution}</p>}
          {e.kb_entry_id && <p className="mt-1 font-mono text-[10px] font-bold">DRAFT KB #{e.kb_entry_id} MENUNGGU TINJAUAN ADMIN</p>}
        </div>
      )}
      {resolving && <ResolveModal escalation={e} onClose={() => setResolving(false)} onDone={() => { setResolving(false); changed(); }} />}
    </div>
  );
}

/**
 * @param {{ liveKey?: number, onChanged?: () => void, focusId?: number|null, embedded?: boolean }} props
 *   focusId = tiket yang dibuka dari notifikasi; embedded = dipakai di dalam tab lain (judul lebih kecil).
 */
export default function EskalasiTab({ liveKey = 0, onChanged = () => {}, focusId = null, embedded = false }) {
  const [filter, setFilter] = useState('open');
  const [paging, setPaging] = useState({ filter: 'open', page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const [openId, setOpenId] = useState(focusId);
  const [prevFocus, setPrevFocus] = useState(focusId);
  if (focusId !== prevFocus) {
    setPrevFocus(focusId);
    if (focusId) setOpenId(focusId);
  }
  const query = FILTERS.find((f) => f.key === filter).query;
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/liaison/escalations', { signal, query: { ...query, page, limit: PAGE_SIZE } }),
    [filter, page, liveKey],
  );
  const items = data?.items || [];
  const counts = data?.counts;
  const changed = () => { refetch(); onChanged(); };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          {embedded
            ? <h2 className="text-2xl font-black tracking-tight">Antrean eskalasi</h2>
            : <h1 className="text-4xl md:text-5xl font-black tracking-tight">Eskalasi Tanya SUSI</h1>}
          <p className="label-mono mt-2">
            {counts ? `${counts.pending} MENUNGGU · ${counts.mine} SAYA TANGANI${counts.stale ? ` · ${counts.stale} BASI > 24 JAM` : ''}` : 'PERTANYAAN WARGA YANG BUTUH BANTUAN MANUSIA'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button type="button" key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`chip-mono transition-colors ${filter === f.key ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{f.label}</button>
          ))}
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState icon="✓" title={filter === 'open' ? 'Antrean kosong' : 'Belum ada tiket'} description="Tiket muncul saat pengguna menekan “Hubungi AgenSUSI” di Tanya SUSI. Semua AgenSUSI aktif mendapat notifikasi." />
      )}
      <div className="space-y-4">
        {items.map((e) => {
          const open = openId === e.id;
          return (
            <article key={e.id} className={`dash-item card-light p-6 transition-all ${open ? 'border-[#e62b2b] shadow-[0_14px_35px_rgba(230,43,43,0.15)]' : ''} ${['resolved', 'closed'].includes(e.status) && !open ? 'opacity-70' : ''}`}>
              <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="font-black text-lg leading-tight">Tiket #{e.id} · {who(e)}</h3>
                  <p className="label-mono mt-1">
                    {timeAgo(e.created_at).toUpperCase()}
                    {e.assigned_to ? ` · DITANGANI ${e.assigned_to.name.toUpperCase()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {e.priority === 'high' && <span className="chip-mono border-0 bg-[#7a1a1f] text-white">PRIORITAS</span>}
                  {e.stale && <span className="chip-mono border-0 bg-[#b45309] text-white">BASI</span>}
                  <StatusChip status={escalationStatus(e.status)} />
                  <button type="button" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open} className="chip-mono text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors">{open ? 'TUTUP ▴' : 'DETAIL ▾'}</button>
                </div>
              </div>
              <p className="text-sm text-[#12283c]/75 leading-relaxed">{e.summary}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {e.reasons.map((r) => <span key={r} className="chip-mono text-[#12283c]/70">{ESCALATION_REASON[r] || r}</span>)}
              </div>
              {open && <EscalationDetail id={e.id} liveKey={liveKey} onChanged={changed} />}
            </article>
          );
        })}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ filter, page: p })} />}
    </>
  );
}
