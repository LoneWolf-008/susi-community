// Uji jalur gagal Tanya SUSI (mode live): key salah, anggaran harian habis, dan timeout. Tiap skenario
// berjalan di proses anak dengan env-nya sendiri (berkas .env tidak diubah, jadi tidak ada yang perlu
// dipulihkan). Pertanyaan FAQ dipaksa lewat LLM (CHATBOT_KB_DIRECT=false) agar jalur kegagalannya teruji.
//
//   DB_NAME=susi_community_e2e OPENROUTER_API_KEY=<dari env> node scripts/failure-paths-live.mjs
// DB harus sekali pakai (_e2e) dan baru di-seed: skenario anggaran butuh biaya hari ini = 0.
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

if (!/_e2e$/.test(process.env.DB_NAME ?? '')) {
  console.error('Jalankan dengan DB_NAME=<nama>_e2e (DB sekali pakai yang baru di-seed).');
  process.exit(2);
}
const SCENARIOS = {
  'key-salah': { OPENROUTER_API_KEY: 'sk-or-v1-key-salah-untuk-uji' },
  anggaran: { CHATBOT_DAILY_BUDGET_USD: '0.000001' },
  timeout: { OPENROUTER_TIMEOUT_MS: '1' },
};

const scenario = process.argv[2];
if (!scenario) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY harus ada di environment proses.');
    process.exit(2);
  }
  let failed = 0;
  for (const [name, overrides] of Object.entries(SCENARIOS)) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), name], {
      stdio: 'inherit', env: { ...process.env, ...overrides },
    });
    if (child.status !== 0) failed += 1;
  }
  console.log(failed ? `\nHASIL: ${failed} skenario GAGAL` : '\nHASIL: semua skenario jalur gagal LULUS');
  process.exit(failed ? 1 : 0);
}

Object.assign(process.env, {
  LLM_PROVIDER: 'openrouter', CHATBOT_KB_DIRECT: 'false', RATE_LIMIT_MAX: '100000',
  CHATBOT_ANON_RATE_LIMIT_PER_MIN: '100000', CHATBOT_ANON_IP_RATE_LIMIT_PER_MIN: '100000',
});
const { pool } = await import('../config/db.js');
const { app } = await import('../app.js');
const { BUDGET_NOTE } = await import('../services/chatbot/replies.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/api`;

const ask = async (message) => {
  const res = await fetch(`${base}/chatbot/message`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
  });
  const body = await res.json().catch(() => null);
  const d = body?.data;
  const [[log]] = d ? await pool.query(`SELECT model, llm_error, cost_usd FROM ask_logs WHERE message_id = ?`, [d.message.id]) : [[null]];
  return {
    status: res.status, reply: d?.message?.content ?? body?.error?.message ?? '', source: d?.source ?? null,
    escalation: d?.escalation_suggested ?? null, llmError: log?.llm_error ?? null, model: log?.model ?? null,
    costUsd: log?.cost_usd == null ? 0 : Number(log.cost_usd),
  };
};

let failed = 0;
const check = (label, ok, note = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${note ? `  (${note})` : ''}`);
};
const show = (a) => console.log(`         J: ${a.reply.replace(/\s+/g, ' ').slice(0, 220)}  [HTTP ${a.status}, ${a.source}, llm_error=${a.llmError ?? '-'}, eskalasi=${a.escalation}]`);

console.log(`\n[${scenario}] ${Object.entries(SCENARIOS[scenario]).map(([k, v]) => `${k}=${k.includes('KEY') ? '<salah>' : v}`).join(' ')}`);
try {
  if (scenario === 'key-salah') {
    const a = await ask('bagaimana cara daftar jadi talenta?');
    show(a);
    check('dijawab (HTTP 200, bukan 500)', a.status === 200 && a.reply.length > 0, `HTTP ${a.status}`);
    check('jawaban dari KB', a.source === 'kb', a.source);
    check('ask_logs mencatat fallback', a.llmError === 'LLMUnavailable', `llm_error=${a.llmError}`);
  } else if (scenario === 'anggaran') {
    const first = await ask('bagaimana cara daftar jadi talenta?');
    show(first);
    check('pesan 1 memakai LLM (biaya hari ini masih 0)', first.status === 200 && first.source === 'llm', `${first.source}, $${first.costUsd}`);
    const second = await ask('bagaimana cara mengajukan kebutuhan komunitas?');
    show(second);
    check('pesan 2 setelah anggaran terlampaui: tetap dijawab dari KB', second.status === 200 && second.source === 'kb', second.source);
    check('pesan ramah mode hemat, bukan galat', second.reply.includes(BUDGET_NOTE) && second.llmError === 'BudgetExceeded', `llm_error=${second.llmError}`);
  } else if (scenario === 'timeout') {
    const a = await ask('apa saja manfaat jadi talenta di SUSI?');
    show(a);
    check('dijawab (HTTP 200)', a.status === 200 && a.reply.length > 0, `HTTP ${a.status}`);
    check('fallback ke entri KB teratas', a.source === 'kb', a.source);
    check('tawaran eskalasi', a.escalation === true, `eskalasi=${a.escalation}`);
    check('ask_logs mencatat timeout', a.llmError === 'LLMTimeout', `llm_error=${a.llmError}`);
  }
  const [[{ cost }]] = await pool.query(`SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM ask_logs`);
  console.log(`         biaya ask_logs kumulatif di DB uji: $${Number(cost).toFixed(6)}`);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
process.exitCode = failed ? 1 : 0;
