import { useEffect, useState } from 'react';
import { ArrowLeft, PauseCircle, Send, Sparkles, Star } from 'lucide-react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { useAuth } from '../../../context/authContext';
import { escalationStatus, ESCALATION_REASON } from '../../../lib/statusMap';
import { formatDateTime, timeAgo, whatsappLink } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import Modal from '../../../components/modals/Modal';
import HandoffTranscript from '../../../components/chat/HandoffTranscript';
import { CHAT_THEMES } from '../../../components/chat/chatTheme';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import Pagination from '../../../components/ui/Pagination';

// Inbox eskalasi Tanya SUSI (T14, tata letak dua panel U6): daftar tiket di kiri, percakapan di kanan;
// di layar kecil daftar dulu lalu detail. Transkrip bagian AI bisa dilipat, balasan cepat, tombol
// Selesai dan "Kembalikan ke AI". Dipakai dasbor liaison dan admin (admin boleh menangani tiket siapa pun).

const t = CHAT_THEMES.light;
const PAGE_SIZE = 10;
const DETAIL_POLL_MS = 10000;
const LIST_POLL_MS = 20000;
const OPEN = ['pending', 'assigned'];
const FILTERS = [
  { key: 'open', label: 'TERBUKA', query: { status: 'open' } },
  { key: 'mine', label: 'KLAIM SAYA', query: { status: 'open', mine: 'true' } },
  { key: 'resolved', label: 'SELESAI', query: { status: 'resolved' } },
  { key: 'all', label: 'SEMUA', query: { status: 'all' } },
];
const ROLE_NAME = { requester: 'Komunitas', talent: 'Talenta', liaison: 'AgenSUSI', admin: 'Admin' };
const SPEAKER = { user: 'Pengguna', agent: 'AgenSUSI', assistant: 'AI' };
const QUICK_REPLIES = [
  'Halo, saya dari AgenSUSI. Saya bantu cek, ya.',
  'Boleh ceritakan lebih detail kendalanya?',
  'Terima kasih sudah menunggu.',
  'Sudah kami teruskan ke admin SUSI. Kabar selanjutnya kami sampaikan di percakapan ini.',
  'Apakah masih ada yang bisa saya bantu?',
];

const who = (e) => (e.user ? `${e.user.name} · ${ROLE_NAME[e.user.role] || e.user.role}` : 'Pengunjung anonim');
const contactHref = (contact) => {
  if (!contact) return null;
  return contact.includes('@') ? `mailto:${contact}` : whatsappLink(contact);
};

/** Muat ulang berkala selama tab peramban aktif. */
function usePolling(enabled, ms, refetch) {
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refetch(); }, ms);
    return () => clearInterval(timer);
  }, [enabled, ms, refetch]);
}

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

