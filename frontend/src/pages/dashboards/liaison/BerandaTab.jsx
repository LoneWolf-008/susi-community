import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { SkeletonCard, SkeletonLines } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';
import { VisitCard } from './VisitsTab';
import { todayInput } from './visits';

function TargetBar({ label, value, target, color }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex justify-between font-mono text-[10px] font-bold mb-2"><span>{label}</span><span>{value} / {target}</span></div>
      <div className="h-3 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={target} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/** Beranda liaison: agenda hari ini, capaian bulan ini vs target (GET /liaison/summary), antrean eskalasi. */
export default function BerandaTab({ first, summaryQ, onRecord, onNewIntake, onChanged, onOpenVisits, onOpenEscalations }) {
  const agendaQ = useApi((signal) => api.get('/liaison/visits', { signal, query: { date: todayInput(), limit: 50 } }), []);
  const agenda = (agendaQ.data?.items || []).filter((v) => v.status !== 'TERDATA');
  const s = summaryQ.data;
  const changed = () => { agendaQ.refetch(); onChanged?.(); };

  return (
    <>
      <div className="dash-item card-light p-8 md:p-10 flex flex-wrap items-end justify-between gap-6 mb-6">
        <div>
          <p className="label-mono mb-2">Dasbor Lapangan</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Halo, Agen {first}.</h1>
          <p className="text-sm text-[#12283c]/60 max-w-xl leading-relaxed">Kunjungi komunitas, catat masalah mereka dengan bahasa mereka, lalu wakili mereka memilih talenta dan membenarkan hasilnya.</p>
        </div>
        <button type="button" onClick={onNewIntake} className="btn-pill btn-red">+ Catat Kebutuhan</button>
      </div>

      {summaryQ.error && <ErrorState error={summaryQ.error} onRetry={summaryQ.refetch} compact />}
      <div className="grid grid-cols-3 gap-px bg-[#12283c]/10 rounded-xl overflow-hidden border border-[#12283c]/10 mb-6">
        {[
          { v: s?.month.visits, l: 'KUNJUNGAN TERDATA BULAN INI' },
          { v: s?.month.intake, l: 'KEBUTUHAN DICATAT BULAN INI' },
          { v: s?.needs.in_progress, l: 'SEDANG DIKERJAKAN TALENTA' },
        ].map((item) => (
          <div key={item.l} className="dash-item bg-[#fdfcf7] p-6 hover:bg-[#e62b2b] hover:text-white transition-colors">
            <div className="text-4xl md:text-5xl font-black tabular-nums">{item.v ?? '—'}</div>
            <p className="label-mono mt-1">{item.l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="dash-item flex justify-between items-center gap-3">
            <h3 className="text-xl font-black">Agenda Hari Ini</h3>
            <button type="button" onClick={onOpenVisits} className="chip-mono text-[#12283c] hover:border-[#e62b2b]">SEMUA KUNJUNGAN →</button>
          </div>
          {agendaQ.error && <ErrorState error={agendaQ.error} onRetry={agendaQ.refetch} compact />}
          {agendaQ.loading && !agendaQ.data && <SkeletonCard />}
          {agendaQ.data && agenda.length === 0 && (
            <p className="dash-item card-light p-6 text-sm text-[#12283c]/60">Tidak ada kunjungan terjadwal hari ini. Jadwalkan dari tab Kunjungan, atau catat kebutuhan yang Anda terima lewat telepon.</p>
          )}
          {agenda.map((v) => <VisitCard key={v.id} visit={v} onRecord={onRecord} onChanged={changed} />)}
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="dash-item rounded-xl bg-[#12283c] text-[#f2efe6] p-7">
            <span className="label-mono !text-[#e62b2b] !opacity-100">TARGET BULANAN</span>
            <h3 className="text-xl font-black mt-1 mb-5">Capaian Anda</h3>
            {s ? (
              <>
                <TargetBar label="KUNJUNGAN TERDATA" value={s.month.visits} target={s.targets.visits_month} color="#e62b2b" />
                <TargetBar label="KEBUTUHAN DICATAT" value={s.month.intake} target={s.targets.intake_month} color="#c9ecd9" />
              </>
            ) : <SkeletonLines count={3} dark />}
          </div>
          {/* Pertanyaan Tanya SUSI yang diteruskan pengguna ke AgenSUSI (T13–T14). */}
          <div className={`dash-item card-light p-7 ${s?.escalations?.stale ? 'border-[#b45309]' : ''}`}>
            <span className="label-mono !text-[#e62b2b] !opacity-100">ANTREAN ESKALASI</span>
            <h3 className="text-xl font-black mt-1 mb-3">Pertanyaan warga</h3>
            {s ? (
              <>
                <p className="text-4xl font-black tracking-tight">{s.escalations.pending}<span className="text-sm font-bold text-[#12283c]/60 ml-2">menunggu</span></p>
                <p className="text-sm text-[#12283c]/60 leading-relaxed mt-1">
                  {s.escalations.mine} sedang Anda tangani
                  {s.escalations.stale > 0 && <strong className="text-[#b45309]"> · {s.escalations.stale} menunggu lebih dari 24 jam</strong>}
                </p>
                <button type="button" onClick={onOpenEscalations} className="btn-pill btn-navy w-full !py-3 mt-4 text-[10px]">Buka antrean →</button>
              </>
            ) : <SkeletonLines count={2} />}
          </div>
        </div>
      </div>
    </>
  );
}
