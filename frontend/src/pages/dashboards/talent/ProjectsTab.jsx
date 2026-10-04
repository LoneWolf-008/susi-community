import { projectStatus } from '../../../lib/statusMap';
import { formatDate } from '../../../lib/format';
import StatusChip from '../../../components/common/StatusChip';
import ProjSteps from '../../../components/common/ProjSteps';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';

// Ajakan per status, dari sudut pandang talenta.
const NEXT_STEP = {
  AGREEMENT: { text: 'Tinjau & setujui kesepakatan', urgent: true },
  IN_PROGRESS: { text: 'Kirim hasil bila sudah selesai' },
  REVISION: { text: 'Komunitas minta perbaikan — kirim ulang', urgent: true },
  AWAITING_VERIFICATION: { text: 'Menunggu komunitas memverifikasi' },
  DISPUTED: { text: 'Sedang dimediasi admin — isi pernyataan', urgent: true },
  COMPLETED: { text: 'Terverifikasi · reputasi +1' },
  CANCELLED: { text: 'Anda mundur dari proyek ini' },
};
const ORDER = ['AGREEMENT', 'REVISION', 'DISPUTED', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED'];

/** Daftar proyek talenta (data dari /projects/mine, dimuat di shell). */
export default function ProjectsTab({ query, onOpen, onBrowse }) {
  const { data, loading, error, refetch } = query;
  const items = [...(data?.items || [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <>
      <div className="dash-item mb-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Proyek Saya</h1>
        <p className="label-mono mt-2">YANG PERLU TINDAKAN DITAMPILKAN PALING ATAS</p>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !data && !error && <div className="space-y-6"><SkeletonCard /><SkeletonCard /></div>}
      {data && items.length === 0 && (
        <EmptyState
          title="Belum ada proyek"
          description="Proyek muncul di sini setelah komunitas memilih lamaran Anda. Ajukan diri ke kebutuhan yang sesuai keahlian Anda."
          action={<button type="button" onClick={onBrowse} className="btn-pill btn-red">Lihat katalog →</button>}
        />
      )}
      <div className="space-y-6">
        {items.map((p) => {
          const next = NEXT_STEP[p.status];
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => onOpen(p.id)}
              className={`dash-item card-light p-7 w-full text-left hover:border-[#e62b2b] transition-colors ${p.status === 'CANCELLED' ? 'opacity-60' : ''}`}
            >
              <div className="flex justify-between items-start flex-wrap gap-3 mb-5">
                <div>
                  <h3 className="text-2xl font-black leading-tight">{p.project_title}</h3>
                  <p className="font-mono text-[10px] opacity-50 mt-1">{p.community_name || 'Tanpa komunitas'} · {p.deadline ? `TENGGAT ${formatDate(p.deadline)}` : 'TANPA TENGGAT'}</p>
                </div>
                <StatusChip status={projectStatus(p.status)} />
              </div>
              <div className="grid grid-cols-12 gap-6 items-center">
                <div className="col-span-12 lg:col-span-7">
                  <p className="field-label">Lingkup</p>
                  <p className="text-sm text-[#12283c]/70 leading-relaxed line-clamp-2">{p.scope}</p>
                </div>
                <div className="col-span-12 lg:col-span-5">
                  <ProjSteps status={p.status} />
                  {next && (
                    <p className={`mt-4 rounded-full py-2.5 px-4 text-center font-mono text-[10px] font-bold ${next.urgent ? 'bg-[#e62b2b] text-white' : 'border border-[#12283c]/20'}`}>
                      {next.text.toUpperCase()} →
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
