import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import AiCard from '../../../components/recommendation/AiCard';

const MAX_NEEDS = 10; // satu panggilan /recommendations/talents per kebutuhan terbuka (di-cache 60 dtk di BE)

/**
 * Kartu "Rekomendasi AI" komunitas, di bawah daftar kebutuhan Beranda (U10). Hanya tampil bila ada
 * rekomendasi nyata: minimal satu kebutuhan terbuka punya talenta yang cocok (dari /recommendations/talents).
 * Selain itu (personalisasi mati, belum ada kebutuhan terbuka, memuat, galat, atau tidak ada yang cocok)
 * kartu tidak dirender; ajakan mengajukan kebutuhan ada di Beranda sendiri. Hanya talenta yang mengizinkan
 * show_in_recommendations yang disarankan (disaring di BE); allows_ai_personalization mati = tidak memuat.
 * Logika rekomendasi tidak berubah.
 */
export default function RequesterAiCard({ needs, onOpenNeed }) {
  const settingsQ = useApi((signal) => api.get('/settings', { signal }), []);
  const personalize = settingsQ.data ? Number(settingsQ.data.allows_ai_personalization) === 1 : false;

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
  const rows = personalize && recsQ.data?.key === ids.join()
    ? open.map((need, i) => {
      const r = recsQ.data.results[i];
      const items = r.status === 'fulfilled' ? r.value.items : null;
      return { need, items, top: items?.[0]?.score ?? null, applicants: items ? items.filter((t) => t.applied).length : 0 };
    })
    : [];
  const withRecs = rows.filter((r) => r.items?.length > 0);
  if (withRecs.length === 0) return null;

  return (
    <AiCard title="Talenta untuk kebutuhan Anda">
      <p className="text-lg font-black mb-3"><span className="text-[#e62b2b] tabular-nums">{withRecs.length}</span> dari {rows.length} kebutuhan terbuka punya rekomendasi talenta.</p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {withRecs.map(({ need, items, top, applicants }) => (
          <li key={need.id}>
            <button type="button" onClick={() => onOpenNeed(need.id)} className="w-full h-full text-left rounded-xl bg-[#fdfcf7] text-[#12283c] p-4 min-h-[44px] flex items-center justify-between gap-3 hover:ring-2 hover:ring-[#e62b2b] transition-shadow">
              <span className="min-w-0">
                <span className="block font-black leading-snug break-words line-clamp-2">{need.title}</span>
                <span className="block font-mono text-[10px] font-bold opacity-70 mt-1">
                  {`${items.length} TALENTA COCOK · TERTINGGI ${top}%${applicants ? ` · ${applicants} MELAMAR` : ''}`}
                </span>
              </span>
              <span className="font-mono text-[10px] font-bold text-[#e62b2b] shrink-0">LIHAT →</span>
            </button>
          </li>
        ))}
      </ul>
      {pending > 0 && <p className="mt-3 text-xs text-[#f2efe6]/70">{pending} kebutuhan lain menunggu persetujuan admin; rekomendasinya muncul setelah disetujui.</p>}
      <p className="mt-4 text-xs text-[#f2efe6]/70 leading-relaxed">Pelamar selalu dinilai; talenta lain hanya disarankan bila mereka mengizinkan tampil di rekomendasi.</p>
    </AiCard>
  );
}
