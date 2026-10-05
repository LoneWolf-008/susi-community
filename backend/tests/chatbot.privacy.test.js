// T15: privasi Tanya SUSI — toggle AI & penyimpanan riwayat, hapus riwayat, retensi, hash IP.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData, one, all, createUser } from './helpers.js';
import { setLLMForTests } from '../services/llm/index.js';
import { readKbFile, upsertKbEntries } from '../utils/kbSeed.js';
import { syncKbIndex } from '../services/chatbot/kb.js';
import { answerCache } from '../services/chatbot/cache.js';
import { NOT_STORED } from '../services/chatbot/privacy.js';
import { purgeExpiredChats, startRetentionJob } from '../services/chatbot/retention.js';
import { hashIp } from '../middleware/rateLimit.js';

// Dua topik → tidak ada satu entri yang mencakup seluruhnya → jalur LLM (bila diizinkan).
const TWO_TOPICS = 'apa itu agensusi dan berapa biayanya?';
const USAGE = { tokensIn: 100, tokensOut: 20, costUsd: 0.0002, costEstimated: false };

function recordingLlm(reply = 'Jawaban model.') {
  const calls = [];
  const client = {
    name: 'rekam', model: 'rekam-model', fallbackModels: [], isConfigured: () => true,
    async complete({ messages }) {
      calls.push(messages);
      return { content: reply, model: 'rekam-model', finishReason: 'stop', usage: USAGE, latencyMs: 5 };
    },
    async* stream({ messages }) {
      calls.push(messages);
      yield { type: 'delta', content: reply };
      yield { type: 'done', content: reply, model: 'rekam-model', finishReason: 'stop', usage: USAGE, latencyMs: 5 };
    },
  };
  return { client, calls };
}
/** LLM yang tidak boleh dipanggil: galat biasa (bukan LLMError) → 500, test langsung gagal. */
const forbiddenLlm = {
  name: 'terlarang', model: 'x', fallbackModels: [], isConfigured: () => true,
  async complete() { throw new Error('LLM tidak boleh dipanggil'); },
  // eslint-disable-next-line require-yield
  async* stream() { throw new Error('LLM tidak boleh dipanggil'); },
};

const as = (req, user) => (user ? req.set(user.auth) : req);
const chat = (message, { session, user } = {}) => as(api().post('/api/chatbot/message'), user)
  .send(session ? { message, session_id: session } : { message });
const settings = (user, body) => as(api().patch('/api/settings'), user).send(body);
const parseSse = (text) => text.split('\n\n').filter((b) => b.trim()).map((block) => ({
  event: /^event: (.+)$/m.exec(block)?.[1],
  data: JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? 'null'),
}));
async function stream(body, user) {
  const req = api().post('/api/chatbot/stream')
    .buffer(true)
    .parse((res, cb) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => cb(null, data));
    });
  const res = await as(req, user).send(body);
  return parseSse(res.body);
}

