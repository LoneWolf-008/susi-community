import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../context/toastContext';
import { NEED_CATEGORY, NEED_SOURCE, applicationStatus } from '../../../lib/statusMap';
import { initialOf, timeAgo } from '../../../lib/format';
import StatusChip, { TagChip } from '../../../components/common/StatusChip';
import GoogleMapsEmbed from '../../../components/common/GoogleMapsEmbed';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ui/ErrorState';

const MAX_MESSAGE = 2000;
const APPLIED_COPY = {
  MENUNGGU: { title: 'Lamaran terkirim', body: 'Komunitas sedang menimbang pelamar. Anda akan mendapat notifikasi saat ada keputusan.' },
  DITERIMA: { title: 'Anda terpilih!', body: 'Tinjau dan setujui kesepakatan di Proyek Saya untuk mulai bekerja.' },
  DITOLAK: { title: 'Belum terpilih kali ini', body: 'Komunitas memilih pelamar lain. Terus lengkapi profil dan coba kebutuhan lain.' },
};

/**
 * Detail kebutuhan dari katalog + form lamaran (POST /applications/needs/:id).
 * `focusApply`: dibuka dari tombol "Lamar" rekomendasi → gulir & fokus ke form lamaran.
 */
export default function NeedView({ needId, liveKey = 0, focusApply = false, onBack, onApplied, onOpenHistory, onOpenProjects }) {
  const toast = useToast();
  const { data: need, loading, error, refetch } = useApi((signal) => api.get(`/needs/${needId}`, { signal }), [needId, liveKey]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const loaded = Boolean(need);

  useEffect(() => {
    if (!focusApply || !loaded) return;
    const field = document.getElementById('apply-message');
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus({ preventScroll: true });
  }, [focusApply, loaded]);

  const apply = async (e) => {
    e.preventDefault();
    setSending(true);
    setFormError('');
    try {
      await api.post(`/applications/needs/${needId}`, { message: message.trim() || null });
      toast.success('Lamaran terkirim. Komunitas akan meninjau rekam jejak Anda.');
      setMessage('');
      refetch();
      onApplied?.();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  };

  const back = (
    <div className="dash-item mb-6">
      <button type="button" onClick={onBack} className="btn-pill btn-ghost-dark !py-3 !px-5 text-[10px]">← KEMBALI KE KATALOG</button>
    </div>
  );
  if (error) return <>{back}<ErrorState error={error} onRetry={refetch} /></>;
  if (loading && !need) return <>{back}<div className="space-y-6"><SkeletonCard /><SkeletonCard /></div></>;

  const applied = need.my_application_status;
  const point = need.lat != null && need.lng != null ? { lat: Number(need.lat), lng: Number(need.lng) } : null;
  const open = need.status === 'OPEN' && need.moderation_status === 'APPROVED';

  return (
    <>
      {back}
      <div className="dash-item card-light p-8 md:p-10 mb-6">
        <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <TagChip>{NEED_CATEGORY[need.category] || need.category}</TagChip>
            <TagChip>{NEED_SOURCE[need.source] || need.source}</TagChip>
          </div>
          <span className="font-mono text-[9px] opacity-50">DIAJUKAN {timeAgo(need.created_at).toUpperCase()}</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95] mb-6 break-words">{need.title}</h1>
        {need.my_invite_status === 'SENT' && !applied && (
          <p className="mb-6 rounded-xl bg-[#e62b2b] text-white px-4 py-3 text-sm font-bold">✉ Anda diundang melamar oleh pemilik kebutuhan ini. Lamar bila Anda tertarik — keputusan tetap di tangan Anda.</p>
        )}
        <p className="label-mono !text-[#e62b2b] !opacity-100 mb-3">MASALAH YANG DIALAMI KOMUNITAS</p>
        <p className="text-sm md:text-base leading-relaxed text-[#12283c]/80 max-w-3xl mb-6 whitespace-pre-line">{need.description}</p>
        {need.skills?.length > 0 && <div className="flex flex-wrap gap-2">{need.skills.map((s) => <span key={s.id} className="chip-mono">{s.name}</span>)}</div>}
      </div>

      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="dash-item rounded-xl bg-[#12283c] text-[#f2efe6] p-7 h-full">
            <p className="label-mono !text-[#e62b2b] !opacity-100 mb-4">KOMUNITAS</p>
            <div className="w-16 h-16 rounded-2xl bg-[#e62b2b] flex items-center justify-center text-2xl font-black mb-4">{initialOf(need.community_name || need.requester_name)}</div>
            <h3 className="text-2xl font-black leading-tight">{need.community_name || need.requester_name || 'Warga'}</h3>
            {need.leader_name && <p className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">KETUA: {need.leader_name}</p>}
            {need.members_count != null && <div className="mt-5 pt-5 border-t border-white/15 font-mono text-xs opacity-70">{need.members_count} ANGGOTA</div>}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <div className="dash-item card-light p-7 h-full">
            <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
              <p className="label-mono">LOKASI</p>
              {need.sector && <span className="chip-mono border-0 bg-[#12283c] text-[#f2efe6]">SEKTOR {need.sector}</span>}
            </div>
            {point ? (
              <>
                <div className="relative z-0 rounded-xl border border-[#12283c]/15 h-[240px] overflow-hidden"><GoogleMapsEmbed lat={point.lat} lng={point.lng} title={`Peta lokasi ${need.title}`} /></div>
                {need.address && <p className="font-mono text-[10px] opacity-60 mt-3">📍 {need.address}</p>}
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`} target="_blank" rel="noreferrer" className="inline-block mt-2 font-mono text-[10px] font-bold text-[#e62b2b] underline">BUKA RUTE GOOGLE MAPS ↗</a>
              </>
            ) : <p className="text-sm text-[#12283c]/60">Lokasi belum ditandai. Detail tempat bisa disepakati setelah Anda terpilih.</p>}
          </div>
        </div>
      </div>

      <div className="dash-item card-light p-7">
        {applied ? (
          <div className="text-center py-6">
            <div className="inline-flex w-16 h-16 rounded-full bg-[#c9ecd9] text-[#12283c] items-center justify-center text-3xl font-black mb-4">✓</div>
            <div className="mb-2"><StatusChip status={applicationStatus(applied)} /></div>
            <h3 className="text-xl font-black mb-1">{APPLIED_COPY[applied]?.title}</h3>
            <p className="text-xs text-[#12283c]/60 mb-5 max-w-md mx-auto">{APPLIED_COPY[applied]?.body}</p>
            {applied === 'DITERIMA'
              ? <button type="button" onClick={onOpenProjects} className="btn-pill btn-red !py-3 text-[10px]">KE PROYEK SAYA →</button>
              : <button type="button" onClick={onOpenHistory} className="btn-pill btn-ghost-dark !py-3 text-[10px]">LIHAT HISTORI →</button>}
          </div>
        ) : !open ? (
          <p className="text-sm text-[#12283c]/70 text-center py-4">Kebutuhan ini sudah tidak menerima lamaran.</p>
        ) : (
          <form onSubmit={apply}>
            <h3 className="text-xl font-black mb-1">Ajukan diri untuk kebutuhan ini</h3>
            <p className="text-xs text-[#12283c]/60 mb-4">Komunitas melihat pesan ini bersama keahlian, testimoni, dan jumlah proyek terverifikasi Anda.</p>
            <label className="field-label" htmlFor="apply-message">Pesan singkat (opsional)</label>
            <textarea id="apply-message" value={message} onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))} className="input-line h-28 resize-none" placeholder="Mis. Saya pernah membuat rekap iuran di Google Sheets dan bisa mengajari bendahara memakainya." />
            <p className="font-mono text-[9px] opacity-50 mt-1 text-right">{message.length}/{MAX_MESSAGE}</p>
            {formError && <p role="alert" className="mt-3 rounded-lg bg-[#e62b2b] text-white p-3 text-xs font-bold">⚠ {formError}</p>}
            <button type="submit" disabled={sending} className="btn-pill btn-red w-full mt-4 disabled:opacity-60">{sending ? 'Mengirim…' : 'Kirim lamaran →'}</button>
          </form>
        )}
      </div>
    </>
  );
}
