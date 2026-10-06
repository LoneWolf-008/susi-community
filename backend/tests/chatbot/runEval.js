// Evaluasi Tanya SUSI terhadap golden set (T15).
//
//   npm run eval:chatbot                       mode mock: LLM tiruan, tanpa jaringan & biaya (untuk CI)
//   npm run eval:chatbot -- --mode live        OpenRouter sungguhan (BERBAYAR, jalankan manual).
//                                              Key dibaca dari env OPENROUTER_API_KEY, tidak pernah disimpan.
//   npm run eval:chatbot -- --model <slug>     ganti model (mis. bandingkan Haiku 4.5 dengan model lebih murah)
//   npm run eval:chatbot -- --no-kb-direct     semua pertanyaan lewat LLM (menilai prompt, bukan jalur murah)
//   npm run eval:chatbot -- --no-report        jangan tulis docs/chatbot-eval.md & riwayat
//   npm run eval:chatbot -- --cases id1,id2    hanya kasus tertentu (uji ulang); laporan & riwayat tidak ditulis
//   npm run eval:chatbot -- --set natural.jsonl  set pertanyaan lain di tests/chatbot/ (mis. pertanyaan natural
//                                              pemandu & CS); laporan & riwayat tidak ditulis
//   npm run eval:chatbot -- --json <berkas>    simpan hasil per kasus (termasuk jawaban) ke berkas JSON
//
// Bagian docs/chatbot-eval.md setelah penanda MANUAL_MARKER ditulis tangan dan dipertahankan.
//
// Memakai database tersendiri EVAL_DB_NAME (default susi_community_eval, wajib berakhiran _eval) yang
// DIKOSONGKAN setiap putaran. Keluaran: docs/chatbot-eval.md + tests/chatbot/eval-history.json.
// Kode keluar 1 bila target minimum belum tercapai.
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const mode = option('mode') ?? 'mock';
if (!['mock', 'live'].includes(mode)) {
  console.error('--mode harus mock atau live');
  process.exit(2);
}
const dbName = process.env.EVAL_DB_NAME || 'susi_community_eval';
if (!/_eval$/.test(dbName)) {
  console.error(`Evaluasi menolak berjalan di database "${dbName}" (nama harus berakhiran _eval: isinya dikosongkan).`);
  process.exit(2);
}
if (mode === 'live' && !process.env.OPENROUTER_API_KEY) {
  console.error('Mode live butuh OPENROUTER_API_KEY di environment proses (jangan ditulis ke berkas repo).');
  process.exit(2);
}

// Konfigurasi harus diset sebelum config/env.js dimuat. Variabel proses mengalahkan backend/.env.
Object.assign(process.env, {
  DB_NAME: dbName,
  LLM_PROVIDER: mode === 'live' ? 'openrouter' : 'mock',
  RATE_LIMIT_MAX: '100000',
  CHATBOT_RATE_LIMIT_PER_MIN: '100000',
  CHATBOT_ANON_RATE_LIMIT_PER_MIN: '100000',
  CHATBOT_ANON_IP_RATE_LIMIT_PER_MIN: '100000',
  CHATBOT_DAILY_LIMIT_USER: '100000',
  CHATBOT_DAILY_LIMIT_ANON: '100000',
  CHATBOT_DAILY_LIMIT_ANON_IP: '100000',
  CHATBOT_KB_DIRECT: args.includes('--no-kb-direct') ? 'false' : 'true',
});
if (mode === 'mock') process.env.OPENROUTER_API_KEY = '';
if (option('model')) process.env.OPENROUTER_MODEL = option('model');

const here = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(here, 'eval-history.json');
const REPORT_FILE = path.resolve(here, '../../../docs/chatbot-eval.md');
const MANUAL_MARKER = '<!-- manual: bagian di bawah ini ditulis tangan dan dipertahankan oleh runner -->';

const { resetDatabase } = await import('../../utils/migrate.js');
await resetDatabase({ log: () => {} });
const { env } = await import('../../config/env.js');
const { pool } = await import('../../config/db.js');
const { app } = await import('../../app.js');
const { PROMPT_VERSION } = await import('../../services/chatbot/prompts.js');
const core = await import('./evalCore.js');

