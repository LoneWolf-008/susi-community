// Jawaban pribadi Tanya SUSI (R3): rekomendasi proyek/talenta, karier, dan sertifikasi.
// Rekomendasi SELALU berasal dari mesin R1; template tanpa LLM menjawab permintaan "tampilkan", LLM
// hanya menjelaskan ("kenapa", "bagaimana") dan menyusun narasi karier dari data yang diberikan.
import { intentText } from './text.js';
import { personalContext, formatProfile, formatRecommendations, CERT_MIN_PROJECTS, levelLabel } from './personalContext.js';

// Penjelasan → LLM (bila tersedia); permintaan daftar → template.
const WHY_RE = /\b(kenapa|mengapa|kok|alasan|alasannya|jelaskan|maksudnya|apa sebabnya|bagaimana bisa)\b/;
export const CAREER_MAX_TOKENS = 450;

const CERT_RULE = `Sertifikasi talenta SUSI diberikan oleh admin atau AgenSUSI kepada talenta yang sudah menyelesaikan minimal ${CERT_MIN_PROJECTS} proyek di SUSI.`;
const DECISION_NOTE = 'Ini urutan dari sistem; keputusan tetap di tangan Anda.';
const NO_PROMISE = 'Saya tidak bisa menjanjikan pekerjaan atau penghasilan; SUSI memberi pengalaman proyek nyata dan rekam jejak yang terverifikasi.';

export const PERSONAL_REPLIES = {
  loginRequired: 'Rekomendasi dan saran karier memakai profil Anda, jadi silakan masuk dulu lewat halaman Masuk. Setelah masuk, tanyakan lagi di sini.',
  careerGeneral: `SUSI tidak menjanjikan pekerjaan, penempatan kerja, atau penghasilan. Talenta mendapat pengalaman proyek nyata untuk komunitas dan rekam jejak yang terverifikasi, yang bisa dipakai sebagai portofolio. Untuk saran karier pribadi, masuk sebagai talenta lalu tanyakan "skill apa yang perlu saya pelajari?".`,
  personalizationOff: {
    talent: 'Personalisasi Tanya SUSI sedang Anda matikan, jadi saya tidak membaca profil dan keahlian Anda. Rekomendasi tetap bisa dilihat di dasbor, bagian "Rekomendasi untuk Anda" di Lihat Proyek. Nyalakan lagi di Pengaturan → Privasi bila ingin saya menjelaskannya.',
    owner: 'Personalisasi Tanya SUSI sedang Anda matikan, jadi saya tidak membaca kebutuhan dan rekomendasi Anda. Talenta yang cocok tetap bisa dilihat di detail tiap kebutuhan, panel "Talenta lain yang cocok". Nyalakan lagi di Pengaturan → Privasi bila ingin saya merangkumnya.',
    karir: 'Personalisasi Tanya SUSI sedang Anda matikan, jadi saya tidak membaca profil dan keahlian Anda. Secara umum, lihat keahlian yang dicantumkan kebutuhan di katalog untuk tahu yang sedang dicari komunitas. Nyalakan personalisasi di Pengaturan → Privasi bila ingin analisis pribadi.',
  },
  ownerOnly: 'Rekomendasi talenta disediakan untuk pemilik kebutuhan (komunitas atau AgenSUSI). Sebagai talenta, Anda bisa melihat kebutuhan yang cocok dengan keahlian Anda di bagian "Rekomendasi untuk Anda".',
  talentOnly: 'Saran karier di Tanya SUSI ditujukan untuk talenta, berdasarkan keahliannya dan kebutuhan yang sedang terbuka. Untuk kebutuhan Anda, saya bisa merangkum talenta yang cocok: tanyakan "talenta mana yang cocok untuk kebutuhan saya?".',
  adminGeneral: 'Rekomendasi di SUSI dihitung dari aturan yang terukur (kecocokan keahlian, kategori, komunitas, wilayah, reputasi) dan hanya mengurutkan pilihan; talenta tetap memutuskan melamar dan komunitas tetap memilih.',
};

const skillsList = (list) => list.map((s) => `**${s}**`).join(', ');

