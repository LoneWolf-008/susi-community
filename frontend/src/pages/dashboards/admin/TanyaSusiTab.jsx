import { useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useToast } from '../../../context/toastContext';
import { kbStatus, KB_AUDIENCE } from '../../../lib/statusMap';
import { formatDateTime, timeAgo } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import Modal from '../../../components/modals/Modal';
import MarkdownLite from '../../../components/chat/MarkdownLite';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import EskalasiTab from '../liaison/EskalasiTab';

// Admin Tanya SUSI (T14): statistik, basis pengetahuan (KB), pertanyaan belum terjawab, eskalasi.
// Entri aktif wajib bersumber (aturan isi KB); draft dari eskalasi ditinjau di sini sebelum aktif.

const PAGE_SIZE = 10;
const SECTIONS = [
  { id: 'kb', label: 'BASIS PENGETAHUAN' },
  { id: 'unanswered', label: 'BELUM TERJAWAB' },
  { id: 'escalations', label: 'ESKALASI' },
];
const KB_FILTERS = [
  { id: 'draft', label: 'DRAFT' },
  { id: 'active', label: 'AKTIF' },
  { id: 'archived', label: 'ARSIP' },
  { id: 'all', label: 'SEMUA' },
];
const STOP = new Set(['yang', 'dan', 'atau', 'untuk', 'dengan', 'bagaimana', 'gimana', 'apakah', 'kenapa', 'berapa', 'saya', 'kamu', 'bisa', 'cara', 'caranya', 'tidak', 'sudah', 'belum', 'kalau', 'dari', 'pada', 'akan', 'agar']);

/** Kata kunci awal dari pertanyaan pengguna (admin tetap bisa mengubahnya). */
const keywordsFrom = (question) => [...new Set(String(question).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)))].slice(0, 8).join(', ');

const usd = (n) => `$${Number(n || 0).toFixed(4)}`;

function Stats({ statsQ }) {
  const s = statsQ.data;
  if (statsQ.error) return <ErrorState error={statsQ.error} onRetry={statsQ.refetch} compact />;
  const items = s ? [
    { v: s.today.answers, l: 'JAWABAN HARI INI' },
    { v: s.today.llm, l: 'DIJAWAB AI (LLM)' },
    { v: s.today.answers - s.today.llm, l: 'DARI KB / CACHE / ATURAN' },
    { v: s.today.unanswered, l: 'BELUM TERJAWAB' },
    { v: `${s.today.thumbs_up} / ${s.today.thumbs_down}`, l: '👍 / 👎' },
    { v: s.escalations.pending + s.escalations.assigned, l: 'ESKALASI TERBUKA' },
  ] : [];
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-4">
        {(s ? items : Array.from({ length: 6 }, (_, i) => ({ v: '—', l: String(i) }))).map((item) => (
          <div key={item.l} className="dash-item bg-[#fdfcf7] p-5">
            <p className="text-3xl font-black tracking-tight">{item.v ?? '—'}</p>
            <p className="label-mono mt-1">{s ? item.l : ' '}</p>
          </div>
        ))}
      </div>
      {s && (
        <p className="dash-item font-mono text-[10px] font-bold mb-6 flex flex-wrap gap-x-4 gap-y-1 opacity-80">
          <span>BIAYA LLM HARI INI {usd(s.cost_today_usd)} / {usd(s.budget_usd)}</span>
          {s.budget_exceeded && <span className="text-[#e62b2b]">ANGGARAN HABIS → MODE HEMAT (JAWABAN DARI KB)</span>}
          <span>{s.llm.configured ? `MODEL ${s.llm.model}` : 'TANPA KEY LLM → SEMUA JAWABAN DARI KB'}</span>
          <span>KB: {s.kb.active} AKTIF · {s.kb.draft} DRAFT · {s.kb.archived} ARSIP</span>
        </p>
      )}
    </>
  );
}