const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const request = async (method, url, { token, body } = {}) => {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

let exitCode = 0;
try {
  await core.loadKb(pool);
  const users = await core.setupFixtures(pool);
  const [[{ kbEntries }]] = await pool.query(`SELECT COUNT(*) AS kbEntries FROM kb_entries WHERE status = 'active'`);
  const only = option('cases')?.split(',').map((s) => s.trim()).filter(Boolean);
  const setFile = option('set') ? path.join(here, option('set')) : undefined;
  const cases = core.loadGolden(setFile).filter((c) => !only || only.includes(c.id));
  if (only && cases.length !== only.length) throw new Error(`Kasus tidak dikenal: ${only.filter((id) => !cases.some((c) => c.id === id)).join(', ')}`);
  console.log(`[eval] ${cases.length} kasus · mode ${mode} · DB ${dbName}`);
  const results = await core.runCases({
    request, db: pool, cases, users, mode,
    onProgress: (r, pass) => process.stdout.write(r.error ? 'E' : pass ? '.' : 'F'),
  });
  process.stdout.write('\n');

  const metrics = core.computeMetrics(results, { mode });
  // Total biaya dari semua panggilan LLM putaran ini (DB evaluasi dikosongkan tiap putaran), termasuk
  // giliran riwayat pada kasus lanjutan yang tidak dihitung per kasus.
  const [[{ total }]] = await pool.query(`SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ask_logs`);
  metrics.totalCostUsd = Number(total);
  if (option('json')) {
    fs.writeFileSync(option('json'), JSON.stringify(results.map((r) => ({
      id: r.case.id, category: r.case.category, message: r.case.message, error: r.error ?? null,
      failed: r.error ? [] : Object.entries(r.checks).filter(([, v]) => v === false).map(([k]) => k),
      reply: r.reply ?? null, source: r.source ?? null, intent: r.intent ?? null, escalation: r.escalation ?? null,
      slugs: r.slugs ?? [], cards: (r.cards ?? []).length, violations: r.violations ?? [],
      latencyMs: r.latencyMs, model: r.model ?? null, costUsd: r.costUsd ?? null, llmError: r.llmError ?? null,
    })), null, 2));
  }
  const meta = {
    date: new Date().toISOString(),
    mode,
    model: mode === 'live' ? env.llm.openrouter.model : 'mock',
    promptVersion: PROMPT_VERSION,
    kbDirect: env.chatbot.kbDirect,
    kbEntries: Number(kbEntries),
  };
  if (!args.includes('--no-report') && !only && !setFile) {
    const history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : [];
    // Riwayat menyimpan metrik saja (termasuk per kategori), tanpa isi jawaban.
    history.push({ ...meta, metrics });
    fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`);
    const previous = fs.existsSync(REPORT_FILE) ? fs.readFileSync(REPORT_FILE, 'utf8') : '';
    const manual = previous.includes(MANUAL_MARKER) ? previous.slice(previous.indexOf(MANUAL_MARKER)) : '';
    fs.writeFileSync(REPORT_FILE, core.renderReport({ meta, metrics, results, history }) + (manual ? `\n${manual}` : ''));
    console.log(`[eval] laporan: ${path.relative(process.cwd(), REPORT_FILE)}`);
  }

  const pct = (r) => (r.rate == null ? '—' : `${Math.round(r.rate * 1000) / 10}%`);
  console.log(`[eval] lulus ${metrics.passedCases}/${metrics.cases} · KB-hit ${pct(metrics.kbHit)} · bocor ${metrics.leaks} · klaim biaya salah ${metrics.costClaims} · bocor antar-pengguna ${metrics.crossUserLeaks} · p50/p95 ${metrics.latency.p50}/${metrics.latency.p95} ms · LLM ${pct(metrics.llmShare)} (galat ${metrics.llmErrors}) · biaya/pesan $${metrics.avgCostUsd.toFixed(6)} · total $${metrics.totalCostUsd.toFixed(6)}`);
  for (const r of results.filter((x) => x.error || Object.values(x.checks).some((v) => v === false))) {
    console.log(`  ✗ ${r.case.id}: ${r.error ?? Object.entries(r.checks).filter(([, v]) => v === false).map(([k]) => k).join(', ')}`);
  }
  if (!metrics.targetsMet) {
    console.log('[eval] TARGET MINIMUM BELUM TERCAPAI');
    exitCode = 1;
  }
} finally {
  server.close();
  await pool.end();
}
process.exit(exitCode);
