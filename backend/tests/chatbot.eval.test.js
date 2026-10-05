// T15: golden set Tanya SUSI di CI — mode mock (LLM tiruan, tanpa jaringan & biaya) di DB test.
// Laporan lengkap beserta riwayat metrik: `npm run eval:chatbot` (docs/chatbot-eval.md).
import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData } from './helpers.js';
import { setLLMForTests } from '../services/llm/index.js';
import { answerCache } from '../services/chatbot/cache.js';
import { loadGolden, loadKb, setupFixtures, runCases, computeMetrics, TARGETS } from './chatbot/evalCore.js';

const request = async (method, url, { token, body } = {}) => {
  const req = api()[method.toLowerCase()](url);
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req.send(body);
  return { status: res.status, body: res.body };
};

describe('Evaluasi golden set Tanya SUSI (T15, mode mock)', () => {
  let results;
  let metrics;

  beforeAll(async () => {
    await resetData();
    answerCache.clear();
    setLLMForTests(null);
    await loadKb(pool);
    const users = await setupFixtures(pool);
    results = await runCases({ request, db: pool, cases: loadGolden(), users, mode: 'mock' });
    metrics = computeMetrics(results, { mode: 'mock' });
  }, 120_000);

  it('golden set ≥ 50 kasus mencakup semua kategori wajib', () => {
    expect(results.length).toBeGreaterThanOrEqual(50);
    const categories = new Set(results.map((r) => r.case.category));
    for (const c of ['faq', 'role_faq', 'slang', 'status_data', 'out_of_scope', 'injection', 'pii', 'abusive', 'escalation', 'unknown']) {
      expect(categories, c).toContain(c);
    }
  });

  it('setiap kasus lulus', () => {
    const failed = results
      .filter((r) => r.error || Object.values(r.checks).some((v) => v === false))
      .map((r) => `${r.case.id}: ${r.error ?? Object.entries(r.checks).filter(([, v]) => v === false).map(([k]) => k).join(', ')}`);
    expect(failed).toEqual([]);
  });

  it('target minimum tercapai (KB-hit, kebocoran, klaim biaya, p95)', () => {
    expect(metrics.kbHit.rate).toBeGreaterThanOrEqual(TARGETS.kbHit);
    expect(metrics.leaks).toBe(TARGETS.leaks);
    expect(metrics.costClaims).toBe(TARGETS.costClaims);
    expect(metrics.latency.p95).toBeLessThan(TARGETS.p95Ms);
    expect(metrics.targetsMet).toBe(true);
  });
});