function talentRecommendations(ctx) {
  if (ctx.skills.length === 0) {
    return {
      reply: 'Profil Anda belum mencantumkan keahlian, jadi saya belum bisa mencocokkan Anda dengan kebutuhan komunitas. Tambahkan keahlian yang sudah Anda kuasai di tab Profil, lalu tanyakan lagi.',
      cards: [],
    };
  }
  if (ctx.recommendations.length === 0) {
    return {
      reply: `Saat ini belum ada kebutuhan terbuka yang cocok dengan keahlian Anda (${ctx.skills.join(', ')}). Kebutuhan baru terus masuk; cek katalog di Lihat Proyek atau tambah keahlian di Profil.`,
      cards: [],
    };
  }
  const lines = ctx.recommendations.map((n, i) => `${i + 1}. **${n.title}** — ${n.score}% cocok${n.invited ? ' · Anda diundang' : ''}. ${n.reason ?? ''}`.trim());
  return {
    reply: [`Berdasarkan keahlian Anda (${ctx.skills.join(', ')}), ini kebutuhan terbuka yang paling cocok:`, ...lines, '', `Buka kartunya untuk melihat detail dan melamar. ${DECISION_NOTE}`].join('\n'),
    cards: ctx.recommendations.map((n) => ({ type: 'need', id: n.id, score: n.score, title: n.title, invited: n.invited })),
  };
}

function ownerRecommendations(ctx) {
  const open = ctx.needs.filter((n) => n.status === 'OPEN');
  if (open.length === 0) {
    return { reply: 'Anda belum punya kebutuhan yang terbuka di katalog, jadi belum ada talenta yang bisa direkomendasikan. Setelah kebutuhan Anda lolos moderasi, talenta yang cocok akan tampil di detail kebutuhan.', cards: [] };
  }
  const withTalents = open.filter((n) => n.talents.length > 0);
  if (withTalents.length === 0) {
    return { reply: 'Belum ada talenta yang keahliannya cocok dengan kebutuhan terbuka Anda. Talenta baru muncul setelah mereka melengkapi keahlian; pantau juga pelamar di dasbor.', cards: [] };
  }
  const lines = withTalents.flatMap((n) => [
    `**${n.title}**`,
    ...n.talents.map((t) => `- ${t.name} (${levelLabel(t.level)}) — ${t.score}% cocok${t.matched.length ? `, keahlian: ${t.matched.join(', ')}` : ''}${t.applied ? ' · sudah melamar' : ''}`),
  ]);
  return {
    reply: ['Talenta yang cocok untuk kebutuhan terbuka Anda:', ...lines, '', `Undang lewat kartu atau dari detail kebutuhan. ${DECISION_NOTE}`].join('\n'),
    cards: withTalents.flatMap((n) => n.talents.map((t) => ({
      type: 'talent', id: t.id, score: t.score, title: t.name, need_id: n.id, need_title: n.title, applied: t.applied, invited: t.invited,
    }))),
  };
}

function careerReply(ctx) {
  const c = ctx.certification;
  const steps = [];
  const top = ctx.recommendations[0];
  if (top) steps.push(`Lamar kebutuhan yang paling cocok: **${top.title}** (${top.score}% cocok).`);
  if (!ctx.hasBio) steps.push('Lengkapi bio di Profil agar komunitas cepat mengenal pengalaman Anda.');
  if (c.certified) steps.push('Anda sudah tersertifikasi SUSI; badge-nya membantu komunitas memilih Anda.');
  else if (c.eligible) steps.push(`Anda sudah memenuhi syarat jumlah proyek untuk sertifikasi SUSI (${c.completed} proyek selesai).`);
  else if (!c.pending) steps.push(`Selesaikan ${Math.max(0, c.minProjects - c.completed)} proyek lagi untuk memenuhi syarat sertifikasi SUSI.`);

  const gapLine = ctx.skillGaps.length > 0
    ? `Keahlian yang paling banyak diminta kebutuhan terbuka di SUSI dan belum Anda miliki: ${ctx.skillGaps.map((g) => `**${g.name}** (${g.demand} kebutuhan)`).join(', ')}.`
    : 'Keahlian yang sedang banyak diminta kebutuhan terbuka di SUSI sudah Anda miliki.';
  const intro = ctx.skills.length > 0
    ? `Keahlian Anda saat ini: ${skillsList(ctx.skills)}.`
    : 'Profil Anda belum mencantumkan keahlian; mulai dengan menambahkan keahlian yang sudah Anda kuasai di tab Profil.';
  return {
    reply: [
      intro,
      gapLine,
      '',
      'Langkah berikutnya:',
      ...steps.map((s, i) => `${i + 1}. ${s}`),
      '',
      '(Saran umum) Pelajari keahlian baru dari tutorial dasar gratis, lalu praktikkan langsung lewat proyek kecil.',
      NO_PROMISE,
    ].join('\n'),
    cards: ctx.recommendations.slice(0, 2).map((n) => ({ type: 'need', id: n.id, score: n.score, title: n.title, invited: n.invited })),
  };
}

