import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData, one, all, createUser } from './helpers.js';
import { setLLMForTests } from '../services/llm/index.js';
import { createOpenRouterClient } from '../services/llm/openrouter.js';
import { LLMTimeout, LLMRateLimited, LLMUnavailable, LLMEmptyResponse } from '../services/llm/errors.js';
import { FALLBACK_REPLY } from '../services/chatbot/pipeline.js';
import { PROMPT_VERSION } from '../services/chatbot/prompts.js';
import { answerCache } from '../services/chatbot/cache.js';
import { searchKb, syncKbIndex } from '../services/chatbot/kb.js';

const send = (body, auth) => {
  const req = api().post('/api/chatbot/message');
  return (auth ? req.set(auth) : req).send(body);
};
const addKb = async (entry) => {
  const [res] = await pool.query(
    `INSERT INTO kb_entries (title, keywords, reply, audience, status, source, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.title, entry.keywords, entry.reply, entry.audience || 'all', entry.status || 'active', 'uji', entry.sortOrder ?? 10],
  );
  return res.insertId;
};
/** Klien LLM palsu; `complete` boleh melempar galat untuk menguji fallback. */
const fakeLlm = (complete) => ({ name: 'palsu', model: 'palsu', fallbackModels: [], isConfigured: () => true, complete });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAFTAR_REPLY = 'Buka halaman Masuk lalu pilih Daftar dan peran Talenta. Lengkapi keahlian di profil.';
// Dua topik (daftar + biaya): tidak ada satu entri yang mencakup seluruhnya → dijawab LLM dengan konteks KB.
const TWO_TOPICS = 'cara daftar talenta dan berapa biayanya?';

describe('Tanya SUSI: fondasi chatbot (T11, disesuaikan T12)', () => {
  let kbDaftar;
  let kbBiaya;
  let kbTalentaSaja;
  let talent;
  let requester;
  let admin;

  beforeAll(async () => {
    await resetData();
    kbDaftar = await addKb({ title: 'Cara mendaftar sebagai talenta', keywords: 'daftar, registrasi, talenta, akun', reply: DAFTAR_REPLY });
    kbBiaya = await addKb({ title: 'Biaya memakai SUSI', keywords: 'biaya, gratis, bayar', reply: 'SUSI tidak memungut biaya dari komunitas.' });
    kbTalentaSaja = await addKb({
      title: 'Poin reputasi talenta', keywords: 'reputasi, poin, level',
      reply: 'Setiap proyek terverifikasi menambah satu poin reputasi.', audience: 'talent',
    });
    await addKb({ title: 'Draf belum ditinjau', keywords: 'rahasiadraf', reply: 'Isi draf.', status: 'draft' });
    await syncKbIndex(pool);
    talent = await createUser('talent');
    requester = await createUser('requester');
    admin = await createUser('admin');
  });

  afterEach(() => {
    setLLMForTests(null);
    answerCache.clear();
  });

  it('anonim bertanya → dijawab LLM (mock) dengan konteks KB; tersimpan di chat_messages & ask_logs', async () => {
    const res = await send({ message: TWO_TOPICS });
    expect(res.status).toBe(200);
    const { session_id: sessionId, message, source, sources, intent } = res.body.data;
    expect(sessionId).toMatch(UUID);
    expect(source).toBe('llm');
    expect(intent).toBe('howto');
    // Jawaban mock merangkum entri <kb> pertama → bukti konteks KB dikirim ke LLM.
    expect(message.content).toMatch(/^\[mock\] Cara mendaftar sebagai talenta: Buka halaman Masuk/);
    expect(sources).toEqual([
      { id: kbDaftar, title: 'Cara mendaftar sebagai talenta' },
      { id: kbBiaya, title: 'Biaya memakai SUSI' },
    ]);

    const rows = await all(`SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id`, [sessionId]);
    expect(rows).toEqual([{ role: 'user', content: TWO_TOPICS }, { role: 'assistant', content: message.content }]);
    const log = await one(`SELECT * FROM ask_logs WHERE message_id = ?`, [message.id]);
    expect(log).toMatchObject({
      user_id: null, session_id: sessionId, question: TWO_TOPICS, matched: 1, intent: 'howto',
      kb_entry_id: kbDaftar, model: 'mock', prompt_version: PROMPT_VERSION, cache_hit: 0, escalated: 0, llm_error: null,
    });
    expect(log.tokens_in).toBeGreaterThan(0);
    expect(Number(log.cost_usd)).toBeGreaterThan(0);
  });

  it('pesan lanjutan mengirim riwayat sesi + prompt sistem berisi <kb> ke LLM', async () => {
    const first = await send({ message: TWO_TOPICS });
    const sessionId = first.body.data.session_id;
    const seen = [];
    setLLMForTests(fakeLlm(async ({ messages, maxTokens }) => {
      seen.push({ messages, maxTokens });
      return { content: 'oke', model: 'rekam', finishReason: 'stop', usage: { tokensIn: 1, tokensOut: 1, costUsd: 0 }, latencyMs: 1 };
    }));
    const second = await send({ session_id: sessionId, message: 'terus apa lagi?' });
    expect(second.body.data.session_id).toBe(sessionId);
    expect(second.body.data.source).toBe('llm');
    const { messages, maxTokens } = seen[0];
    expect(maxTokens).toBe(350);
    expect(messages[0].role).toBe('system');
    // "terus apa lagi?" tidak punya kata isi: KB dicari bersama pertanyaan sebelumnya.
    expect(messages[0].content).toContain('Cara mendaftar sebagai talenta');
    expect(messages.slice(1).map((m) => [m.role, m.content])).toEqual([
      ['user', TWO_TOPICS],
      ['assistant', first.body.data.message.content],
      ['user', 'terus apa lagi?'],
    ]);
  });

  it('LLM gagal (timeout/429/5xx/kosong) → jawaban entri KB teratas + tawaran eskalasi, bukan 500; galat dicatat', async () => {
    for (const err of [new LLMTimeout('x'), new LLMRateLimited('x'), new LLMUnavailable('x'), new LLMEmptyResponse('x')]) {
      setLLMForTests(fakeLlm(async () => { throw err; }));
      const res = await send({ message: TWO_TOPICS });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ source: 'kb', escalation_suggested: true });
      expect(res.body.data.message.content).toBe(DAFTAR_REPLY);
      const log = await one(`SELECT model, llm_error, tokens_in FROM ask_logs WHERE message_id = ?`, [res.body.data.message.id]);
      expect(log).toEqual({ model: null, llm_error: err.name, tokens_in: null });
    }
  });

  it('pertanyaan seputar SUSI tanpa entri KB → jawaban cadangan yang menawarkan AgenSUSI, tanpa memanggil LLM', async () => {
    setLLMForTests(fakeLlm(async () => { throw new Error('LLM tidak boleh dipanggil'); }));
    const res = await send({ message: 'apakah ada fitur lupa password?' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ source: 'fallback', sources: [], escalation_suggested: true });
    expect(res.body.data.message.content).toBe(FALLBACK_REPLY);
  });

  it('tanpa key OpenRouter → jawaban KB tanpa memanggil jaringan', async () => {
    let calls = 0;
    setLLMForTests(createOpenRouterClient({ apiKey: null, model: 'anthropic/claude-haiku-4.5', fetchImpl: async () => { calls += 1; } }));
    const res = await send({ message: TWO_TOPICS });
    expect(res.body.data.source).toBe('kb');
    expect(res.body.data.message.content).toBe(DAFTAR_REPLY);
    expect(calls).toBe(0);
    const log = await one(`SELECT model, llm_error FROM ask_logs WHERE message_id = ?`, [res.body.data.message.id]);
    expect(log).toEqual({ model: null, llm_error: null });
  });

  it('validasi: pesan kosong, > 500 karakter, atau session_id bukan UUID → 400', async () => {
    expect((await send({ message: '   ' })).status).toBe(400);
    const long = await send({ message: 'a'.repeat(501) });
    expect(long.status).toBe(400);
    expect(long.body.error.message).toMatch(/maksimal 500 karakter/);
    expect((await send({ message: 'halo', session_id: '123' })).status).toBe(400);
    expect((await send({ message: 'a'.repeat(500) })).status).toBe(200);
  });

  it('sesi milik pengguna tidak bisa dibaca/dilanjutkan pengguna lain maupun anonim (404)', async () => {
    const mine = await send({ message: 'cara daftar talenta' }, talent.auth);
    const sessionId = mine.body.data.session_id;
    expect((await one(`SELECT user_id, role FROM chat_sessions WHERE id = ?`, [sessionId]))).toEqual({ user_id: talent.id, role: 'talent' });

    expect((await api().get(`/api/chatbot/session/${sessionId}`).set(talent.auth)).status).toBe(200);
    expect((await api().get(`/api/chatbot/session/${sessionId}`).set(requester.auth)).status).toBe(404);
    expect((await api().get(`/api/chatbot/session/${sessionId}`)).status).toBe(404);
    expect((await send({ session_id: sessionId, message: 'ikut nimbrung' }, requester.auth)).status).toBe(404);
    expect((await send({ session_id: sessionId, message: 'ikut nimbrung' })).status).toBe(404);
    expect((await api().get('/api/chatbot/session/bukan-uuid')).status).toBe(404);
  });

  it('sesi anonim dibuka dengan id-nya; saat pengguna masuk melanjutkannya, sesi diklaim', async () => {
    const anon = await send({ message: 'cara daftar talenta' });
    const sessionId = anon.body.data.session_id;
    const read = await api().get(`/api/chatbot/session/${sessionId}`);
    expect(read.status).toBe(200);
    expect(read.body.data.messages.map((m) => m.role)).toEqual(['user', 'assistant']);

    const cont = await send({ session_id: sessionId, message: 'saya sudah masuk' }, requester.auth);
    expect(cont.status).toBe(200);
    expect(await one(`SELECT user_id FROM chat_sessions WHERE id = ?`, [sessionId])).toEqual({ user_id: requester.id });
    // Setelah diklaim, pemegang id lama (anonim) tidak bisa membaca jawaban yang mungkin berisi data pribadi.
    expect((await api().get(`/api/chatbot/session/${sessionId}`)).status).toBe(404);
  });

  it('GET session ?after= hanya mengembalikan pesan baru (untuk polling)', async () => {
    const a = await send({ message: 'cara daftar talenta' }, requester.auth);
    const sessionId = a.body.data.session_id;
    await send({ session_id: sessionId, message: 'pesan kedua' }, requester.auth);
    const res = await api().get(`/api/chatbot/session/${sessionId}?after=${a.body.data.message.id}`).set(requester.auth);
    expect(res.body.data.messages.map((m) => m.content)[0]).toBe('pesan kedua');
    expect(res.body.data.messages).toHaveLength(2);
  });

  it('filter audiens & status: entri khusus talenta hanya untuk talenta; draf tidak pernah dipakai', async () => {
    const anon = await send({ message: 'berapa poin reputasi' });
    expect(anon.body.data.sources.map((s) => s.id)).not.toContain(kbTalentaSaja);
    const asTalent = await send({ message: 'berapa poin reputasi' }, talent.auth);
    expect(asTalent.body.data.sources.map((s) => s.id)).toContain(kbTalentaSaja);
    const draft = await send({ message: 'rahasiadraf' }, admin.auth);
    expect(draft.body.data.sources).toEqual([]);
  });

  it('token dikirim tetapi tidak sah → 401 (bukan diam-diam anonim); akun ditangguhkan → 403', async () => {
    expect((await send({ message: 'halo' }, { Authorization: 'Bearer palsu' })).status).toBe(401);
    const suspended = await createUser('requester', { status: 'DITANGGUHKAN' });
    expect((await send({ message: 'halo' }, suspended.auth)).status).toBe(403);
  });

  it('sesi dengan 200 pesan → 409 agar memulai percakapan baru', async () => {
    const res = await send({ message: 'cara daftar talenta' });
    const sessionId = res.body.data.session_id;
    const rows = Array.from({ length: 198 }, (_, i) => [sessionId, i % 2 ? 'assistant' : 'user', 'isi']);
    await pool.query(`INSERT INTO chat_messages (session_id, role, content) VALUES ?`, [rows]);
    const full = await send({ session_id: sessionId, message: 'satu lagi' });
    expect(full.status).toBe(409);
    expect(full.body).toEqual({ error: { message: expect.stringMatching(/terlalu panjang/) } });
  });

  it('KB diisi ulang pada tabel kosong: skor FULLTEXT tersinkron & entri relevan teratas', async () => {
    // Kondisi persis setelah db:reset + seed: indeks FULLTEXT kosong, semua baris masuk sekaligus.
    const conn = await pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.query('TRUNCATE TABLE kb_entries');
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      conn.release();
    }
    await addKb({ title: 'Info umum', keywords: 'umum, cara', reply: 'Ada banyak cara memakai SUSI.', sortOrder: 1 });
    const strong = await addKb({
      title: 'Cara daftar', keywords: 'daftar, registrasi, akun baru',
      reply: 'Daftar lewat halaman Masuk lalu pilih Daftar sebagai talenta. Daftar gratis.', sortOrder: 99,
    });
    await syncKbIndex(pool);
    const found = await searchKb(pool, 'gimana cara daftar jadi talenta?', { audiences: ['all', 'public'] });
    // "Info umum" hanya memuat kata tanya "cara" → di bawah ambang, tidak ikut jadi sumber.
    expect(found.map((e) => e.id)).toEqual([strong]);
    expect(found[0].score).toBeGreaterThan(0);
  });

  it('health: hanya admin; melaporkan provider & status tanpa membocorkan key', async () => {
    expect((await api().get('/api/chatbot/health').set(requester.auth)).status).toBe(403);
    const mock = await api().get('/api/chatbot/health').set(admin.auth);
    expect(mock.body.data).toMatchObject({ provider: 'mock', configured: true, status: 'ok' });

    const SECRET = 'sk-or-v1-JANGAN-BOCOR-999';
    const reject = async () => new Response(JSON.stringify({ error: { code: 401, message: `key ${SECRET} invalid` } }), { status: 401 });
    setLLMForTests(createOpenRouterClient({ apiKey: SECRET, model: 'anthropic/claude-haiku-4.5', fetchImpl: reject }));
    const bad = await api().get('/api/chatbot/health').set(admin.auth);
    expect(bad.body.data).toMatchObject({ provider: 'openrouter', configured: true, status: 'error', error: 'LLMUnavailable', http_status: 401 });
    expect(JSON.stringify(bad.body)).not.toContain(SECRET);

    const good = async () => new Response(JSON.stringify({ data: { label: SECRET.slice(0, 12), limit: 5, limit_remaining: 4.9, usage_daily: 0.01, usage_monthly: 0.1, is_free_tier: false } }), { status: 200 });
    setLLMForTests(createOpenRouterClient({ apiKey: SECRET, model: 'anthropic/claude-haiku-4.5', fetchImpl: good }));
    const fine = await api().get('/api/chatbot/health').set(admin.auth);
    expect(fine.body.data).toMatchObject({ status: 'ok', credits: { limit: 5, limitRemaining: 4.9 } });
    expect(JSON.stringify(fine.body)).not.toContain(SECRET.slice(0, 12));
  });
});
