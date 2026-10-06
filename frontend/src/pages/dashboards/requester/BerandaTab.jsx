import { useState } from 'react';
import { projectStatus, moderationStatus, NEED_CATEGORY } from '../../../lib/statusMap';
import { formatDate, initialOf } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { BOARD_COLUMNS, pendingActions } from './board';

const FILTERS = ['SEMUA', ...Object.keys(NEED_CATEGORY)];
const STEPS = [
  'Ceritakan masalah komunitas dengan bahasa sehari-hari.',
  'Admin memeriksa dan menyetujui kebutuhan Anda.',
  'Sistem merekomendasikan talenta yang cocok — Anda yang memilih.',
];

/** Beranda Komunitas tanpa kebutuhan (U10): satu kartu, satu aksi utama. */
function EmptyHero({ first, title, createLabel, onCreate }) {
  return (
    <section data-beranda="kosong" className="dash-item card-light p-8 md:p-10">
      <p className="label-mono mb-2">{title}</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">Halo, {first}.</h1>
      <ol className="space-y-3 mb-7 max-w-xl">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3 text-sm">
            <span className="w-6 h-6 shrink-0 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center text-[11px] font-black">{i + 1}</span>
            <span className="leading-snug pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      {onCreate && <button type="button" onClick={onCreate} className="btn-pill btn-red min-h-[44px]">{createLabel}</button>}
      <p className="mt-5 text-xs text-[#12283c]/60 leading-relaxed max-w-xl">Pelamar selalu dinilai; talenta lain hanya disarankan bila mereka mengizinkan tampil di rekomendasi.</p>
    </section>
  );
}
const ACTION_TONE = {
  warning: 'bg-[#e62b2b] text-white',
  danger: 'bg-[#7a1a1f] text-white',
  info: 'bg-[#12283c] text-[#f2efe6]',
};

function BoardCard({ card, onOpen }) {
  const { need, project } = card;
  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      className="w-full text-left rounded-xl border border-[#12283c]/15 p-4 transition-all hover:-translate-y-0.5 hover:border-[#e62b2b] hover:shadow-[0_10px_25px_rgba(230,43,43,0.15)]"
    >
      <span className="chip-mono">{NEED_CATEGORY[need.category] || need.category}</span>
      <h4 className="font-black text-base leading-tight mt-2 mb-1">{need.title}</h4>
      <p className="text-[11px] text-[#12283c]/60 leading-relaxed mb-3 line-clamp-2">{need.summary || need.description}</p>

      {!project && (
        <div className="flex items-center gap-2 flex-wrap">
          {need.moderation_status !== 'APPROVED'
            ? <StatusChip status={moderationStatus(need.moderation_status)} />
            : <span className="font-mono text-[9px] font-bold opacity-60">{Number(need.applicants_waiting) > 0 ? `${need.applicants_waiting} PELAMAR MENUNGGU` : 'MENUNGGU TALENTA'}</span>}
        </div>
      )}

      {project && ['AGREEMENT', 'IN_PROGRESS', 'REVISION', 'DISPUTED'].includes(project.status) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center text-[10px] font-black">{initialOf(project.talent_name)}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black truncate">{project.talent_name}</p>
              <p className="font-mono text-[9px] opacity-50">{project.deadline ? `TENGGAT ${formatDate(project.deadline)}` : 'TANPA TENGGAT'}</p>
            </div>
          </div>
          <StatusChip status={projectStatus(project.status)} />
          <div className="h-2 rounded-full bg-[#12283c]/10 overflow-hidden mt-2"><div className="h-full rounded-full bg-[#e62b2b]" style={{ width: `${project.progress_pct}%` }} /></div>
        </div>
      )}
      {project?.status === 'AWAITING_VERIFICATION' && (
        <div className="rounded-lg bg-[#c9ecd9] p-3 font-mono text-[9px] font-bold text-[#12283c]">✓ {project.talent_name?.toUpperCase()} MENANDAI SELESAI · {formatDate(project.talent_marked_done_at)}</div>
      )}
      {project?.status === 'COMPLETED' && (
        <div className="rounded-lg bg-[#c9ecd9]/60 border border-[#12283c]/10 p-3">
          <p className="font-mono text-[9px] font-bold">✓ TERVERIFIKASI · {formatDate(project.community_verified_at)}</p>
          <p className="font-mono text-[9px] opacity-60 mt-1">OLEH {project.talent_name?.toUpperCase()} · REPUTASI +1</p>
        </div>
      )}
      <span className="block mt-3 font-mono text-[9px] font-bold text-[#e62b2b]">LIHAT DETAIL →</span>
    </button>
  );
}

/**
 * Papan kebutuhan & proyek. layout:
 *  - 'classic' (bawaan; dipakai AgenSUSI "Kebutuhan Tercatat"): kartu sapaan + tombol utama di atas,
 *    kartu "Belum ada kebutuhan" bila kosong, slot `top` di paling atas.
 *  - 'komunitas' (U10, Beranda Komunitas): kosong → satu kartu EmptyHero; berisi → sapaan satu baris,
 *    daftar kebutuhan dengan tombol ajukan sekunder di judul papan, lalu slot `bottom` (kartu AI).
 */