function KbFormModal({ entry, initial, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    title: entry?.title ?? initial?.title ?? '',
    category: entry?.category ?? initial?.category ?? '',
    audience: entry?.audience ?? 'all',
    keywords: entry?.keywords ?? initial?.keywords ?? '',
    reply: entry?.reply ?? '',
    source: entry?.source ?? '',
    status: entry?.status ?? 'draft',
  }));
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const needsSource = form.status === 'active' && !form.source.trim();
  const valid = form.title.trim().length >= 3 && form.keywords.trim() && form.reply.trim().length >= 10 && !needsSource;

  const save = async () => {
    setBusy(true);
    const body = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      audience: form.audience,
      keywords: form.keywords.trim(),
      reply: form.reply.trim(),
      source: form.source.trim() || null,
      status: form.status,
    };
    try {
      if (entry) await api.patch(`/admin/kb/${entry.id}`, body);
      else await api.post('/admin/kb', body);
      toast.success(form.status === 'active' ? 'Tersimpan · langsung dipakai Tanya SUSI' : 'Tersimpan');
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={entry ? `Ubah entri #${entry.id}` : 'Entri KB baru'} eyebrow="BASIS PENGETAHUAN TANYA SUSI" onClose={onClose} busy={busy} size="max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="kb-title">Judul (pertanyaan/topik)</label>
          <input id="kb-title" value={form.title} onChange={set('title')} maxLength={200} className="input-line input-line-dark" />
        </div>
        <div>
          <label className="field-label" htmlFor="kb-category">Kategori (opsional)</label>
          <input id="kb-category" value={form.category} onChange={set('category')} maxLength={50} className="input-line input-line-dark" placeholder="mis. akun, alur, biaya" />
        </div>
        <div>
          <label className="field-label" htmlFor="kb-audience">Audiens</label>
          <select id="kb-audience" value={form.audience} onChange={set('audience')} className="input-line input-line-dark">
            {Object.entries(KB_AUDIENCE).map(([value, label]) => <option key={value} value={value} className="text-[#12283c]">{label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="kb-keywords">Kata kunci (pisahkan dengan koma, termasuk sinonim/bahasa sehari-hari)</label>
          <input id="kb-keywords" value={form.keywords} onChange={set('keywords')} maxLength={500} className="input-line input-line-dark" />
        </div>
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="kb-reply">Jawaban (dipakai langsung bila pertanyaan cocok; ringkas, ±100 kata)</label>
          <textarea id="kb-reply" value={form.reply} onChange={set('reply')} maxLength={2000} className="input-line input-line-dark h-32 resize-none" />
          <p className="font-mono text-[9px] opacity-60 mt-1">{form.reply.trim().split(/\s+/).filter(Boolean).length} KATA</p>
        </div>
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="kb-source">Sumber (wajib untuk entri aktif: dokumen atau tiket eskalasi)</label>
          <input id="kb-source" value={form.source} onChange={set('source')} maxLength={255} className="input-line input-line-dark" placeholder="mis. PRD §7; Proposal §2.1" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Status">
        {[['draft', 'Draft', 'Belum dipakai chatbot'], ['active', 'Aktif', 'Langsung dipakai Tanya SUSI']].map(([value, title, sub]) => (
          <button type="button" key={value} role="radio" aria-checked={form.status === value} onClick={() => setForm((f) => ({ ...f, status: value }))} className={`rounded-xl border p-3 text-left transition-colors ${form.status === value ? 'border-[#e62b2b] bg-[#e62b2b]/15' : 'border-white/15 hover:bg-white/5'}`}>
            <p className="font-mono text-[10px] font-black uppercase tracking-widest">{form.status === value ? '● ' : '○ '}{title}</p>
            <p className="text-[11px] opacity-70 mt-1">{sub}</p>
          </button>
        ))}
      </div>
      {needsSource && <p role="alert" className="mt-3 text-[11px] font-bold text-[#ff9b9b]">Isi sumber dulu: isi KB tidak boleh dikarang.</p>}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button type="button" onClick={onClose} disabled={busy} className="btn-pill btn-ghost-light">Batal</button>
        <button type="button" onClick={save} disabled={!valid || busy} className="btn-pill btn-red disabled:opacity-40">{busy ? 'Menyimpan…' : 'Simpan →'}</button>
      </div>
    </Modal>
  );
}

function KbSection({ onChanged, editor, setEditor }) {
  const toast = useToast();
  const [filter, setFilter] = useState('draft');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 350);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const pagingKey = `${filter}|${query}`;
  const page = paging.key === pagingKey ? paging.page : 1;
  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/admin/kb', { signal, query: { status: filter, search: query, page, limit: PAGE_SIZE } }),
    [filter, query, page],
  );
  const items = data?.items || [];
  const [busyId, setBusyId] = useState(null);
  const changed = () => { refetch(); onChanged(); };

  const setStatus = async (entry, status) => {
    if (status === 'active' && !entry.source) {
      toast.error('Entri ini belum punya sumber. Lengkapi sumbernya dulu.');
      setEditor({ entry });
      return;
    }
    setBusyId(entry.id);
    try {
      await api.patch(`/admin/kb/${entry.id}`, { status });
      toast.success({ active: 'Disetujui · langsung dipakai Tanya SUSI', archived: 'Diarsipkan', draft: 'Dijadikan draft' }[status]);
      changed();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="dash-item flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {KB_FILTERS.map((f) => (
            <button type="button" key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`chip-mono transition-colors ${filter === f.id ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>
              {f.label}{data?.counts && f.id !== 'all' ? ` (${data.counts[f.id]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-1 min-w-[220px] max-w-md">
          <label htmlFor="kb-search" className="sr-only">Cari entri KB</label>
          <input id="kb-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, kata kunci, jawaban…" className="input-line flex-1" />
          <button type="button" onClick={() => setEditor({})} className="btn-pill btn-red !py-2.5 text-[10px] shrink-0">+ Entri baru</button>
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState
          icon="✓"
          title={filter === 'draft' ? 'Tidak ada draft untuk ditinjau' : 'Tidak ada entri'}
          description={filter === 'draft' ? 'Draft muncul dari penyelesaian eskalasi AgenSUSI atau entri baru yang belum disetujui.' : 'Ubah filter atau kata pencarian.'}
        />
      )}
      <div className="space-y-4">
        {items.map((entry) => (
          <article key={entry.id} className="dash-item card-light p-6">
            <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
              <div className="min-w-0">
                <h3 className="font-black text-lg leading-tight">{entry.title || '(tanpa judul)'}</h3>
                <p className="label-mono mt-1">
                  #{entry.id} · {KB_AUDIENCE[entry.audience] || entry.audience}{entry.category ? ` · ${entry.category}` : ''} · DIUBAH {timeAgo(entry.updated_at).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {entry.escalation_id && <span className="chip-mono border-0 bg-[#0e7490] text-white">DARI ESKALASI #{entry.escalation_id}</span>}
                <StatusChip status={kbStatus(entry.status)} />
              </div>
            </div>
            <div className="text-sm text-[#12283c]/80 rounded-xl bg-[#12283c]/5 p-4"><MarkdownLite text={entry.reply} /></div>
            <p className="font-mono text-[10px] opacity-60 mt-2 break-words">KATA KUNCI: {entry.keywords}</p>
            <p className={`font-mono text-[10px] mt-1 ${entry.source ? 'opacity-60' : 'text-[#e62b2b] font-bold'}`}>SUMBER: {entry.source || 'BELUM ADA — WAJIB SEBELUM DIAKTIFKAN'}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="button" onClick={() => setEditor({ entry })} className="chip-mono text-[#12283c] hover:bg-[#12283c] hover:text-[#f2efe6] transition-colors">UBAH</button>
              {entry.status === 'draft' && <button type="button" disabled={busyId === entry.id} onClick={() => setStatus(entry, 'active')} className="chip-mono border-0 bg-[#15803d] text-white disabled:opacity-40">✓ SETUJUI & AKTIFKAN</button>}
              {entry.status === 'active' && <button type="button" disabled={busyId === entry.id} onClick={() => setStatus(entry, 'archived')} className="chip-mono text-[#12283c] disabled:opacity-40">ARSIPKAN</button>}
              {entry.status === 'archived' && <button type="button" disabled={busyId === entry.id} onClick={() => setStatus(entry, 'active')} className="chip-mono text-[#12283c] disabled:opacity-40">AKTIFKAN LAGI</button>}
            </div>
          </article>
        ))}
      </div>
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPage={(p) => setPaging({ key: pagingKey, page: p })} />}
      {editor && <KbFormModal entry={editor.entry} initial={editor.initial} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); changed(); }} />}
    </>
  );
}

