// Pipeline berjenjang Tanya SUSI (T12.2). Dari yang termurah:
//  1. pra-pemeriksaan (guard.js): injeksi & pesan kasar ditolak tanpa LLM;
//  2. intent: basa-basi, permintaan bicara dengan AgenSUSI, dan data pribadi anonim dijawab tetap;
//  3. retrieval KB (FULLTEXT + pemeringkatan ulang, filter audiens);
//  4. tidak ada entri relevan → "belum tahu"/di luar topik, tanpa LLM;
//  5. jalur murah: entri KB yang mencakup penuh pertanyaan dijawab langsung, lalu cache jawaban LLM;
//  6. LLM (prompt sistem + <kb> + <user_data> + 6 giliran terakhir) bila key ada, anggaran cukup, dan
//     pengguna tidak mematikan AI (T15); gagal/timeout → jawaban tanpa LLM + tawaran eskalasi.
// Keluaran LLM selalu melewati filter (tautan di luar allowlist, kebocoran prompt).
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { LLMError } from '../llm/errors.js';
import { estimateCostUsd } from '../llm/pricing.js';
import { searchKb, audiencesFor, kbTitle, isConfident } from './kb.js';
import { buildSystemPrompt, PROMPT_VERSION, LEAK_MARKERS } from './prompts.js';
import { classifyIntent, isFollowUp, hasDomainTerms, PERSONAL_INTENTS } from './intent.js';
import { planPersonal } from './personal.js';
import { canonicalText } from './text.js';
import { createOutputFilter, createStreamFilter, hostOf } from './outputFilter.js';
import { answerCache, answerCacheKey } from './cache.js';
import { isBudgetExceeded, spentTodayUsd } from './budget.js';
import { fetchUserData, formatUserDataForPrompt, formatUserDataReply } from './userData.js';
import { withoutMasks, withoutProfanity } from './guard.js';
import { FALLBACK_REPLY, SMALLTALK_REPLIES, REPLIES, BUDGET_NOTE } from './replies.js';

export { FALLBACK_REPLY };

export const HISTORY_LIMITS = Object.freeze({ maxTurns: 6, maxCharsPerMessage: 600, maxTotalChars: 2400 });

/**
 * Riwayat untuk LLM: N giliran terakhir, tiap pesan dipotong per karakter, total dibatasi (pesan
 * terlama dibuang dulu), dan selalu diawali giliran pengguna (syarat sebagian provider).
 */
export function truncateHistory(messages, { maxTurns, maxCharsPerMessage, maxTotalChars } = HISTORY_LIMITS) {
  const clip = (text) => (text.length > maxCharsPerMessage ? `${text.slice(0, maxCharsPerMessage - 1).trimEnd()}…` : text);
  let recent = messages.slice(-maxTurns).map((m) => ({ role: m.role, content: clip(String(m.content ?? '')) }));
  let total = recent.reduce((sum, m) => sum + m.content.length, 0);
  while (recent.length > 0 && total > maxTotalChars) {
    total -= recent[0].content.length;
    recent = recent.slice(1);
  }
  while (recent.length > 0 && recent[0].role !== 'user') recent = recent.slice(1);
  return recent;
}

/** Riwayat chat → pesan LLM (balasan AgenSUSI dikirim sebagai giliran asisten). */
const toLlmMessages = (history) => history.map((m) => ({
  role: m.role === 'user' ? 'user' : 'assistant',
  content: m.role === 'agent' ? `[Balasan AgenSUSI] ${m.content}` : m.content,
}));

// Allowlist tautan: host frontend SUSI, wa.me, dan CHATBOT_ALLOWED_DOMAINS.
let outputFilter = null;
function getOutputFilter() {
  if (!outputFilter) {
    const hosts = new Set(['wa.me', ...env.chatbot.allowedDomains.map((d) => d.toLowerCase())]);
    for (const url of env.frontendUrls) {
      const host = hostOf(url);
      if (host) hosts.add(host);
    }
    outputFilter = createOutputFilter({ allowedHosts: [...hosts], leakMarkers: LEAK_MARKERS });
  }
  return outputFilter;
}

/**
 * Bentuk jawaban pipeline (dipakai controller untuk menyimpan pesan & ask_logs).
 * source: llm | cache | kb | data | rule | fallback.
 */