export default function BerandaTab({ layout = 'classic', first, cards, loading, error, onRetry, onOpen, onCreate, createLabel = '+ Ajukan Kebutuhan', title = 'Dasbor Komunitas', intro, top, bottom }) {
  const [filter, setFilter] = useState('SEMUA');
  const visible = cards.filter((c) => c.column && (filter === 'SEMUA' || c.need.category === filter));
  const actions = pendingActions(cards);
  const count = (col) => cards.filter((c) => c.column === col).length;
  const komunitas = layout === 'komunitas';
  const empty = !loading && !error && cards.length === 0;

  if (komunitas && empty) return <EmptyHero first={first} title={title} createLabel={createLabel} onCreate={onCreate} />;

  return (
    <>
      {!komunitas && top}
      {komunitas ? (
        <h1 className="dash-item text-2xl md:text-3xl font-black tracking-tight mb-5">Halo, {first}.</h1>
      ) : (
        <div className="dash-item card-light p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
          <div>
            <p className="label-mono mb-2">{title}</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, {first}.</h1>
            <p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed">{intro || 'Ceritakan masalah komunitasmu, pilih talenta yang cocok, lalu benarkan hasilnya setelah selesai.'}</p>
          </div>
          {onCreate && <button type="button" onClick={onCreate} className="btn-pill btn-red">{createLabel}</button>}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={onRetry} />}
      {loading && cards.length === 0 && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      )}

      {!komunitas && empty && (
        <EmptyState
          title="Belum ada kebutuhan"
          description="Ceritakan masalah komunitasmu dengan bahasa sehari-hari — misalnya “catatan iuran sering hilang”. Admin memeriksanya, lalu talenta IT bisa melamar."
          action={onCreate && <button type="button" onClick={onCreate} className="btn-pill btn-red">{createLabel}</button>}
        />
      )}

      {cards.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
            {[
              { t: count('ANTRIAN'), l: 'KEBUTUHAN AKTIF' },
              { t: count('DIPROSES') + count('MENUNGGU'), l: 'DALAM PROSES' },
              { t: count('SELESAI'), l: 'SELESAI' },
            ].map((s) => (
              <div key={s.l} className={`dash-item bg-[#fdfcf7] ${komunitas ? 'p-4 md:p-6' : 'p-6'} hover:bg-[#e62b2b] hover:text-white transition-colors`}>
                <div className="text-4xl md:text-5xl font-black tabular-nums">{s.t}</div>
                {/* Komunitas (U10): jarak huruf lebih rapat di ponsel agar label tidak meluber ke kolom sebelah. */}
                <p className={`label-mono mt-1 ${komunitas ? '!tracking-[0.12em] md:!tracking-[.35em] break-words' : ''}`}>{s.l}</p>
              </div>
            ))}
          </div>

          <section className="dash-item card-light p-6 md:p-8 mb-6">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
              <div><h2 className="text-2xl font-black">Perlu Tindakan</h2><p className="label-mono mt-1">HASIL KERJA, PELAMAR, DAN PERBAIKAN</p></div>
              <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{actions.length} ITEM</span>
            </div>
            {actions.length === 0
              ? <p className="rounded-xl border border-dashed border-[#12283c]/20 p-5 text-sm text-[#12283c]/60">Tidak ada yang perlu ditindaklanjuti sekarang. Anda akan mendapat notifikasi saat ada pelamar atau hasil kerja masuk.</p>
              : (
                <ul className="space-y-3">
                  {actions.map(({ card, tone, label }) => (
                    <li key={card.need.id}>
                      <button type="button" onClick={() => onOpen(card)} className="w-full text-left rounded-xl border border-[#12283c]/15 p-4 flex items-center justify-between gap-4 hover:border-[#e62b2b] transition-colors">
                        <div className="min-w-0">
                          <p className="font-black truncate">{card.need.title}</p>
                          <span className={`chip-mono border-0 mt-2 inline-block ${ACTION_TONE[tone]}`}>{label.toUpperCase()}</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-[#e62b2b] shrink-0">BUKA →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <div className="dash-item flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
              <div><h3 className="text-2xl font-black">Papan Kebutuhan & Proyek</h3><p className="label-mono mt-1">KLIK KARTU UNTUK DETAIL</p></div>
              {komunitas && onCreate && (
                <button type="button" onClick={onCreate} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-xs">{createLabel}</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((c) => (
                <button type="button" key={c} onClick={() => setFilter(c)} className={`chip-mono transition-colors ${filter === c ? 'border-0 bg-[#e62b2b] text-white' : 'text-[#12283c] hover:border-[#e62b2b]'}`}>{c === 'SEMUA' ? 'SEMUA' : NEED_CATEGORY[c].toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
            {BOARD_COLUMNS.map((col) => {
              const items = visible.filter((c) => c.column === col.id);
              return (
                <div key={col.id} className="dash-item card-light flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-[#12283c]/10">
                    <p className="font-mono text-[10px] font-bold">{col.label}</p>
                    <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">{items.length}</span>
                  </div>
                  <div className="p-4 space-y-4">
                    {items.map((c) => <BoardCard key={c.need.id} card={c} onOpen={onOpen} />)}
                    {items.length === 0 && <p className="text-center font-mono text-[10px] opacity-40 py-6">KOLOM KOSONG</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {komunitas && bottom && <div className="mt-6">{bottom}</div>}
        </>
      )}
    </>
  );
}