describe('Privasi Tanya SUSI (T15)', () => {
  let liaison;

  beforeAll(async () => {
    await resetData();
    await upsertKbEntries(pool, await readKbFile());
    await syncKbIndex(pool);
    liaison = await createUser('liaison');
  });

  afterEach(() => {
    setLLMForTests(null);
    answerCache.clear();
  });

  describe('pengaturan', () => {
    it('bawaan aktif; bisa dimatikan lewat PATCH /settings; nilai tidak sah → 400', async () => {
      const user = await createUser('requester');
      const initial = await as(api().get('/api/settings'), user);
      expect(initial.body.data).toMatchObject({ allows_ai_chat: 1, allows_chat_history_storage: 1 });

      const res = await settings(user, { allows_ai_chat: false, allows_chat_history_storage: false });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ allows_ai_chat: 0, allows_chat_history_storage: 0 });
      expect((await settings(user, { allows_ai_chat: 'tidak' })).status).toBe(400);
    });
  });

  describe('allows_ai_chat = 0', () => {
    it('pertanyaan yang biasanya ke LLM dijawab dari KB tanpa memanggil LLM (JSON & stream)', async () => {
      const user = await createUser('requester');
      await settings(user, { allows_ai_chat: false });
      setLLMForTests(forbiddenLlm);

      const res = await chat(TWO_TOPICS, { user });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ source: 'kb', stored: true });
      expect(res.body.data.sources.length).toBeGreaterThan(0);

      const events = await stream({ message: TWO_TOPICS }, user);
      expect(events.map((e) => e.event)).toEqual(['start', 'delta', 'done']);
      expect(events.at(-1).data).toMatchObject({ source: 'kb' });

      // Pembanding: pengguna lain (AI diizinkan) memang lewat LLM untuk pertanyaan yang sama.
      const { client, calls } = recordingLlm();
      setLLMForTests(client);
      const other = await chat(TWO_TOPICS, { user: await createUser('requester') });
      expect(other.body.data.source).toBe('llm');
      expect(calls).toHaveLength(1);
    });

    it('ringkasan eskalasi dibuat tanpa LLM', async () => {
      const user = await createUser('requester');
      await settings(user, { allows_ai_chat: false });
      setLLMForTests(forbiddenLlm);
      const ask = await chat('saya mau bicara dengan agen susi', { user });
      const res = await as(api().post('/api/chatbot/escalate'), user).send({ session_id: ask.body.data.session_id });
      expect(res.status).toBe(201);
      const row = await one(`SELECT summary, summary_source, summary_cost_usd FROM escalations WHERE id = ?`, [res.body.data.escalation.id]);
      expect(row).toMatchObject({ summary_source: 'rule', summary_cost_usd: null });
      expect(row.summary).toContain('saya mau bicara dengan agen susi');
    });
  });

  describe('allows_chat_history_storage = 0', () => {
    it('isi pesan & pertanyaan tidak disimpan, metadata tetap; riwayat tidak dikirim ke LLM', async () => {
      const user = await createUser('talent');
      await settings(user, { allows_chat_history_storage: false });
      const { client, calls } = recordingLlm('Jawaban rahasia model.');
      setLLMForTests(client);

      const first = await chat(TWO_TOPICS, { user });
      expect(first.body.data).toMatchObject({ source: 'llm', stored: false, message: { content: 'Jawaban rahasia model.' } });
      const session = first.body.data.session_id;
      // Topik sama, kalimat lain (bukan cache) → lewat LLM lagi.
      const second = await chat('kalau agensusi, biayanya berapa?', { user, session });
      expect(second.body.data).toMatchObject({ source: 'llm', stored: false });
      expect(calls).toHaveLength(2);

      const messages = await all(`SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id`, [session]);
      expect(messages).toEqual([
        { role: 'user', content: NOT_STORED }, { role: 'assistant', content: NOT_STORED },
        { role: 'user', content: NOT_STORED }, { role: 'assistant', content: NOT_STORED },
      ]);
      const logs = await all(`SELECT question, intent, matched, user_id, cost_usd FROM ask_logs WHERE session_id = ? ORDER BY id`, [session]);
      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({ question: '', intent: 'faq', matched: 1, user_id: user.id });
      expect(Number(logs[0].cost_usd)).toBeGreaterThan(0);

      // Giliran kedua: hanya prompt sistem + pertanyaan baru (tanpa riwayat).
      const sent = calls.at(-1);
      expect(sent.map((m) => m.role)).toEqual(['system', 'user']);
      expect(sent[1].content).toBe('kalau agensusi, biayanya berapa?');
    });

    it('stream: event start membawa stored=false', async () => {
      const user = await createUser('requester');
      await settings(user, { allows_chat_history_storage: false });
      setLLMForTests(forbiddenLlm);
      const events = await stream({ message: 'berapa biaya pakai susi?' }, user);
      expect(events[0]).toMatchObject({ event: 'start', data: { stored: false } });
      expect(events.at(-1).data).toMatchObject({ stored: false, source: 'kb' });
    });

    it('regresi: sinyal sensitif tetap terbaca dari teks di memori; ringkasan eskalasi tanpa isi chat & tanpa LLM', async () => {
      const user = await createUser('requester');
      await settings(user, { allows_chat_history_storage: false });
      const { client, calls } = recordingLlm();
      setLLMForTests(client);
      const ask = await chat('saya ditipu talenta, bagaimana cara lapor sengketa?', { user });
      expect(ask.body.data).toMatchObject({ escalation_suggested: true, stored: false });

      const llmCalls = calls.length;
      const res = await as(api().post('/api/chatbot/escalate'), user).send({ session_id: ask.body.data.session_id });
      expect(res.status).toBe(201);
      expect(calls).toHaveLength(llmCalls);
      const row = await one(`SELECT summary, summary_source FROM escalations WHERE id = ?`, [res.body.data.escalation.id]);
      expect(row.summary_source).toBe('rule');
      expect(row.summary).toContain('Riwayat chat tidak disimpan');
      expect(row.summary).not.toContain('ditipu');
    });
  });

  describe('hapus riwayat', () => {
    it('DELETE /chatbot/session/:id (anonim pemegang id): sesi, pesan, tiket, & notifikasinya hilang; ask_logs dianonimkan', async () => {
      setLLMForTests(recordingLlm('Ringkasan percakapan.').client);
      const ask = await chat('saya mau bicara dengan agen susi');
      const session = ask.body.data.session_id;
      const esc = await api().post('/api/chatbot/escalate').send({ session_id: session, contact: 'budi@mail.com' });
      expect(esc.status).toBe(201);
      const escalationId = esc.body.data.escalation.id;
      const liaisonNotifs = () => all(`SELECT id FROM notifications WHERE user_id = ? AND ref_type = 'escalation' AND ref_id = ?`, [liaison.id, escalationId]);
      expect(await liaisonNotifs()).toHaveLength(1);
      const logIds = (await all(`SELECT id FROM ask_logs WHERE session_id = ?`, [session])).map((r) => r.id);

      const res = await api().delete(`/api/chatbot/session/${session}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deleted: 1 });
      expect(await one(`SELECT COUNT(*) AS n FROM chat_sessions WHERE id = ?`, [session])).toEqual({ n: 0 });
      expect(await one(`SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ?`, [session])).toEqual({ n: 0 });
      expect(await one(`SELECT COUNT(*) AS n FROM escalations WHERE id = ?`, [escalationId])).toEqual({ n: 0 });
      expect(await liaisonNotifs()).toEqual([]);
      const logs = await all(`SELECT question, session_id, user_id, intent FROM ask_logs WHERE id IN (?)`, [logIds]);
      expect(logs).toEqual([{ question: '', session_id: null, user_id: null, intent: 'escalation_request' }]);
      expect((await api().get(`/api/chatbot/session/${session}`)).status).toBe(404);
      expect((await api().delete(`/api/chatbot/session/${session}`)).status).toBe(404);
    });

    it('sesi milik pengguna lain / id tak sah → 404 dan tidak ada yang terhapus', async () => {
      setLLMForTests(forbiddenLlm);
      const owner = await createUser('requester');
      const intruder = await createUser('requester');
      const session = (await chat('berapa biaya pakai susi?', { user: owner })).body.data.session_id;
      expect((await as(api().delete(`/api/chatbot/session/${session}`), intruder)).status).toBe(404);
      expect((await api().delete(`/api/chatbot/session/${session}`)).status).toBe(404);
      expect((await api().delete('/api/chatbot/session/bukan-uuid')).status).toBe(404);
      expect(await one(`SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ?`, [session])).toEqual({ n: 2 });
    });

    it('DELETE /chatbot/history: semua sesi milik pengguna, tidak menyentuh pengguna lain; wajib masuk', async () => {
      setLLMForTests(forbiddenLlm);
      const user = await createUser('talent');
      const other = await createUser('talent');
      const s1 = (await chat('berapa biaya pakai susi?', { user })).body.data.session_id;
      const s2 = (await chat('berapa biaya pakai susi?', { user })).body.data.session_id;
      const s3 = (await chat('berapa biaya pakai susi?', { user: other })).body.data.session_id;
      expect(new Set([s1, s2, s3]).size).toBe(3);

      expect((await api().delete('/api/chatbot/history')).status).toBe(401);
      const res = await as(api().delete('/api/chatbot/history'), user);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deleted: 2 });
      expect(await all(`SELECT id FROM chat_sessions WHERE id IN (?)`, [[s1, s2, s3]])).toEqual([{ id: s3 }]);
      expect(await one(`SELECT COUNT(*) AS n FROM ask_logs WHERE user_id = ?`, [user.id])).toEqual({ n: 0 });
      expect(await one(`SELECT COUNT(*) AS n FROM ask_logs WHERE user_id = ?`, [other.id])).toEqual({ n: 1 });
    });
  });

  describe('retensi', () => {
    const OLD = 'NOW() - INTERVAL 100 DAY';
    const RECENT = 'NOW() - INTERVAL 1 DAY';
    const addSession = async (id, lastActive) => {
      await pool.query(`INSERT INTO chat_sessions (id, role, started_at, last_active_at) VALUES (?, 'public', ${lastActive}, ${lastActive})`, [id]);
    };
    const addMessage = (sessionId, content, at) => pool.query(
      `INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, 'user', ?, ${at})`, [sessionId, content],
    );
    const addLog = (sessionId, question, at) => pool.query(
      `INSERT INTO ask_logs (session_id, question, matched, intent, created_at) VALUES (?, ?, 1, 'faq', ${at})`, [sessionId, question],
    );
    const addEscalation = async (sessionId, status) => {
      const [res] = await pool.query(
        `INSERT INTO escalations (session_id, reason, summary, status) VALUES (?, 'user_request', 'Ringkasan lama', ?)`, [sessionId, status],
      );
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id) VALUES (?, 'eskalasi', 'Eskalasi chat baru', 'Ringkasan lama', 'escalation', ?)`,
        [liaison.id, res.insertId],
      );
      return res.insertId;
    };

    it('pesan & sesi lama dihapus, pertanyaan lama dianonimkan; sesi dengan tiket terbuka dilewati', async () => {
      const ids = {
        oldOnly: '00000000-0000-4000-8000-000000000001',
        mixed: '00000000-0000-4000-8000-000000000002',
        openTicket: '00000000-0000-4000-8000-000000000003',
        resolvedTicket: '00000000-0000-4000-8000-000000000004',
      };
      await addSession(ids.oldOnly, OLD);
      await addMessage(ids.oldOnly, 'pesan lama', OLD);
      await addLog(ids.oldOnly, 'pertanyaan lama', OLD);
      await addSession(ids.mixed, RECENT);
      await addMessage(ids.mixed, 'pesan lama campur', OLD);
      await addMessage(ids.mixed, 'pesan baru', RECENT);
      await addLog(ids.mixed, 'pertanyaan baru', RECENT);
      await addSession(ids.openTicket, OLD);
      await addMessage(ids.openTicket, 'butuh bantuan', OLD);
      await addLog(ids.openTicket, 'pertanyaan tiket terbuka', OLD);
      const openId = await addEscalation(ids.openTicket, 'pending');
      await addSession(ids.resolvedTicket, OLD);
      await addMessage(ids.resolvedTicket, 'sudah dibantu', OLD);
      const resolvedId = await addEscalation(ids.resolvedTicket, 'resolved');

      expect(await purgeExpiredChats(pool, { days: 0 })).toEqual({ days: 0, questions: 0, messages: 0, sessions: 0 });
      const result = await purgeExpiredChats(pool, { days: 90 });
      expect(result).toEqual({ days: 90, questions: 1, messages: 3, sessions: 2 });

      const sessions = (await all(`SELECT id FROM chat_sessions WHERE id IN (?) ORDER BY id`, [Object.values(ids)])).map((r) => r.id);
      expect(sessions).toEqual([ids.mixed, ids.openTicket]);
      expect(await all(`SELECT content FROM chat_messages WHERE session_id IN (?) ORDER BY id`, [Object.values(ids)])).toEqual([
        { content: 'pesan baru' }, { content: 'butuh bantuan' },
      ]);
      const questions = (await all(`SELECT question FROM ask_logs WHERE question <> '' ORDER BY id`)).map((r) => r.question);
      expect(questions).toEqual(expect.arrayContaining(['pertanyaan baru', 'pertanyaan tiket terbuka']));
      expect(questions).not.toContain('pertanyaan lama');
      expect(await all(`SELECT id FROM escalations WHERE id IN (?)`, [[openId, resolvedId]])).toEqual([{ id: openId }]);
      expect(await all(`SELECT ref_id FROM notifications WHERE ref_type = 'escalation' AND ref_id IN (?)`, [[openId, resolvedId]]))
        .toEqual([{ ref_id: openId }]);

      // Idempoten: putaran kedua tidak menemukan apa-apa lagi.
      expect(await purgeExpiredChats(pool, { days: 90 })).toEqual({ days: 90, questions: 0, messages: 0, sessions: 0 });
    });

    it('job harian: tidak berjalan bila retensi dimatikan; bisa dihentikan', () => {
      expect(startRetentionJob(pool, { days: 0 })).toBeNull();
      const stop = startRetentionJob(pool, { days: 90, firstRunMs: 60 * 60 * 1000 });
      expect(typeof stop).toBe('function');
      stop();
    });
  });

  it('kunci rate limit anonim memakai hash IP, bukan IP mentah', () => {
    const hashed = hashIp('203.0.113.7');
    expect(hashed).toBe(hashIp('203.0.113.7'));
    expect(hashed).not.toBe(hashIp('203.0.113.8'));
    expect(hashed).not.toContain('203.0.113.7');
    expect(hashed).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});