function makeAnswer(started, fields) {
  return {
    reply: '',
    source: 'rule',
    intent: 'faq',
    sources: [],
    kbEntryId: null,
    matched: false,
    model: null,
    promptVersion: null,
    usage: null,
    llmError: null,
    cacheHit: false,
    escalationSuggested: false,
    replace: false,
    aborted: false,
    // R3: kartu terstruktur (kebutuhan/talenta dari rekomendasi) untuk ditampilkan FE dengan aksi.
    cards: [],
    ...fields,
    latencyMs: Date.now() - started,
  };
}

const approxTokens = (text) => Math.ceil(String(text ?? '').length / 4);

/** Pemakaian perkiraan saat stream dihentikan sebelum provider mengirim usage (tetap dihitung ke anggaran). */
function estimateUsage(model, messages, output) {
  const tokensIn = approxTokens(messages.map((m) => m.content).join('\n'));
  const tokensOut = approxTokens(output);
  return { tokensIn, tokensOut, costUsd: estimateCostUsd(model, tokensIn, tokensOut), costEstimated: true };
}

/**
 * Tentukan jawaban: langsung (`kind: 'final'`) atau rencana pemanggilan LLM (`kind: 'llm'`).
 * @param {object} ctx
 * @param {import('mysql2/promise').Pool} ctx.db
 * @param {object} ctx.llm         klien dari services/llm
 * @param {object|null} ctx.user   req.user (null = anonim)
 * @param {string} ctx.message     pesan yang sudah melewati precheck (PII disamarkan)
 * @param {object} [ctx.guard]     hasil precheck
 * @param {object[]} [ctx.history] pesan sesi sebelumnya (lama → baru)
 * @param {boolean} [ctx.aiAllowed] false = pengguna mematikan AI (T15): tidak ada pemanggilan LLM
 * @param {boolean} [ctx.personalize] false = pengguna mematikan personalisasi (R3): jawaban umum
 */
