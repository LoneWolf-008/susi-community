import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import AiCard, { AiPanel, AiPersonalizationOff, AiCardSkeleton, AiCardError } from '../../../components/recommendation/AiCard';

const MAX_NEEDS = 10; // satu panggilan /recommendations/talents per kebutuhan terbuka (di-cache 60 dtk di BE)

const STEPS = [
  'Ceritakan masalah komunitas dengan bahasa sehari-hari.',
  'Admin memeriksa dan menyetujui kebutuhan Anda.',
  'Sistem merekomendasikan talenta yang cocok — Anda yang memilih.',
];

/** Kebutuhan baru: jelaskan manfaat rekomendasi + ajakan mengajukan. */
function Intro({ onCreate }) {
  return (
    <AiPanel>
      <p className="font-black text-lg mb-1">Setelah kebutuhan disetujui, sistem merekomendasikan talenta yang cocok.</p>
      <p className="text-sm text-[#12283c]/70 leading-relaxed mb-4">Skornya dihitung dari keahlian, pengalaman, dan wilayah talenta, lengkap dengan alasannya. Anda bisa mengundang talenta yang paling sesuai untuk melamar.</p>
      <ol className="space-y-2 mb-5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3 text-sm">
            <span className="w-6 h-6 shrink-0 rounded-full bg-[#12283c] text-[#f2efe6] flex items-center justify-center text-[11px] font-black">{i + 1}</span>
            <span className="leading-snug pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      {onCreate && <button type="button" onClick={onCreate} className="btn-pill btn-red !py-3 min-h-[44px] text-xs">+ Ajukan Kebutuhan</button>}
    </AiPanel>
  );
}

/**
 * Kartu "Rekomendasi AI" komunitas (paling atas Beranda). Tanpa kebutuhan: manfaat + Ajukan
 * Kebutuhan. Dengan kebutuhan: "N kebutuhan punya rekomendasi talenta" dari /recommendations/talents
 * per kebutuhan terbuka, dengan tautan ke tiap kebutuhan. Hanya talenta yang mengizinkan
 * show_in_recommendations yang disarankan (disaring di BE); allows_ai_personalization mati = tidak memuat.
 */
export default function RequesterAiCard({ needs, needsLoading, needsError, onRetryNeeds, onOpenNeed, onCreate, onOpenSettings }) {
  const settingsQ = useApi((signal) => api.get('/settings', { signal }), []);
  const personalize = settingsQ.data ? Number(settingsQ.data.allows_ai_personalization) === 1 : Boolean(settingsQ.error);

  const list = needs || [];
  const open = list.filter((n) => n.moderation_status === 'APPROVED' && n.status === 'OPEN').slice(0, MAX_NEEDS);
  const pending = list.filter((n) => n.moderation_status === 'PENDING').length;
  const ids = open.map((n) => n.id);
  const recsQ = useApi(
    (signal) => Promise.allSettled(ids.map((id) => api.get('/recommendations/talents', { signal, query: { need_id: id } })))
      .then((results) => ({ key: ids.join(), results })),
    [ids],
    { enabled: personalize && ids.length > 0 },
  );
  // Hanya pakai hasil yang sesuai daftar kebutuhan saat ini (data lama tetap ada selama memuat ulang).
  const rows = recsQ.data?.key === ids.join()
    ? open.map((need, i) => {
      const r = recsQ.data.results[i];
      const items = r.status === 'fulfilled' ? r.value.items : null;
      return { need, items, top: items?.[0]?.score ?? null, applicants: items ? items.filter((t) => t.applied).length : 0 };
    })
    : [];
  const withRecs = rows.filter((r) => r.items?.length > 0).length;
  const allFailed = rows.length > 0 && rows.every((r) => r.items === null);

  const settingsLoading = !settingsQ.data && !settingsQ.error;
  const firstLoad = settingsLoading || (needsLoading && !needs);

  let body;
  if (firstLoad) body = <AiCardSkeleton />;
  else if (!personalize) body = <AiPersonalizationOff onOpenSettings={onOpenSettings}>kebutuhan Anda maupun talenta yang cocok. Rekomendasi tetap ada di detail tiap kebutuhan</AiPersonalizationOff>;
  else if (needsError && !needs) body = <AiCardError onRetry={onRetryNeeds} />;
  else if (list.length === 0) body = <Intro onCreate={onCreate} />;
  else if (open.length === 0) {
    body = (
      <AiPanel>
        <p className="font-black mb-1">Belum ada kebutuhan yang sedang mencari talenta.</p>
        <p className="text-sm text-[#12283c]/70 leading-relaxed mb-4">
          {pending > 0 ? `${pending} kebutuhan menunggu persetujuan admin — rekomendasi talenta muncul setelah disetujui.` : 'Rekomendasi talenta muncul untuk kebutuhan yang sudah disetujui dan masih terbuka.'}
        </p>
        {onCreate && <button type="button" onClick={onCreate} className="btn-pill btn-red !py-2.5 !px-5 min-h-[44px] text-xs">+ Ajukan Kebutuhan</button>}
      </AiPanel>
    );
  } else if (recsQ.error || allFailed) body = <AiCardError onRetry={recsQ.refetch} />;
  else if (rows.length === 0) body = <AiCardSkeleton />;
  else {
    body = (
      <>
        <p className="text-lg font-black mb-3"><span className="text-[#e62b2b] tabular-nums">{withRecs}</span> dari {rows.length} kebutuhan terbuka punya rekomendasi talenta.</p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map(({ need, items, top, applicants }) => (
            <li key={need.id}>
              <button type="button" onClick={() => onOpenNeed(need.id)} className="w-full h-full text-left rounded-xl bg-[#fdfcf7] text-[#12283c] p-4 min-h-[44px] flex items-center justify-between gap-3 hover:ring-2 hover:ring-[#e62b2b] transition-shadow">
                <span className="min-w-0">
                  <span className="block font-black leading-snug break-words line-clamp-2">{need.title}</span>
                  <span className="block font-mono text-[10px] font-bold opacity-70 mt-1">
                    {items === null && 'REKOMENDASI BELUM TERMUAT'}
                    {items?.length === 0 && 'BELUM ADA TALENTA YANG COCOK'}
                    {items?.length > 0 && `${items.length} TALENTA COCOK · TERTINGGI ${top}%${applicants ? ` · ${applicants} MELAMAR` : ''}`}
                  </span>
                </span>
                <span className="font-mono text-[10px] font-bold text-[#e62b2b] shrink-0">LIHAT →</span>
              </button>
            </li>
          ))}
        </ul>
        {pending > 0 && <p className="mt-3 text-xs text-[#f2efe6]/70">{pending} kebutuhan lain menunggu persetujuan admin; rekomendasinya muncul setelah disetujui.</p>}
      </>
    );
  }

  return (
    <AiCard title="Talenta untuk kebutuhan Anda">
      {body}
      <p className="mt-4 text-xs text-[#f2efe6]/70 leading-relaxed">Pelamar selalu dinilai; talenta lain hanya disarankan bila mereka mengizinkan tampil di rekomendasi.</p>
    </AiCard>
  );
}
