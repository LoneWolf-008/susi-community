// T14 (BE): saran pertanyaan, manajer KB admin, pertanyaan tak terjawab, statistik Tanya SUSI.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData, one, createUser } from './helpers.js';
import { setLLMForTests } from '../services/llm/index.js';
import { readKbFile, upsertKbEntries } from '../utils/kbSeed.js';
import { syncKbIndex } from '../services/chatbot/kb.js';
import { SUGGESTIONS } from '../services/chatbot/suggestions.js';

const as = (req, user) => (user ? req.set(user.auth) : req);
const chat = (message, user) => as(api().post('/api/chatbot/message'), user).send({ message });
const kb = (method, path, user, body) => as(api()[method](`/api/admin/kb${path}`), user).send(body);

describe('Admin Tanya SUSI & saran (T14)', () => {
  let admin;
  let requester;

  beforeAll(async () => {
    await resetData();
    await upsertKbEntries(pool, await readKbFile());
    await syncKbIndex(pool);
    admin = await createUser('admin');
    requester = await createUser('requester');
  });

  afterEach(() => setLLMForTests(null));

  it('GET /chatbot/suggestions mengikuti peran', async () => {
    expect((await api().get('/api/chatbot/suggestions')).body.data).toEqual({ suggestions: SUGGESTIONS.public });
    expect((await api().get('/api/chatbot/suggestions').set(requester.auth)).body.data).toEqual({ suggestions: SUGGESTIONS.requester });
  });

  it('manajer KB hanya untuk admin; daftar dengan filter, pencarian, dan hitungan per status', async () => {
    expect((await kb('get', '', requester)).status).toBe(403);
    const entries = (await readKbFile()).length;
    const all = await kb('get', '?limit=50', admin);
    expect(all.status).toBe(200);
    expect(all.body.data.counts).toEqual({ active: entries, draft: 0, archived: 0 });
    expect(all.body.data.total).toBe(entries);
    const search = await kb('get', '?search=sengketa', admin);
    expect(search.body.data.items.map((e) => e.slug)).toContain('sengketa');
    expect((await kb('get', '?status=entah', admin)).status).toBe(400);
  });

  it('entri aktif wajib bersumber; entri baru langsung dipakai chatbot & cache jawaban dikosongkan', async () => {
    const reply = 'Belum ada fitur atur ulang kata sandi; hubungi admin lewat kontak resmi di halaman Tentang Kami.';
    const noSource = await kb('post', '', admin, { title: 'Lupa kata sandi akun', keywords: ['lupa kata sandi', 'reset'], reply, status: 'active' });
    expect(noSource.status).toBe(400);
    expect(noSource.body.error.message).toMatch(/wajib mencantumkan sumber/);

    // Isi cache dulu: pertanyaan dua topik dijawab LLM lalu di-cache.
    let calls = 0;
    setLLMForTests({
      name: 'hitung', model: 'hitung', fallbackModels: [], isConfigured: () => true,
      complete: async () => { calls += 1; return { content: 'Jawaban model.', model: 'hitung', finishReason: 'stop', usage: { tokensIn: 1, tokensOut: 1, costUsd: 0 }, latencyMs: 1 }; },
    });
    const twoTopics = 'apa itu agensusi dan berapa biayanya?';
    await chat(twoTopics);
    expect((await chat(twoTopics)).body.data.source).toBe('cache');
    expect(calls).toBe(1);

    const created = await kb('post', '', admin, {
      title: 'Lupa kata sandi akun', category: 'akun', keywords: ['lupa kata sandi', 'reset password', 'atur ulang'],
      reply, status: 'active', source: 'Keputusan tim (uji)',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'active', audience: 'all', category: 'akun', keywords: 'lupa kata sandi, reset password, atur ulang' });

    const answer = await chat('saya lupa kata sandi, bagaimana reset password?');
    expect(answer.body.data).toMatchObject({ source: 'kb', message: { content: reply } });
    // Perubahan KB mengosongkan cache: pertanyaan yang sama kembali melewati pipeline.
    await chat(twoTopics);
    expect(calls).toBe(2);
    expect(await one(`SELECT action FROM audit_logs WHERE entity = 'kb_entries' ORDER BY id DESC LIMIT 1`)).toEqual({ action: 'CREATE_KB' });
  });

  it('draft dari eskalasi: tampil dengan id tiket, disetujui admin → pertanyaan serupa terjawab', async () => {
    const [draft] = await pool.query(
      `INSERT INTO kb_entries (title, category, keywords, reply, audience, status, source, sort_order)
       VALUES ('Ganti email akun', 'eskalasi', 'ganti email, ubah email akun', 'Perubahan email akun dibantu admin lewat kontak resmi di halaman Tentang Kami.', 'all', 'draft', 'Eskalasi #77 (jawaban AgenSUSI)', 1000)`,
    );
    const [session] = await pool.query(`INSERT INTO chat_sessions (id, role) VALUES (UUID(), 'public')`);
    expect(session.affectedRows).toBe(1);
    const [[{ id: sessionId }]] = await pool.query(`SELECT id FROM chat_sessions ORDER BY started_at DESC LIMIT 1`);
    await pool.query(
      `INSERT INTO escalations (session_id, reason, summary, status, kb_entry_id, resolution) VALUES (?, 'explicit_request', 'ringkasan', 'resolved', ?, 'x')`,
      [sessionId, draft.insertId],
    );

    // Draft belum dipakai chatbot.
    const before = await chat('bagaimana cara ganti email akun?');
    expect(before.body.data.sources.map((s) => s.id)).not.toContain(draft.insertId);

    const drafts = await kb('get', '?status=draft', admin);
    expect(drafts.body.data.items[0]).toMatchObject({ id: draft.insertId, status: 'draft' });
    expect(drafts.body.data.items[0].escalation_id).toBeGreaterThan(0);

    const approved = await kb('patch', `/${draft.insertId}`, admin, { status: 'active' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('active');
    const after = await chat('bagaimana cara ganti email akun?');
    expect(after.body.data).toMatchObject({ source: 'kb', message: { content: 'Perubahan email akun dibantu admin lewat kontak resmi di halaman Tentang Kami.' } });
    expect(await one(`SELECT action FROM audit_logs WHERE entity = 'kb_entries' AND entity_id = ?`, [draft.insertId])).toEqual({ action: 'APPROVE_KB' });

    // Arsip → tidak dipakai lagi.
    await kb('patch', `/${draft.insertId}`, admin, { status: 'archived' });
    const archived = await chat('bagaimana cara ganti email akun?');
    expect(archived.body.data.sources.map((s) => s.id)).not.toContain(draft.insertId);
  });

  it('validasi ubah entri: id tidak ada, tanpa perubahan, aktif tanpa sumber', async () => {
    expect((await kb('patch', '/999999', admin, { status: 'active' })).status).toBe(404);
    expect((await kb('patch', '/abc', admin, { status: 'active' })).status).toBe(404);
    const [noSource] = await pool.query(
      `INSERT INTO kb_entries (title, keywords, reply, status) VALUES ('Tanpa sumber', 'x', 'Isi tanpa sumber dokumen.', 'draft')`,
    );
    expect((await kb('patch', `/${noSource.insertId}`, admin, {})).status).toBe(400);
    const res = await kb('patch', `/${noSource.insertId}`, admin, { status: 'active' });
    expect(res.status).toBe(400);
    expect((await kb('patch', `/${noSource.insertId}`, admin, { status: 'active', source: 'PRD §1' })).status).toBe(200);
  });

  it('pertanyaan tak terjawab: dikelompokkan per pertanyaan baku, termasuk 👎, tanpa penanda samaran', async () => {
    await pool.query(`DELETE FROM ask_logs`);
    const log = (question, { matched = 0, intent = 'faq', feedback = null } = {}) => pool.query(
      `INSERT INTO ask_logs (question, matched, intent, feedback) VALUES (?, ?, ?, ?)`, [question, matched, intent, feedback],
    );
    await log('Bisa bikin game?');
    await log('bisa bikin game');
    await log('bisa bikin GAME??', { intent: 'complaint' });
    await log('nomor saya [nomor disamarkan], kapan dihubungi?');
    await log('berapa biaya pakai susi?', { matched: 1, feedback: -1 });
    await log('resep nasi goreng', { intent: 'out_of_scope' });
    await log('halo', { intent: 'smalltalk' });
    await log('cara daftar', { matched: 1, feedback: 1 });

    const res = await api().get('/api/admin/chatbot/unanswered').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i) => [i.question, i.count, i.unanswered, i.thumbs_down])).toEqual([
      ['bisa bikin GAME??', 3, 3, 0],
      ['berapa biaya pakai susi?', 1, 0, 1],
      ['kapan dihubungi?', 1, 1, 0],
    ]);
    expect((await api().get('/api/admin/chatbot/unanswered').set(requester.auth)).status).toBe(403);
  });

  it('statistik hari ini: jawaban, porsi LLM/cache, belum terjawab, umpan balik, biaya vs anggaran', async () => {
    await pool.query(`DELETE FROM ask_logs`);
    await pool.query(
      `INSERT INTO ask_logs (question, matched, intent, model, cache_hit, feedback, latency_ms, cost_usd) VALUES
         ('a', 1, 'faq', 'mock', 0, 1, 100, 0.25),
         ('b', 1, 'faq', NULL, 1, NULL, 10, NULL),
         ('c', 0, 'howto', NULL, 0, -1, 30, NULL),
         ('d', 0, 'out_of_scope', NULL, 0, NULL, 20, NULL)`,
    );
    const res = await api().get('/api/admin/chatbot/stats').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.today).toEqual({ answers: 4, llm: 1, cache: 1, unanswered: 1, thumbs_up: 1, thumbs_down: 1, avg_latency_ms: 40 });
    expect(res.body.data).toMatchObject({
      budget_usd: 1, budget_exceeded: false, llm: { provider: 'mock', configured: true },
    });
    expect(res.body.data.cost_today_usd).toBeGreaterThanOrEqual(0.25);
    expect(res.body.data.kb.active).toBeGreaterThan(40);
  });
});