function UnansweredSection({ onCreate }) {
  const { data, loading, error, refetch } = useApi((signal) => api.get('/admin/chatbot/unanswered', { signal }), []);
  const items = data?.items || [];
  return (
    <>
      <p className="dash-item text-sm text-[#12283c]/60 mb-5 max-w-2xl">
        Pertanyaan {data ? `${data.days} hari terakhir` : 'terbaru'} yang belum terjawab basis pengetahuan atau dinilai 👎. Tulis entri KB bersumber agar pertanyaan serupa terjawab tanpa eskalasi.
      </p>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <SkeletonCard />}
      {data && items.length === 0 && <EmptyState icon="✓" title="Semua pertanyaan terjawab" description="Belum ada pertanyaan yang lolos dari basis pengetahuan." />}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.question} className="dash-item card-light p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-bold leading-snug">“{item.question}”</p>
              <p className="label-mono mt-1">
                {item.count}× DITANYAKAN{item.unanswered ? ` · ${item.unanswered} TAK TERJAWAB` : ''}{item.thumbs_down ? ` · ${item.thumbs_down}× 👎` : ''} · TERAKHIR {formatDateTime(item.last_at)}
              </p>
            </div>
            <button type="button" onClick={() => onCreate(item.question)} className="btn-pill btn-navy !py-2.5 text-[10px]">Buat artikel KB →</button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Tab admin Tanya SUSI. */