async function planAnswer({ db, llm, user, message, guard = {}, history = [], aiAllowed = true, personalize = true }) {
  const started = Date.now();
  const final = (fields) => ({ kind: 'final', answer: makeAnswer(started, fields) });

  if (guard.injection) return final({ intent: 'injection', reply: REPLIES.injection });
  if (guard.abusiveOnly) return final({ intent: 'abusive', reply: REPLIES.abusive, escalationSuggested: true });

  // Intent & retrieval memakai teks tanpa penanda samaran & kata kasar; LLM tetap menerima pesan
  // (bersamaran) apa adanya.
  const retrievalText = (text) => withoutProfanity(withoutMasks(text));
  const query = retrievalText(message);
  const classified = classifyIntent(query);
  let { intent } = classified;
  if (guard.profanity && (intent === 'faq' || intent === 'howto')) intent = 'complaint';

  if (intent === 'smalltalk') return final({ intent, reply: SMALLTALK_REPLIES[classified.smalltalk] || SMALLTALK_REPLIES.ack });
  if (intent === 'escalation_request') return final({ intent, reply: REPLIES.escalation, escalationSuggested: true });
  if (PERSONAL_INTENTS.includes(intent)) {
    return planPersonalAnswer({ db, llm, user, message, query, guard, history, aiAllowed, personalize, intent, started, final });
  }
  // Data pribadi hanya untuk pengguna yang masuk; anonim tidak pernah sampai ke query data.
  if (intent === 'status_data' && !user) return final({ intent, reply: REPLIES.loginRequired });

  const audiences = audiencesFor(user);
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const followUp = Boolean(lastUser) && isFollowUp(query);
  // Pesan lanjutan ("terus apa lagi?") dicari bersama pertanyaan sebelumnya.
  const searchText = followUp ? `${retrievalText(lastUser.content)} ${query}` : query;
  const kbEntries = await searchKb(db, searchText, { audiences, limit: 3 });
  const top = kbEntries[0] ?? null;
  const base = {
    intent,
    sources: kbEntries.map((e) => ({ id: e.id, title: kbTitle(e) })),
    kbEntryId: top?.id ?? null,
    matched: Boolean(top),
  };

  const userData = intent === 'status_data' ? await fetchUserData(db, user, classified.topics) : null;

  if (!top && !userData && !followUp) {
    if (!hasDomainTerms(query)) return final({ ...base, intent: 'out_of_scope', reply: REPLIES.outOfScope });
    return final({ ...base, reply: FALLBACK_REPLY, source: 'fallback', escalationSuggested: true });
  }

  const standalone = !userData && !followUp;
  if (standalone && env.chatbot.kbDirect && isConfident(kbEntries)) return final({ ...base, reply: top.reply, source: 'kb' });

  // Pesan bersamaran tidak di-cache: jawabannya bisa merujuk data yang disamarkan.
  const cacheKey = standalone && !guard.piiMasked ? answerCacheKey(query, audiences) : null;
  const cached = cacheKey ? answerCache.get(cacheKey) : null;
  if (cached) return final({ ...base, reply: cached.reply, source: 'cache', cacheHit: true });

  // Tanpa LLM: data pribadi diringkas apa adanya, selain itu entri KB teratas.
  const withoutLlm = (fields = {}) => {
    if (userData) return final({ ...base, reply: formatUserDataReply(userData), source: 'data', ...fields });
    if (top) return final({ ...base, reply: top.reply, source: 'kb', ...fields });
    return final({ ...base, reply: FALLBACK_REPLY, source: 'fallback', escalationSuggested: true, ...fields });
  };
  if (!aiAllowed || !llm.isConfigured()) return withoutLlm();
  if (isBudgetExceeded(await spentTodayUsd(db), env.chatbot.dailyBudgetUsd)) {
    const plan = withoutLlm({ llmError: 'BudgetExceeded' });
    plan.answer.reply = `${plan.answer.reply}\n\n${BUDGET_NOTE}`;
    return plan;
  }

  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt({
        kbEntries,
        userData: userData ? formatUserDataForPrompt(userData) : null,
        role: user?.role ?? 'public',
      }),
    },
    ...toLlmMessages(truncateHistory(history)),
    { role: 'user', content: message },
  ];
  return {
    kind: 'llm',
    started,
    base,
    cacheKey,
    messages,
    // LLM gagal → jawaban tanpa LLM + tawaran eskalasi (ringkasan data sudah menjawab, tidak perlu).
    fallback: (llmError) => withoutLlm({ llmError, escalationSuggested: !userData }).answer,
  };
}

/**
 * Intent personal (R3): template dari data pribadi & rekomendasi R1 tanpa LLM; LLM hanya untuk
 * penjelasan ("kenapa cocok?") dan narasi karier, dengan template sebagai cadangan. Narasi di-cache
 * per hash(profil ringkas + rekomendasi) + pertanyaan baku. Konteks pribadi tidak pernah disimpan.
 */
async function planPersonalAnswer({ db, llm, user, message, query, guard, history, aiAllowed, personalize, intent, started, final }) {
  const personal = await planPersonal({ db, user, intent, query, personalize });
  const base = { intent: personal.intent, sources: [], kbEntryId: null, matched: true, cards: personal.cards };
  const template = (fields = {}) => final({ ...base, reply: personal.reply, source: personal.source, ...fields });
  if (!personal.llm || !aiAllowed || !llm.isConfigured()) return template();
  if (isBudgetExceeded(await spentTodayUsd(db), env.chatbot.dailyBudgetUsd)) return template({ llmError: 'BudgetExceeded' });

  const digest = crypto.createHash('sha256').update(`${personal.llm.profile}\n${personal.llm.recommendations}`).digest('hex').slice(0, 24);
  const cacheKey = guard.piiMasked ? null : `personal|${personal.intent}|${digest}|${canonicalText(query)}`;
  const cachedAnswer = cacheKey ? answerCache.get(cacheKey) : null;
  if (cachedAnswer) return final({ ...base, reply: cachedAnswer.reply, source: 'cache', cacheHit: true });

  const messages = [
    { role: 'system', content: buildSystemPrompt({ role: user.role, personal: personal.llm }) },
    ...toLlmMessages(truncateHistory(history)),
    { role: 'user', content: message },
  ];
  return {
    kind: 'llm',
    started,
    base,
    cacheKey,
    messages,
    maxTokens: personal.llm.maxTokens,
    fallback: (llmError) => template({ llmError }).answer,
  };
}

