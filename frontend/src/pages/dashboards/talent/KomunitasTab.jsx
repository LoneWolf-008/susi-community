import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { initialOf } from '../../../lib/format';
import Modal from '../../../components/modals/Modal';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';

// Talenta bergabung ke komunitas lewat persetujuan pengurus (U1). Anggota yang disetujui bisa
// menulis di mading atas nama komunitas itu.

const STATUS = {
  ACTIVE: { label: 'ANGGOTA', cls: 'border-0 bg-[#c9ecd9] text-[#12283c]' },
  PENDING: { label: 'MENUNGGU', cls: 'border-0 bg-[#fde68a] text-[#12283c]' },
  REJECTED: { label: 'DITOLAK', cls: 'text-[#12283c]/60' },
};
const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'ACTIVE', label: 'Anggota' },
  { id: 'PENDING', label: 'Menunggu' },
];

function JoinModal({ community, onClose, onSent }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post(`/communities/${community.id}/join`, { message: message.trim() || undefined });
      toast.success('Permintaan terkirim. Pengurus akan memutuskan.');
      onSent();
    } catch (err) {
      toast.error(err.message);
      setSending(false);
    }
  };

  return (
    <Modal title={`Gabung ${community.name}`} eyebrow="AJUKAN GABUNG" onClose={onClose} busy={sending} size="max-w-lg">
      <form onSubmit={send} className="space-y-4">
        <p className="text-sm text-[#f2efe6]/75">
          Pengurus komunitas akan menerima notifikasi dan memutuskan permintaan Anda. Setelah disetujui, Anda bisa menulis di mading atas nama komunitas ini.
        </p>
        <div>
          <label className="field-label" htmlFor="join-message">Pesan singkat untuk pengurus (opsional)</label>
          <textarea
            id="join-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 300))}
            className="input-line input-line-dark !text-base h-24 resize-none"
            placeholder="Mis. Saya tinggal di dekat sini dan ingin bantu pencatatan."
          />
          <p className="font-mono text-[10px] opacity-60 mt-1">{message.length}/300</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={sending} className="btn-pill btn-ghost-light !py-3 min-h-[44px] flex-1 text-xs">Batal</button>
          <button type="submit" disabled={sending} className="btn-pill btn-red !py-3 min-h-[44px] flex-1 text-xs">{sending ? 'Mengirim…' : 'Kirim permintaan →'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function KomunitasTab({ liveKey = 0 }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [joining, setJoining] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Cari setelah berhenti mengetik sebentar.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error, refetch } = useApi(
    (signal) => api.get('/communities', { signal, query: { limit: 50, search: query || undefined } }),
    [query, liveKey],
  );
  const all = data?.items || [];
  const items = filter === 'all' ? all : all.filter((c) => c.membership_status === filter);

  const leave = async (c) => {
    setBusyId(c.id);
    try {
      await api.delete(`/communities/${c.id}/join`);
      toast.success(c.membership_status === 'PENDING' ? 'Permintaan dibatalkan' : `Anda keluar dari ${c.name}`);
      setConfirmLeave(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const action = (c) => {
    if (busyId === c.id) return <span className="font-mono text-xs">…</span>;
    if (c.membership_status === 'ACTIVE') {
      return confirmLeave === c.id ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirmLeave(null)} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-[11px]">Batal</button>
          <button type="button" onClick={() => leave(c)} className="btn-pill btn-red !py-2 !px-4 min-h-[44px] text-[11px]">Ya, keluar</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmLeave(c.id)} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-[11px]">Keluar</button>
      );
    }
    if (c.membership_status === 'PENDING') {
      return <button type="button" onClick={() => leave(c)} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-[11px]">Batalkan</button>;
    }
    return (
      <button type="button" onClick={() => setJoining(c)} className="btn-pill btn-navy !py-2 !px-4 min-h-[44px] text-[11px]">
        {c.membership_status === 'REJECTED' ? 'Ajukan lagi' : 'Ajukan gabung'}
      </button>
    );
  };

  return (
    <>
      <div className="dash-item mb-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Komunitas</h1>
        <p className="text-sm text-[#12283c]/60 mt-2 max-w-2xl">
          Ajukan gabung ke komunitas yang ingin Anda bantu. Setelah pengurus menyetujui, Anda bisa menulis di mading atas nama komunitas itu.
        </p>
      </div>

      <div className="dash-item flex flex-col sm:flex-row gap-3 sm:items-end mb-5">
        <div className="flex-1">
          <label className="field-label" htmlFor="talent-comm-search">Cari komunitas</label>
          <input id="talent-comm-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-line !text-base" placeholder="Nama atau kegiatan komunitas…" />
        </div>
        <div className="flex gap-2" role="group" aria-label="Saring status keanggotaan">
          {FILTERS.map((f) => (
            <button type="button" key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`rounded-full px-4 min-h-[44px] text-[11px] font-black uppercase tracking-wider transition-colors ${filter === f.id ? 'bg-[#12283c] text-[#f2efe6]' : 'border border-[#12283c]/20 hover:border-[#12283c]'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState
          title={filter === 'all' ? 'Komunitas tidak ditemukan' : filter === 'ACTIVE' ? 'Belum menjadi anggota komunitas' : 'Tidak ada permintaan yang menunggu'}
          description={filter === 'all' ? 'Coba kata kunci lain.' : 'Cari komunitas di sekitar Anda lalu ajukan gabung.'}
        />
      )}
      <ul className="space-y-3">
        {items.map((c) => {
          const status = STATUS[c.membership_status];
          return (
            <li key={c.id} className="dash-item card-light p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${c.is_member ? 'bg-[#c9ecd9] text-[#12283c]' : 'bg-[#e62b2b] text-white'}`} aria-hidden="true">{c.is_member ? '★' : initialOf(c.name)}</span>
                <div className="min-w-0">
                  <p className="font-black text-sm break-words">{c.name}</p>
                  <p className="font-mono text-[9px] opacity-60">{c.type} · {c.members_count} ANGGOTA{c.sector ? ` · ${c.sector}` : ''}{c.source === 'AGENSUSI' ? ' · DICATAT AGENSUSI' : ''}</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3">
                {status && <span className={`chip-mono ${status.cls}`}>{status.label}</span>}
                {action(c)}
              </div>
            </li>
          );
        })}
      </ul>

      {joining && <JoinModal community={joining} onClose={() => setJoining(null)} onSent={() => { setJoining(null); refetch(); }} />}
    </>
  );
}