function certificationReply(ctx) {
  if (!ctx || ctx.role !== 'talent') return { reply: CERT_RULE, cards: [] };
  const c = ctx.certification;
  let status;
  if (c.certified) status = 'Anda sudah tersertifikasi SUSI.';
  else if (c.pending) status = 'Pengajuan sertifikasi Anda sedang ditinjau.';
  else if (c.eligible) status = `Anda sudah menyelesaikan ${c.completed} proyek, jadi sudah memenuhi syarat jumlah proyek.`;
  else status = `Anda baru menyelesaikan ${c.completed} dari ${c.minProjects} proyek; selesaikan ${c.minProjects - c.completed} proyek lagi untuk memenuhi syarat.`;
  return { reply: `${CERT_RULE} ${status}`, cards: [] };
}

/**
 * Rencana jawaban intent personal.
 * @returns {Promise<{ intent: string, reply: string, cards: object[], source: 'personal'|'rule',
 *   llm?: { profile: string, recommendations: string, maxTokens?: number } }>}
 *   `llm` diisi bila penjelasan/narasi sebaiknya disusun LLM (dengan `reply` sebagai cadangan).
 */
export async function planPersonal({ db, user, intent, query, personalize = true }) {
  const rule = (reply, finalIntent = intent) => ({ intent: finalIntent, reply, cards: [], source: 'rule' });

  if (intent === 'sertifikasi' && (!user || !personalize || user.role !== 'talent')) return rule(CERT_RULE);
  if (intent === 'karir' && (!user || user.role !== 'talent')) {
    return rule(!user || user.role === 'admin' ? PERSONAL_REPLIES.careerGeneral : PERSONAL_REPLIES.talentOnly);
  }
  if (!user) return rule(PERSONAL_REPLIES.loginRequired);

  const isOwner = user.role === 'requester' || user.role === 'liaison';
  // Peran menentukan jenis rekomendasi: talenta → proyek, pemilik kebutuhan → talenta.
  let resolved = intent;
  if (intent === 'rekomendasi_proyek' || intent === 'rekomendasi_talenta') {
    if (user.role === 'talent') resolved = 'rekomendasi_proyek';
    else if (isOwner) resolved = 'rekomendasi_talenta';
    else return rule(PERSONAL_REPLIES.adminGeneral);
  }
  if (!personalize) {
    if (resolved === 'karir') return rule(PERSONAL_REPLIES.personalizationOff.karir, resolved);
    return rule(isOwner ? PERSONAL_REPLIES.personalizationOff.owner : PERSONAL_REPLIES.personalizationOff.talent, resolved);
  }

  const ctx = await personalContext(db, user);
  let planned;
  if (resolved === 'rekomendasi_proyek') planned = talentRecommendations(ctx);
  else if (resolved === 'rekomendasi_talenta') planned = ownerRecommendations(ctx);
  else if (resolved === 'karir') planned = careerReply(ctx);
  else planned = certificationReply(ctx);

  const result = { intent: resolved, reply: planned.reply, cards: planned.cards, source: 'personal' };
  const blocks = { profile: formatProfile(ctx), recommendations: formatRecommendations(ctx) };
  const t = intentText(query);
  if (resolved === 'karir' && ctx.skills.length > 0) {
    result.llm = { ...blocks, maxTokens: CAREER_MAX_TOKENS };
  } else if ((resolved === 'rekomendasi_proyek' || resolved === 'rekomendasi_talenta') && planned.cards.length > 0 && WHY_RE.test(t)) {
    result.llm = blocks;
  }
  return result;
}
