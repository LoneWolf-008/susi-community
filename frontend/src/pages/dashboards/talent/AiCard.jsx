import { api } from '../../../lib/api';
import { useApi } from '../../../hooks/useApi';
import { NEED_CATEGORY } from '../../../lib/statusMap';
import { MatchBadge, SkillMatchChips } from '../../../components/recommendation/MatchBits';
import AiCard, { AiPanel, AiPersonalizationOff, AiCardSkeleton, AiCardError } from '../../../components/recommendation/AiCard';

const TOP = 3;
const POOL = 50; // batas paginasi API; cukup untuk agregat kesenjangan keahlian di katalog saat ini

/**
 * Keahlian yang paling sering diminta kebutuhan terbuka yang BELUM cocok dengan talenta (belum
 * direkomendasikan, belum dilamar). Menambah satu keahlian itu = minimal satu keahlian cocok, syarat
 * utama rekomendasi. Tanpa keahlian sama sekali: keahlian yang paling dicari.
 */
function skillGap(catalog, recommendedIds, ownSkillIds) {
  const counts = new Map();
  for (const need of catalog) {
    if (recommendedIds.has(need.id) || need.my_application_status) continue;
    for (const s of need.skills || []) {
      if (ownSkillIds.has(s.id)) continue;
      const c = counts.get(s.id) || { name: s.name, n: 0 };
      c.n += 1;
      counts.set(s.id, c);
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'id'))[0] || null;
}

function RecItem({ need, onOpen }) {
  return (
    <article className="w-full rounded-xl bg-[#fdfcf7] text-[#12283c] p-4 flex flex-col min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <MatchBadge score={need.score} />
        {need.invited && <span className="rounded-full bg-[#e62b2b] text-white px-3 py-1 font-mono text-[10px] font-black">✉ DIUNDANG</span>}
      </div>
      <h3 className="font-black leading-snug mb-1 break-words line-clamp-2">{need.title}</h3>
      <p className="font-mono text-[10px] opacity-60 mb-2 break-words">{NEED_CATEGORY[need.category] || need.category} · {need.community_name || 'Tanpa komunitas'}</p>
      <div className="mb-2"><SkillMatchChips matched={need.matched_skills} limit={3} /></div>
      {need.reasons[0] && <p className="text-xs text-[#12283c]/75 leading-relaxed line-clamp-2">{need.reasons[0]}</p>}
      <div className="mt-auto pt-3 flex gap-2">
        <button type="button" onClick={() => onOpen(need, { apply: true })} className="btn-pill btn-red !py-2 !px-4 min-h-[44px] flex-1 text-xs">Lamar →</button>
        <button type="button" onClick={() => onOpen(need)} className="btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-xs">Detail</button>
      </div>
    </article>
  );
}

function SkillTip({ gap, hasSkills, onCompleteProfile }) {
  return (
    <AiPanel className="flex flex-col">
      <p className="label-mono mb-2">Tip keahlian</p>
      {gap ? (
        <>
          <p className="font-black leading-snug mb-1">
            {hasSkills
              ? <>Tambah skill <span className="text-[#e62b2b]">{gap.name}</span> untuk membuka {gap.n} proyek lagi.</>
              : <>Skill paling dicari: <span className="text-[#e62b2b]">{gap.name}</span> ({gap.n} proyek terbuka).</>}
          </p>
          <p className="text-xs text-[#12283c]/60 leading-relaxed mb-3">
            Dihitung dari kebutuhan terbuka yang mencantumkan {gap.name} dan belum cocok dengan keahlian Anda.
          </p>
        </>
      ) : (
        <p className="text-sm text-[#12283c]/70 leading-relaxed mb-3">Keahlian Anda sudah mencakup semua kebutuhan terbuka saat ini.</p>
      )}
      <button type="button" onClick={onCompleteProfile} className="mt-auto self-start btn-pill btn-ghost-dark !py-2 !px-4 min-h-[44px] text-xs">Atur keahlian di Profil →</button>
    </AiPanel>
  );
}

function CertProgress({ e, onCompleteProfile }) {
  const progress = Math.min(e.completed, e.min_projects);
  let status;
  if (e.certificates.length > 0) status = `✓ Tersertifikasi SUSI · ${e.certificates.map((c) => c.focus_label).join(', ')}`;
  else if (e.pending_request) status = 'Pengajuan sertifikasi sedang ditinjau.';
  else if (e.eligible) status = 'Syarat terpenuhi — Anda bisa mengajukan sertifikasi.';
  else status = `Selesaikan ${e.min_projects - progress} proyek lagi untuk bisa mengajukan.`;
  return (
    <AiPanel className="flex flex-col">
      <p className="label-mono mb-2">Sertifikasi SUSI</p>
      <p className="font-black mb-2"><span className="tabular-nums">{progress} dari {e.min_projects}</span> proyek selesai</p>
      <div className="h-2.5 rounded-full bg-[#12283c]/10 overflow-hidden mb-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={e.min_projects} aria-label="Proyek selesai untuk sertifikasi">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${(progress / e.min_projects) * 100}%` }} />
      </div>
      <p className="text-xs text-[#12283c]/70 leading-relaxed mb-3">{status}</p>
      {e.eligible && <button type="button" onClick={onCompleteProfile} className="mt-auto self-start btn-pill btn-red !py-2 !px-4 min-h-[44px] text-xs">Ajukan di Profil →</button>}
    </AiPanel>
  );
}