/** Jawaban LLM yang sudah utuh → filter keluaran, cache, dan bentuk jawaban. */
function finishLlm(plan, content, result, { prefiltered = false } = {}) {
  const filter = getOutputFilter();
  const llmFields = { model: result.model, promptVersion: PROMPT_VERSION, usage: result.usage };
  if (filter.detectLeak(content)) {
    return makeAnswer(plan.started, { ...plan.base, ...llmFields, reply: REPLIES.injection, source: 'rule', llmError: 'OutputBlocked' });
  }
  const reply = prefiltered ? content : filter.filterText(content).text;
  if (plan.cacheKey) answerCache.set(plan.cacheKey, { reply });
  return makeAnswer(plan.started, { ...plan.base, ...llmFields, reply, source: 'llm' });
}

/** Jawaban utuh (POST /chatbot/message). */
export async function answerMessage(ctx) {
  const plan = await planAnswer(ctx);
  if (plan.kind === 'final') return plan.answer;
  try {
    const result = await ctx.llm.complete({ messages: plan.messages, maxTokens: plan.maxTokens ?? env.chatbot.maxTokens });
    return finishLlm(plan, result.content, result);
  } catch (err) {
    if (!(err instanceof LLMError)) throw err; // bug di kode kita → biarkan jadi 500
    return plan.fallback(err.name);
  }
}

/**
 * Jawaban bertahap (POST /chatbot/stream): `{ type: 'delta', content }` … lalu satu
 * `{ type: 'done', answer }`. Bila teks yang sudah terkirim harus diganti (LLM gagal di tengah
 * jalan, kebocoran prompt), `answer.replace` = true dan `answer.reply` adalah isi penggantinya.
 * `ctx.signal` membatalkan LLM saat klien terputus; jawaban sebagian tetap dikembalikan agar dicatat.
 */
export async function* streamAnswer(ctx) {
  const plan = await planAnswer(ctx);
  if (plan.kind === 'final') {
    yield { type: 'delta', content: plan.answer.reply };
    yield { type: 'done', answer: plan.answer };
    return;
  }

  const filter = createStreamFilter(getOutputFilter());
  const model = ctx.llm.model;
  let emitted = '';
  let raw = '';
  let done = null;
  let blocked = false;
  try {
    for await (const event of ctx.llm.stream({ messages: plan.messages, maxTokens: plan.maxTokens ?? env.chatbot.maxTokens, signal: ctx.signal })) {
      if (event.type === 'done') {
        done = event;
        continue;
      }
      raw += event.content;
      const out = filter.push(event.content);
      if (out.blocked) {
        blocked = true;
        break; // menghentikan iterasi membatalkan permintaan ke provider
      }
      if (out.emit) {
        emitted += out.emit;
        yield { type: 'delta', content: out.emit };
      }
    }
  } catch (err) {
    if (ctx.signal?.aborted) {
      yield {
        type: 'done',
        answer: makeAnswer(plan.started, {
          ...plan.base, model, promptVersion: PROMPT_VERSION, usage: estimateUsage(model, plan.messages, raw),
          reply: emitted.trim() || REPLIES.cancelled, source: 'llm', llmError: 'ClientAborted', aborted: true,
        }),
      };
      return;
    }
    if (!(err instanceof LLMError)) throw err;
    const answer = plan.fallback(err.name);
    if (emitted) answer.replace = true;
    else yield { type: 'delta', content: answer.reply };
    yield { type: 'done', answer };
    return;
  }

  if (blocked) {
    const answer = makeAnswer(plan.started, {
      ...plan.base, model, promptVersion: PROMPT_VERSION, usage: estimateUsage(model, plan.messages, raw),
      reply: REPLIES.injection, source: 'rule', llmError: 'OutputBlocked', replace: emitted.length > 0,
    });
    if (!emitted) yield { type: 'delta', content: answer.reply };
    yield { type: 'done', answer };
    return;
  }

  const tail = filter.end();
  if (tail.emit) {
    emitted += tail.emit;
    yield { type: 'delta', content: tail.emit };
  }
  const result = done ?? { model, usage: estimateUsage(model, plan.messages, raw) };
  yield { type: 'done', answer: finishLlm(plan, emitted.trim(), result, { prefiltered: true }) };
}