export default function TanyaSusiTab({ onChanged = () => {} }) {
  const [section, setSection] = useState('kb');
  const [editor, setEditor] = useState(null); // { entry? , initial? }
  const statsQ = useApi((signal) => api.get('/admin/chatbot/stats', { signal }), []);
  const changed = () => { statsQ.refetch(); onChanged(); };

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Tanya SUSI</h1>
          <p className="label-mono mt-2">ASISTEN AI · BASIS PENGETAHUAN · ESKALASI</p>
        </div>
      </div>
      <Stats statsQ={statsQ} />
      <div className="dash-item flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Bagian Tanya SUSI">
        {SECTIONS.map((s) => (
          <button type="button" key={s.id} role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)} className={`chip-mono transition-colors ${section === s.id ? 'border-0 bg-[#12283c] text-[#f2efe6]' : 'text-[#12283c] hover:border-[#12283c]'}`}>{s.label}</button>
        ))}
      </div>
      {section === 'kb' && <KbSection onChanged={changed} editor={editor} setEditor={setEditor} />}
      {section === 'unanswered' && (
        <>
          <UnansweredSection onCreate={(question) => setEditor({ initial: { title: question, keywords: keywordsFrom(question) } })} />
          {editor && <KbFormModal entry={editor.entry} initial={editor.initial} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); changed(); setSection('kb'); }} />}
        </>
      )}
      {section === 'escalations' && <EskalasiTab embedded onChanged={changed} />}
    </>
  );
}
