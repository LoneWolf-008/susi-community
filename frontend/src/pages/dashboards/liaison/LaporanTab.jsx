import MiniBars from '../../../components/common/MiniBars';
import StatusChip from '../../../components/common/StatusChip';
import { SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import { moderationStatus, needStatus, projectStatus, NEED_CATEGORY } from '../../../lib/statusMap';
import { formatDate, toDateInput } from '../../../lib/format';

const statusOf = ({ need, project }) => (project
  ? projectStatus(project.status)
  : need.moderation_status !== 'APPROVED' ? moderationStatus(need.moderation_status) : needStatus(need.status));

// BOM agar Excel membaca UTF-8 dengan benar.
const BOM = String.fromCharCode(0xfeff);
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Unduh daftar kebutuhan yang dicatat sebagai CSV (dibuat di peramban, tanpa server). */
function downloadCsv(cards) {
  const header = ['Tanggal', 'Komunitas', 'Kebutuhan', 'Kategori', 'Status', 'Talenta'];
  const rows = cards.map((c) => [
    toDateInput(c.need.created_at), c.need.community_name, c.need.title,
    NEED_CATEGORY[c.need.category] || c.need.category, statusOf(c).label, c.project?.talent_name || '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `laporan-agensusi-${toDateInput(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Laporan kinerja: kunjungan per minggu, capaian target, dan kebutuhan yang dicatat. */
export default function LaporanTab({ summaryQ, cards, loading, error, onRetry }) {
  const s = summaryQ.data;
  const weeks = s ? s.weekly_visits.map((v, i) => ({ l: i === 3 ? 'INI' : `-${3 - i}`, v })) : [];
  const sorted = [...cards].sort((a, b) => new Date(b.need.created_at) - new Date(a.need.created_at));

  return (
    <>
      <div className="dash-item flex items-end justify-between flex-wrap gap-4 mb-6">
        <div><h1 className="text-4xl md:text-5xl font-black tracking-tight">Laporan</h1><p className="label-mono mt-2">KINERJA LAPANGAN ANDA</p></div>
        <button type="button" onClick={() => downloadCsv(sorted)} disabled={sorted.length === 0} className="btn-pill btn-ghost-dark disabled:opacity-40">⬇ Unduh CSV</button>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="dash-item card-light col-span-12 lg:col-span-5 p-7">
          <h3 className="text-xl font-black mb-1">Kunjungan Terdata / Minggu</h3>
          <p className="label-mono mb-5">4 MINGGU TERAKHIR</p>
          {summaryQ.error && <ErrorState error={summaryQ.error} onRetry={summaryQ.refetch} compact />}
          {s ? <MiniBars data={weeks} /> : <SkeletonLines count={4} />}
          {s && (
            <div className="mt-6 space-y-2 font-mono text-[10px] font-bold">
              <div className="flex justify-between"><span>TOTAL KEBUTUHAN DICATAT</span><span>{s.needs.total}</span></div>
              <div className="flex justify-between"><span>MENUNGGU MODERASI</span><span>{s.needs.pending}</span></div>
              <div className="flex justify-between"><span>TERBUKA DI KATALOG</span><span>{s.needs.open}</span></div>
              <div className="flex justify-between"><span>DIKERJAKAN / SELESAI</span><span>{s.needs.in_progress} / {s.needs.completed}</span></div>
            </div>
          )}
        </div>
        <div className="dash-item card-light col-span-12 lg:col-span-7 p-7">
          <h3 className="text-xl font-black mb-5">Kebutuhan yang Anda Catat</h3>
          {error && <ErrorState error={error} onRetry={onRetry} compact />}
          {loading && cards.length === 0 && !error && <SkeletonLines count={5} />}
          {!loading && !error && cards.length === 0 && <p className="text-sm text-[#12283c]/60">Belum ada. Kebutuhan yang Anda catat dari kunjungan akan terdaftar di sini.</p>}
          {sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#12283c]/15">
                    {['KOMUNITAS', 'DICATAT', 'KEBUTUHAN', 'STATUS'].map((h, i) => <th key={h} className={`py-3 pr-4 label-mono ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#12283c]/10">
                  {sorted.map((c) => (
                    <tr key={c.need.id}>
                      <td className="py-4 pr-4 font-bold">{c.need.community_name || '—'}</td>
                      <td className="py-4 pr-4 text-xs opacity-70 whitespace-nowrap">{formatDate(c.need.created_at)}</td>
                      <td className="py-4 pr-4 text-xs opacity-70">{c.need.title}</td>
                      <td className="py-4 text-right"><StatusChip status={statusOf(c)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
