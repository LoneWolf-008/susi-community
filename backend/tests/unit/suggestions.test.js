import { describe, it, expect } from 'vitest';
import { SUGGESTIONS, suggestionsFor } from '../../services/chatbot/suggestions.js';
import { rankEntries, selectRelevant, isConfident, audiencesFor } from '../../services/chatbot/kb.js';
import { classifyIntent, PERSONAL_INTENTS } from '../../services/chatbot/intent.js';
import { queryTerms, fieldTokens } from '../../services/chatbot/text.js';
import { readKbFile } from '../../utils/kbSeed.js';

const ROLES = { public: null, requester: { role: 'requester' }, talent: { role: 'talent' }, liaison: { role: 'liaison' }, admin: { role: 'admin' } };

async function kbFor(user) {
  const audiences = audiencesFor(user);
  return (await readKbFile())
    .filter((e) => audiences.includes(e.audience ?? 'all'))
    .map((e, i) => ({ id: i + 1, slug: e.slug, title: e.title, keywords: e.keywords.join(', '), reply: e.reply, sort_order: i, score: 0 }));
}

/** Tiruan kandidat FULLTEXT: entri yang memuat salah satu kata isi pertanyaan. */
const candidates = (question, rows) => {
  const terms = queryTerms(question);
  return rows.filter((r) => {
    const all = new Set([...fieldTokens(r.title), ...fieldTokens(r.keywords), ...fieldTokens(r.reply)]);
    return terms.some((t) => t.variants.some((v) => all.has(v)));
  });
};

describe('Saran pertanyaan per peran (T14.4)', () => {
  it('setiap peran punya 4 saran; anonim & peran tak dikenal → saran publik', () => {
    for (const list of Object.values(SUGGESTIONS)) expect(list).toHaveLength(4);
    expect(suggestionsFor(null)).toBe(SUGGESTIONS.public);
    expect(suggestionsFor({ role: 'talent' })).toBe(SUGGESTIONS.talent);
    expect(suggestionsFor({ role: 'lainnya' })).toBe(SUGGESTIONS.public);
  });

  it.each(Object.entries(SUGGESTIONS).flatMap(([role, list]) => list.map((q) => [role, q])))(
    '[%s] "%s" terjawab langsung dari KB, berupa data pribadi, atau intent personal (R3)',
    async (role, question) => {
      const user = ROLES[role];
      const { intent } = classifyIntent(question);
      if (user && (intent === 'status_data' || PERSONAL_INTENTS.includes(intent))) return;
      const rows = await kbFor(user);
      const found = selectRelevant(rankEntries(question, candidates(question, rows)));
      expect(found.length, 'ada entri relevan').toBeGreaterThan(0);
      expect(isConfident(found), `cukup yakin (cakupan ${found[0].coverage}, ${found[0].slug})`).toBe(true);
    },
  );
});