/**
 * Kartu "Rekomendasi AI" talenta (paling atas Beranda): 3 kebutuhan teratas dari /recommendations/needs,
 * satu tip kesenjangan keahlian (agregat katalog), dan progres sertifikasi. Menghormati
 * allows_ai_personalization (mati = tidak memuat data pribadi) dan menampilkan status show_in_recommendations.
 */
export default function TalentAiCard({ version = 0, onOpen, onCompleteProfile, onOpenSettings, onSeeAll }) {
  const settingsQ = useApi((signal) => api.get('/settings', { signal }), []);
  // Pengaturan gagal dimuat → pakai bawaan (personalisasi aktif); data yang tampil milik pengguna sendiri.
  const personalize = settingsQ.data ? Number(settingsQ.data.allows_ai_personalization) === 1 : Boolean(settingsQ.error);
  const enabled = { enabled: personalize };
  const recsQ = useApi((signal) => api.get('/recommendations/needs', { signal, query: { limit: POOL } }), [version], enabled);
  const catalogQ = useApi((signal) => api.get('/needs/catalog', { signal, query: { limit: POOL } }), [version], enabled);
  const profileQ = useApi((signal) => api.get('/talent/profile', { signal }), [version], enabled);
  const eligQ = useApi((signal) => api.get('/certifications/eligibility', { signal }), [version], enabled);

  const recs = recsQ.data;
  const items = recs?.items || [];
  const hasSkills = Boolean(profileQ.data?.skills?.length);
  const gap = catalogQ.data && profileQ.data
    ? skillGap(catalogQ.data.items, new Set(items.map((n) => n.id)), new Set(profileQ.data.skills.map((s) => s.id)))
    : null;
  const hidden = settingsQ.data && Number(settingsQ.data.show_in_recommendations) === 0;

  const settingsLoading = !settingsQ.data && !settingsQ.error;
  const aside = recs && items.length > 0 && (
    <button type="button" onClick={onSeeAll} className="min-h-[44px] font-mono text-[10px] font-bold tracking-wider underline underline-offset-4 hover:text-[#e62b2b]">
      {recs.total} KEBUTUHAN COCOK · LIHAT SEMUA ↓
    </button>
  );

  return (
    <AiCard title="Rekomendasi untuk Anda" aside={aside}>
      {settingsLoading && <AiCardSkeleton />}
      {!settingsLoading && !personalize && (
        <AiPersonalizationOff onOpenSettings={onOpenSettings}>keahlian, proyek, atau sertifikasi Anda</AiPersonalizationOff>
      )}

      {personalize && (
        <>
          {recsQ.error && <AiCardError onRetry={recsQ.refetch} />}
          {recsQ.loading && !recs && !recsQ.error && <AiCardSkeleton />}

          {recs?.hint && (
            <AiPanel className="border-l-4 border-l-[#e62b2b] mb-4">
              <p className="font-black text-lg mb-1">Lengkapi profil Anda dulu</p>
              <p className="text-sm text-[#12283c]/70 leading-relaxed mb-4">{recs.hint} Rekomendasi muncul begitu keahlian tersimpan.</p>
              <button type="button" onClick={onCompleteProfile} className="btn-pill btn-red !py-3 min-h-[44px] text-xs">Lengkapi profil →</button>
            </AiPanel>
          )}
          {recs && !recs.hint && items.length === 0 && (
            <AiPanel className="mb-4">
              <p className="font-black mb-1">Belum ada kebutuhan terbuka yang cocok dengan keahlian Anda.</p>
              <p className="text-sm text-[#12283c]/70 leading-relaxed">Rekomendasi diperbarui saat kebutuhan baru disetujui. Sementara itu, telusuri katalog di bawah atau tambah keahlian di Profil.</p>
            </AiPanel>
          )}
          {items.length > 0 && (
            // Mobile: digeser ke samping (snap) agar kartu tidak memanjang; desktop: 3 kolom.
            <div className="-mx-5 px-5 sm:mx-0 sm:px-0 flex md:grid md:grid-cols-3 gap-3 md:gap-4 mb-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-1" aria-label="Tiga rekomendasi teratas">
              {items.slice(0, TOP).map((n) => (
                <div key={n.id} className="w-[85%] sm:w-[60%] md:w-auto shrink-0 snap-start flex"><RecItem need={n} onOpen={onOpen} /></div>
              ))}
            </div>
          )}

          {/* Tip & progres bersifat tambahan: bila gagal dimuat, panelnya saja yang tidak tampil. */}
          {((catalogQ.data && profileQ.data) || eligQ.data) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catalogQ.data && profileQ.data && <SkillTip gap={gap} hasSkills={hasSkills} onCompleteProfile={onCompleteProfile} />}
              {eligQ.data && <CertProgress e={eligQ.data} onCompleteProfile={onCompleteProfile} />}
            </div>
          )}
        </>
      )}

      {settingsQ.data && (
        <p className="mt-4 text-xs text-[#f2efe6]/70 leading-relaxed">
          {hidden
            ? <>Anda memilih <strong>tidak tampil</strong> di rekomendasi untuk komunitas, jadi tidak akan ada undangan melamar. </>
            : <>Profil ringkas Anda tampil di rekomendasi untuk komunitas yang kebutuhannya cocok. </>}
          <button type="button" onClick={onOpenSettings} className="inline-flex items-center min-h-[44px] underline underline-offset-2 font-bold hover:text-[#e62b2b]">Ubah di Pengaturan</button>
        </p>
      )}
    </AiCard>
  );
}