function TicketList({ items, openId, onOpen }) {
  return (
    <ul className="divide-y divide-[#12283c]/10">
      {items.map((e) => {
        const open = openId === e.id;
        const closed = !OPEN.includes(e.status);
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e.id)}
              aria-current={open ? 'true' : undefined}
              className={`w-full text-left px-4 py-3 min-h-[72px] transition-colors ${open ? 'bg-[#e62b2b]/[0.08] border-l-4 border-[#e62b2b]' : 'border-l-4 border-transparent hover:bg-[#12283c]/[0.03]'} ${closed && !open ? 'opacity-70' : ''}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-black truncate">{who(e)}</span>
                <span className={`shrink-0 font-mono text-[9px] ${t.muted}`}>{timeAgo(e.last_active_at)}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusChip status={escalationStatus(e.status)} className="!px-2 !py-0.5 !text-[9px]" />
                {e.priority === 'high' && <span className="chip-mono !px-2 !py-0.5 !text-[9px] border-0 bg-[#7a1a1f] text-white">PRIORITAS</span>}
                {e.stale && <span className="chip-mono !px-2 !py-0.5 !text-[9px] border-0 bg-[#b45309] text-white">BASI</span>}
                <span className={`font-mono text-[9px] ${t.muted}`}>#{e.id}{e.assigned_to ? ` · ${e.assigned_to.name.split(' ')[0].toUpperCase()}` : ''}</span>
              </span>
              <span className="mt-1 flex items-start justify-between gap-2">
                <span className={`text-[12px] leading-snug line-clamp-2 break-words ${e.unread ? 'font-bold' : t.muted}`}>
                  {e.last_message ? `${SPEAKER[e.last_message.role]}: ${e.last_message.preview}` : e.summary}
                </span>
                {e.unread > 0 && (
                  <span className="shrink-0 min-w-[22px] h-[22px] px-1 rounded-full bg-[#e62b2b] text-white text-[10px] font-black flex items-center justify-center" aria-label={`${e.unread} pesan belum dibaca`}>
                    {e.unread > 9 ? '9+' : e.unread}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Kembalikan ke AI": konfirmasi inline, pesan untuk pengguna diambil dari kolom balasan bila diisi. */
function HandbackConfirm({ id, draft, onCancel, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.patch(`/liaison/escalations/${id}/handback`, { message: draft.trim() || undefined });
      toast.success('Percakapan dikembalikan ke asisten AI');
      onDone();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };
  return (
    <div className={`rounded-xl p-3 text-[12px] space-y-2 ${t.alert}`} role="group" aria-label="Konfirmasi kembalikan ke AI">
      <p>
        Kembalikan percakapan ke asisten AI? Tiket selesai dan pengguna melihat{' '}
        {draft.trim() ? 'isi kolom balasan Anda' : 'pesan bawaan'} lalu bisa bertanya lagi ke Tanya SUSI.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={`min-h-[44px] flex-1 rounded-full px-3 font-mono text-[10px] font-bold tracking-wider ${t.action}`}>BATAL</button>
        <button type="button" onClick={confirm} disabled={busy} className="min-h-[44px] flex-1 rounded-full bg-[#12283c] text-[#f2efe6] px-3 font-mono text-[10px] font-bold tracking-wider disabled:opacity-50">{busy ? 'MEMPROSES…' : 'YA, KEMBALIKAN'}</button>
      </div>
    </div>
  );
}

function EscalationDetail({ id, liveKey, onChanged, onBack }) {
  const toast = useToast();
  const { user } = useAuth();
  const { data: e, loading, error, refetch } = useApi((signal) => api.get(`/liaison/escalations/${id}`, { signal }), [id, liveKey]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [handingBack, setHandingBack] = useState(false);
  // Pesan baru dari pengguna selama tiket terbuka.
  usePolling(OPEN.includes(e?.status), DETAIL_POLL_MS, refetch);

  if (error) return <div className="p-4"><ErrorState error={error} onRetry={refetch} compact /></div>;
  if (loading && !e) return <div className="p-4"><SkeletonLines count={6} /></div>;

  const isAdmin = user?.role === 'admin';
  const mine = e.assigned_to?.id === user?.id;
  const canReply = e.status === 'assigned' && (mine || isAdmin);
  const canResolve = canReply || (e.status === 'pending' && isAdmin);
  const open = OPEN.includes(e.status);
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
  const send = (ev) => {
    ev?.preventDefault();
    if (!reply.trim() || busy) return;
    run(async () => {
      await api.post(`/liaison/escalations/${id}/reply`, { message: reply.trim() });
      setReply('');
    }, 'Balasan terkirim ke pengguna');
  };
  const href = contactHref(e.contact);

  return (
    <div className="flex flex-col md:h-full md:min-h-0">
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${t.divider} bg-white shrink-0`}>
        <button type="button" onClick={onBack} aria-label="Kembali ke daftar tiket" className={`md:hidden w-11 h-11 -ml-2 rounded-full flex items-center justify-center shrink-0 ${t.action}`}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black leading-tight truncate">Tiket #{e.id} · {who(e)}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusChip status={escalationStatus(e.status)} className="!px-2 !py-0.5 !text-[9px]" />
            {e.priority === 'high' && <span className="chip-mono !px-2 !py-0.5 !text-[9px] border-0 bg-[#7a1a1f] text-white">PRIORITAS</span>}
            {open && (
              <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold ${t.muted}`}>
                <PauseCircle className="w-3 h-3" aria-hidden="true" /> AI DIJEDA
              </span>
            )}
            <span className={`font-mono text-[9px] ${t.muted}`}>DIBUAT {timeAgo(e.created_at).toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="md:flex-1 md:min-h-0 md:overflow-y-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#12283c]/5 p-4 text-xs leading-relaxed">
            <p className="label-mono mb-2">RINGKASAN {e.summary_source === 'llm' ? '(AI)' : '(OTOMATIS)'}</p>
            <p>{e.summary}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {e.reasons.map((r) => <span key={r} className="chip-mono !text-[9px] text-[#12283c]/70">{ESCALATION_REASON[r] || r}</span>)}
            </div>
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

        <HandoffTranscript messages={e.messages} sinceId={e.handoff_message_id} viewer="agent" t={t} />

        {!open && (
          <div className="rounded-xl bg-[#c9ecd9] p-4 text-xs leading-relaxed">
            <p className="font-mono text-[10px] font-bold mb-1">✓ {escalationStatus(e.status).label}{e.resolved_at ? ` · ${formatDateTime(e.resolved_at)}` : ''}{e.assigned_to ? ` · ${e.assigned_to.name}` : ''}</p>
            {e.status === 'cancelled' && <p>Pengguna kembali ke asisten AI sebelum tiket diselesaikan.</p>}
            {e.handed_back && <p>Dikembalikan ke asisten AI.</p>}
            {e.resolution && !e.handed_back && <p>{e.resolution}</p>}
            {e.kb_entry_id && <p className="mt-1 font-mono text-[10px] font-bold">DRAFT KB #{e.kb_entry_id} MENUNGGU TINJAUAN ADMIN</p>}
            {e.rating && (
              <p className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold">
                <Star className="w-3 h-3 fill-current" aria-hidden="true" /> PENILAIAN PENGGUNA {e.rating}/5
              </p>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className={`px-4 py-3 border-t ${t.divider} bg-[#f2efe6] shrink-0 space-y-2`}>
          {e.status === 'pending' && (
            <button type="button" onClick={claim} disabled={busy} className="btn-pill btn-navy w-full disabled:opacity-40">{busy ? 'Memproses…' : '✋ Klaim tiket ini'}</button>
          )}
          {e.status === 'assigned' && !canReply && (
            <p className="rounded-xl bg-[#12283c]/5 p-3 font-mono text-[10px] font-bold">DITANGANI {e.assigned_to?.name?.toUpperCase()}</p>
          )}
          {canReply && (
            <form onSubmit={send} className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Balasan cepat">
                {QUICK_REPLIES.map((q) => (
                  <button type="button" key={q} onClick={() => setReply(q)} className="chip-mono shrink-0 whitespace-nowrap text-[#12283c] min-h-[36px]">+ {q}</button>
                ))}
              </div>
              <div className={`flex items-end gap-2 rounded-2xl pl-4 pr-1.5 py-1.5 ${t.input}`}>
                <label htmlFor={`esc-reply-${id}`} className="sr-only">Balasan ke pengguna</label>
                <textarea
                  id={`esc-reply-${id}`}
                  value={reply}
                  onChange={(ev) => setReply(ev.target.value.slice(0, 2000))}
                  rows={2}
                  placeholder="Tulis balasan untuk pengguna…"
                  className="flex-1 min-w-0 bg-transparent text-base sm:text-sm outline-none py-2 resize-none"
                />
                <button type="submit" disabled={!reply.trim() || busy} aria-label="Kirim balasan" className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#12283c] text-[#f2efe6] shrink-0 disabled:opacity-30">
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}
          {handingBack ? (
            <HandbackConfirm id={id} draft={reply} onCancel={() => setHandingBack(false)} onDone={() => { setHandingBack(false); setReply(''); changed(); }} />
          ) : canResolve && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setHandingBack(true)} disabled={busy} className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-full px-3 font-mono text-[10px] font-bold tracking-wider ${t.action}`}>
                <Sparkles className="w-3.5 h-3.5 text-[#e62b2b]" aria-hidden="true" /> KEMBALIKAN KE AI
              </button>
              <button type="button" onClick={() => setResolving(true)} disabled={busy} className="min-h-[44px] rounded-full bg-[#e62b2b] text-white px-3 font-mono text-[10px] font-bold tracking-wider">
                SELESAI ✓
              </button>
            </div>
          )}
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
  // Lencana belum dibaca & tiket baru tanpa menunggu notifikasi.
  usePolling(true, LIST_POLL_MS, refetch);
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
            <button type="button" key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`chip-mono min-h-[36px] transition-colors ${filter === f.key ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="dash-item card-light !p-0 overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr] md:h-[min(760px,calc(100dvh-14rem))] md:min-h-[520px]">
        <aside className={`${openId ? 'hidden md:flex' : 'flex'} flex-col md:min-h-0 border-r ${t.divider} bg-white`} aria-label="Daftar tiket eskalasi">
          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto">
            {error && <div className="p-4"><ErrorState error={error} onRetry={refetch} compact /></div>}
            {loading && !data && !error && <div className="p-4"><SkeletonLines count={6} /></div>}
            {data && items.length === 0 && (
              <div className="p-6 text-center">
                <p className="font-black">{filter === 'open' ? 'Antrean kosong' : 'Belum ada tiket'}</p>
                <p className={`mt-1 text-[13px] leading-relaxed ${t.muted}`}>Tiket muncul saat pengguna memilih “Ya, hubungkan” di Tanya SUSI. Semua AgenSUSI aktif mendapat notifikasi.</p>
              </div>
            )}
            <TicketList items={items} openId={openId} onOpen={setOpenId} />
          </div>
          {data && data.total > PAGE_SIZE && (
            <div className="px-3 pb-3 shrink-0">
              <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ filter, page: p })} />
            </div>
          )}
        </aside>
        <section className={`${openId ? 'flex' : 'hidden md:flex'} flex-col md:min-h-0`} aria-label="Percakapan tiket">
          {openId ? (
            <EscalationDetail key={openId} id={openId} liveKey={liveKey} onChanged={changed} onBack={() => setOpenId(null)} />
          ) : (
            <div className="m-auto max-w-sm p-6 text-center">
              <p className="font-black">Pilih tiket</p>
              <p className={`mt-1 text-[13px] ${t.muted}`}>Transkrip, ringkasan, dan kolom balasan tampil di sini.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
