// Skor kecocokan talenta ↔ kebutuhan (R1). Fungsi murni, deterministik, dan bisa dijelaskan:
// setiap poin punya alasan yang ditampilkan. Ini REKOMENDASI; manusia tetap memilih (PRD addendum).
import { skillKey, normalizeSkill } from '../../utils/skillNormalize.js';

// Bobot di satu tempat (total positif 95; skor dipotong ke 0–100).
export const WEIGHTS = Object.freeze({
  skills: 50,      // cakupan keahlian yang dibutuhkan
  category: 15,    // pernah menyelesaikan (penuh) / melamar (sebagian) kategori yang sama
  community: 10,   // anggota ACTIVE komunitas pemilik kebutuhan
  sector: 5,       // sektor wilayah yang sama
  reputation: 10,  // level + sertifikasi (bonus kecil; pemula tetap dapat dasar)
  workload: -10,   // penalti bila sedang mengerjakan ≥ 2 proyek aktif
  recency: 5,      // kebutuhan baru
});

const LEVEL_POINTS = { TALENTA_MUDA: 3, TALENTA_TERPERCAYA: 6, TALENTA_AHLI: 8 };
const LEVEL_LABEL = { TALENTA_MUDA: 'Talenta Muda', TALENTA_TERPERCAYA: 'Talenta Terpercaya', TALENTA_AHLI: 'Talenta Ahli' };
const CATEGORY_LABEL = { PENCATATAN: 'Pencatatan & Data', WEBSITE: 'Website', APLIKASI: 'Aplikasi', LAINNYA: 'Lainnya' };
const BUSY_PROJECTS = 2;
const COLD_START_POINTS = [20, 35]; // 1 keahlian disebut, ≥ 2 keahlian disebut
const DAY_MS = 24 * 60 * 60 * 1000;

const sectorLabel = (s) => String(s).toLowerCase().replace(/(^|–)\p{L}/gu, (m) => m.toUpperCase());
// Kunci keahlian setelah alias dibakukan: "reactjs", "React.js", dan "React" setara.
const canonKey = (s) => skillKey(normalizeSkill(s));

/** Keahlian talenta yang muncul di judul/deskripsi kebutuhan (jalur cold start). */
function skillsInText(skills, text) {
  const haystack = skillKey(text);
  return skills.filter((s) => {
    const key = skillKey(normalizeSkill(s));
    return key.length >= 3 && haystack.includes(key);
  });
}

/**
 * @param {{ skills: string[], level?: string, certified?: boolean, completedCategories?: string[],
 *   appliedCategories?: string[], communityIds?: number[], sectors?: string[], activeProjects?: number }} talent
 * @param {{ title?: string, description?: string, category?: string, skills?: string[],
 *   community_id?: number|null, sector?: string|null, created_at?: string|Date }} need
 * @param {{ now?: number }} [options] waktu acuan (agar deterministik di test)
 * @returns {{ score: number, matched_skills: string[], missing_skills: string[], reasons: string[],
 *   confidence: 'high'|'medium'|'low'|'none', hint?: string }}
 */
export function scoreMatch(talent, need, { now = Date.now() } = {}) {
  const talentSkills = talent.skills ?? [];
  const needSkills = need.skills ?? [];
  if (talentSkills.length === 0) {
    return {
      score: 0, matched_skills: [], missing_skills: [...needSkills], reasons: [], confidence: 'none',
      hint: 'Lengkapi keahlian di profil agar sistem bisa mencocokkan Anda dengan kebutuhan komunitas.',
    };
  }

  const reasons = [];
  let score = 0;
  let matched;
  let missing;
  let confidence;

  // Keahlian (50). Kebutuhan tanpa daftar keahlian → kata kunci judul/deskripsi (cold start).
  const owned = new Set(talentSkills.map(canonKey));
  if (needSkills.length > 0) {
    matched = needSkills.filter((s) => owned.has(canonKey(s)));
    missing = needSkills.filter((s) => !owned.has(canonKey(s)));
    const coverage = matched.length / needSkills.length;
    score += WEIGHTS.skills * coverage;
    confidence = coverage >= 2 / 3 ? 'high' : 'medium';
    if (matched.length > 0) {
      reasons.push(`Menguasai ${matched.length} dari ${needSkills.length} keahlian yang dibutuhkan (${matched.join(', ')})`);
    }
  } else {
    // Keyakinan rendah → bobot keahlian dibatasi (maks. 35 dari 50: 1 kata cocok 20, ≥ 2 kata 35) agar
    // tidak mengalahkan kebutuhan yang daftar keahliannya memang tercakup penuh.
    matched = skillsInText(talentSkills, `${need.title ?? ''} ${need.description ?? ''}`);
    missing = [];
    score += matched.length >= 2 ? COLD_START_POINTS[1] : matched.length === 1 ? COLD_START_POINTS[0] : 0;
    confidence = 'low';
    if (matched.length > 0) reasons.push(`Deskripsi kebutuhan menyebut keahlian Anda (${matched.join(', ')})`);
  }

  // Kategori (15 bila pernah menyelesaikan, 7 bila baru pernah melamar).
  const category = need.category;
  if (category && (talent.completedCategories ?? []).includes(category)) {
    score += WEIGHTS.category;
    reasons.push(`Pernah menyelesaikan proyek kategori ${CATEGORY_LABEL[category] ?? category}`);
  } else if (category && (talent.appliedCategories ?? []).includes(category)) {
    score += WEIGHTS.category / 2;
    reasons.push(`Pernah melamar proyek kategori ${CATEGORY_LABEL[category] ?? category}`);
  }

  // Komunitas yang sama (10) & sektor (5).
  if (need.community_id && (talent.communityIds ?? []).map(Number).includes(Number(need.community_id))) {
    score += WEIGHTS.community;
    reasons.push('Anggota komunitas pemilik kebutuhan ini');
  }
  if (need.sector && (talent.sectors ?? []).includes(need.sector)) {
    score += WEIGHTS.sector;
    reasons.push(`Sudah aktif di wilayah yang sama (${sectorLabel(need.sector)})`);
  }

  // Reputasi & sertifikasi (maks 10): bonus kecil, pemula tetap mendapat poin dasar.
  const levelPoints = LEVEL_POINTS[talent.level] ?? LEVEL_POINTS.TALENTA_MUDA;
  score += Math.min(WEIGHTS.reputation, levelPoints + (talent.certified ? 2 : 0));
  if (talent.level && talent.level !== 'TALENTA_MUDA') reasons.push(`Level ${LEVEL_LABEL[talent.level] ?? talent.level}`);
  if (talent.certified) reasons.push('Tersertifikasi SUSI');

  // Beban kerja.
  if ((talent.activeProjects ?? 0) >= BUSY_PROJECTS) {
    score += WEIGHTS.workload;
    reasons.push(`Sedang mengerjakan ${talent.activeProjects} proyek (kapasitas terbatas)`);
  }

  // Kebaruan kebutuhan (5 / 3 / 1).
  const created = need.created_at ? new Date(need.created_at).getTime() : null;
  if (created) {
    const ageDays = (now - created) / DAY_MS;
    const recency = ageDays <= 3 ? WEIGHTS.recency : ageDays <= 7 ? 3 : ageDays <= 14 ? 1 : 0;
    score += recency;
    if (ageDays <= 3) reasons.push('Kebutuhan baru dibuka');
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    matched_skills: matched,
    missing_skills: missing,
    reasons,
    confidence,
  };
}
