// T13: eskalasi Tanya SUSI ke AgenSUSI — dari tombol pengguna sampai draft KB.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData, one, all, createUser } from './helpers.js';
import { setLLMForTests } from '../services/llm/index.js';
import { LLMTimeout } from '../services/llm/errors.js';
import { readKbFile, upsertKbEntries } from '../utils/kbSeed.js';
import { syncKbIndex } from '../services/chatbot/kb.js';
import { spentTodayUsd } from '../services/chatbot/budget.js';

const as = (req, user) => (user ? req.set(user.auth) : req);
const chat = (message, { session, user } = {}) => as(api().post('/api/chatbot/message'), user)
  .send(session ? { message, session_id: session } : { message });
const escalate = (body, user) => as(api().post('/api/chatbot/escalate'), user).send(body);
const queue = (path, user) => as(api().get(`/api/liaison/escalations${path}`), user);
const act = (method, path, user, body = {}) => as(api()[method](`/api/liaison/escalations${path}`), user).send(body);
const notifications = (user) => all(
  `SELECT type, title, ref_type, ref_id FROM notifications WHERE user_id = ? AND type = 'eskalasi' ORDER BY id`, [user.id],
);

describe('Eskalasi ke AgenSUSI (T13)', () => {
  let liaisonA;
  let liaisonB;
  let suspendedLiaison;
  let admin;
  let requester;
  let otherRequester;

  beforeAll(async () => {
    await resetData();
    await upsertKbEntries(pool, await readKbFile());
    await syncKbIndex(pool);
    liaisonA = await createUser('liaison', { name: 'Rina AgenSUSI' });
    liaisonB = await createUser('liaison', { name: 'Doni AgenSUSI' });
    suspendedLiaison = await createUser('liaison', { status: 'DITANGGUHKAN' });
    admin = await createUser('admin');
    requester = await createUser('requester', { name: 'Ibu Sari' });
    otherRequester = await createUser('requester');
  });

  afterEach(() => setLLMForTests(null));

  it('alur lengkap: anonim → tiket + ringkasan → notifikasi → klaim → balas → terlihat di sesi → selesai → draft KB', async () => {
    // 1. Pengguna meminta AgenSUSI; server menyarankan, belum membuat tiket.
    const ask = await chat('saya mau bicara dengan agen susi');
    expect(ask.body.data).toMatchObject({ intent: 'escalation_request', escalation_suggested: true });
    const session = ask.body.data.session_id;
    expect(await one(`SELECT COUNT(*) AS n FROM escalations`)).toEqual({ n: 0 });

    // 2. Anonim wajib memberi kontak balik.
    const noContact = await escalate({ session_id: session });
    expect(noContact.status).toBe(400);
    expect(noContact.body.error.message).toMatch(/email atau nomor WhatsApp/);
    expect((await escalate({ session_id: session, contact: 'bukan kontak' })).status).toBe(400);

    // 3. Tiket + ringkasan LLM (mock) + pesan konfirmasi di sesi.
    const res = await escalate({ session_id: session, contact: 'budi@mail.com' });
    expect(res.status).toBe(201);
    const { escalation, message, available, already_open: alreadyOpen } = res.body.data;
    expect(escalation).toMatchObject({ status: 'pending', priority: 'normal' });
    expect({ available, alreadyOpen }).toEqual({ available: true, alreadyOpen: false });
    expect(message.content).toBe(`Permintaan Anda sudah diteruskan ke AgenSUSI (tiket #${escalation.id}). Balasan mereka akan muncul di percakapan ini atau lewat kontak yang Anda berikan.`);
    const row = await one(`SELECT * FROM escalations WHERE id = ?`, [escalation.id]);
    expect(row).toMatchObject({
      session_id: session, user_id: null, contact: 'budi@mail.com', reason: 'explicit_request', score: 100,
      summary_source: 'llm', summary_model: 'mock', status: 'pending', assigned_to: null,
    });
    expect(row.summary).toBe('[mock] Ringkasan: Pengguna: saya mau bicara dengan agen susi');
    expect(Number(row.summary_cost_usd)).toBeGreaterThan(0);
    expect(await one(`SELECT escalated FROM ask_logs WHERE session_id = ? ORDER BY id DESC LIMIT 1`, [session])).toEqual({ escalated: 1 });

    // 4. Semua liaison aktif diberi notifikasi; yang ditangguhkan & pengguna lain tidak.
    for (const liaison of [liaisonA, liaisonB]) {
      expect(await notifications(liaison)).toEqual([
        { type: 'eskalasi', title: 'Eskalasi chat baru', ref_type: 'escalation', ref_id: escalation.id },
      ]);
    }
    expect(await notifications(suspendedLiaison)).toEqual([]);
    expect(await notifications(requester)).toEqual([]);

    // 5. Tekan lagi → tiket yang sama, tanpa notifikasi baru; saran eskalasi tidak muncul lagi.
    const again = await escalate({ session_id: session, contact: 'budi@mail.com' });
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ already_open: true, escalation: { id: escalation.id }, message: null });
    expect(await notifications(liaisonA)).toHaveLength(1);
    // U6: selama tiket terbuka AI dijeda; pesan disimpan untuk AgenSUSI tanpa jawaban asisten.
    const later = await chat('saya mau bicara dengan agen susi', { session });
    expect(later.body.data).toMatchObject({ escalation_suggested: false, message: null, source: 'handoff' });

    // 6. Antrean liaison: ringkasan, kontak balik, transkrip.
    const list = await queue('', liaisonA);
    expect(list.status).toBe(200);
    expect(list.body.data.items[0]).toMatchObject({
      id: escalation.id, status: 'pending', contact: 'budi@mail.com', user: null, stale: false,
      reasons: ['explicit_request'], summary: row.summary, assigned_to: null,
    });
    expect(list.body.data.counts).toMatchObject({ pending: 1, assigned: 0, mine: 0 });
    const detail = await queue(`/${escalation.id}`, liaisonA);
    expect(detail.body.data.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant', 'user']);

    // 7. Klaim: satu liaison saja; klaim ulang oleh pemilik idempoten.
    const claim = await act('patch', `/${escalation.id}/claim`, liaisonA);
    expect(claim.status).toBe(200);
    expect(claim.body.data).toMatchObject({ status: 'assigned', assigned_to: { id: liaisonA.id, name: 'Rina AgenSUSI' } });
    expect((await act('patch', `/${escalation.id}/claim`, liaisonB)).status).toBe(409);
    expect((await act('patch', `/${escalation.id}/claim`, liaisonA)).status).toBe(200);

    // 8. Balasan: hanya liaison yang mengklaim.
    expect((await act('post', `/${escalation.id}/reply`, liaisonB, { message: 'Saya bantu ya' })).status).toBe(403);
    const reply = await act('post', `/${escalation.id}/reply`, liaisonA, { message: 'Halo, saya Rina dari AgenSUSI. Ada yang bisa saya bantu?' });
    expect(reply.status).toBe(201);
    expect(reply.body.data.message).toMatchObject({ role: 'agent', content: 'Halo, saya Rina dari AgenSUSI. Ada yang bisa saya bantu?' });

    // 9. Pengguna melihat balasan lewat polling sesi (?after=), beserta status tiket.
    const poll = await api().get(`/api/chatbot/session/${session}?after=${later.body.data.user_message_id}`);
    expect(poll.status).toBe(200);
    expect(poll.body.data.messages).toEqual([expect.objectContaining({ role: 'agent', content: 'Halo, saya Rina dari AgenSUSI. Ada yang bisa saya bantu?' })]);
    expect(poll.body.data.escalation).toMatchObject({ id: escalation.id, status: 'assigned' });

    // 10. Selesai + simpan sebagai draft KB (jalur peningkatan AI dari jawaban manusia).
    const resolution = 'Untuk lupa kata sandi, hubungi admin lewat WhatsApp resmi di halaman Tentang Kami.';
    const done = await act('patch', `/${escalation.id}/resolve`, liaisonA, {
      resolution, save_as_kb: true, kb_title: 'Lupa kata sandi', kb_keywords: ['lupa kata sandi', 'reset password'],
    });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'resolved', resolution });
    const kb = await one(`SELECT * FROM kb_entries WHERE id = ?`, [done.body.data.kb_entry_id]);
    expect(kb).toMatchObject({
      title: 'Lupa kata sandi', keywords: 'lupa kata sandi, reset password', reply: resolution, status: 'draft',
      audience: 'all', category: 'eskalasi', source: `Eskalasi #${escalation.id} (jawaban AgenSUSI)`, slug: null,
    });
    // Draft belum dipakai chatbot sampai disetujui admin (T14).
    const asked = await chat('bagaimana kalau saya lupa kata sandi dan perlu reset password?');
    expect(asked.body.data.sources.map((s) => s.id)).not.toContain(kb.id);

    expect((await act('post', `/${escalation.id}/reply`, liaisonA, { message: 'tambahan' })).status).toBe(409);
    expect((await api().get(`/api/chatbot/session/${session}`)).body.data.escalation.status).toBe('resolved');
    expect(await one(`SELECT action, entity_id FROM audit_logs WHERE action = 'RESOLVE_ESCALATION'`))
      .toEqual({ action: 'RESOLVE_ESCALATION', entity_id: escalation.id });
  });

  it('pengguna terdaftar: kontak opsional, menerima notifikasi balasan & penyelesaian; admin bisa menangani', async () => {
    const ask = await chat('saya ditipu talenta, bagaimana cara lapor sengketa?', { user: requester });
    // Jawaban dari KB, tetapi topik sensitif + keluhan (skor 90) → disarankan eskalasi.
    expect(ask.body.data).toMatchObject({ source: 'kb', escalation_suggested: true });
    const res = await escalate({ session_id: ask.body.data.session_id }, requester);
    expect(res.status).toBe(201);
    const { escalation } = res.body.data;
    expect(escalation.priority).toBe('high');
    expect(res.body.data.message.content).toMatch(/Balasan mereka akan muncul di percakapan ini\.$/);
    expect(await one(`SELECT user_id, contact, reason, score FROM escalations WHERE id = ?`, [escalation.id]))
      .toEqual({ user_id: requester.id, contact: null, reason: 'sensitive,complaint', score: 90 });
    expect((await notifications(liaisonA)).at(-1).title).toBe('Eskalasi chat baru (prioritas tinggi)');

    // Admin bukan liaison, tetapi boleh mengklaim, membalas, dan menyelesaikan.
    expect((await act('patch', `/${escalation.id}/claim`, admin)).status).toBe(200);
    expect((await act('post', `/${escalation.id}/reply`, admin, { message: 'Kami cek laporan Anda.' })).status).toBe(201);
    expect((await act('patch', `/${escalation.id}/resolve`, admin, { resolution: 'Sengketa sudah dibuka dan dimediasi admin.' })).status).toBe(200);
    expect((await notifications(requester)).map((n) => n.title)).toEqual(['Balasan dari AgenSUSI', 'Permintaan bantuan Anda sudah diselesaikan']);

    const session = await api().get(`/api/chatbot/session/${ask.body.data.session_id}`).set(requester.auth);
    expect(session.body.data.messages.some((m) => m.role === 'agent' && m.content === 'Kami cek laporan Anda.')).toBe(true);
  });

  it('akses: hanya liaison & admin ke antrean; sesi orang lain tidak bisa dieskalasi', async () => {
    expect((await queue('', requester)).status).toBe(403);
    expect((await queue('')).status).toBe(401);
    expect((await queue('', admin)).status).toBe(200);
    expect((await queue('?status=entah', liaisonA)).status).toBe(400);
    expect((await queue('/abc', liaisonA)).status).toBe(404);
    expect((await queue('/999999', liaisonA)).status).toBe(404);

    const mine = await chat('berapa biaya pakai susi?', { user: requester });
    const sessionId = mine.body.data.session_id;
    expect((await escalate({ session_id: sessionId, contact: 'x@y.id' })).status).toBe(404);
    expect((await escalate({ session_id: sessionId }, otherRequester)).status).toBe(404);
    expect((await escalate({ session_id: crypto.randomUUID(), contact: 'x@y.id' })).status).toBe(404);
  });

  it('anonim yang lalu masuk: sesi diklaim saat eskalasi, sehingga tidak bisa dibaca anonim lagi', async () => {
    const anon = await chat('cara daftar jadi talenta?');
    const sessionId = anon.body.data.session_id;
    expect((await escalate({ session_id: sessionId }, otherRequester)).status).toBe(201);
    expect(await one(`SELECT user_id FROM chat_sessions WHERE id = ?`, [sessionId])).toEqual({ user_id: otherRequester.id });
    expect((await api().get(`/api/chatbot/session/${sessionId}`)).status).toBe(404);
  });

  it('tanpa liaison aktif: tiket tetap dibuat dan pengguna diarahkan ke WhatsApp resmi', async () => {
    await pool.query(`UPDATE users SET status = 'DITANGGUHKAN' WHERE role = 'liaison' AND status = 'AKTIF'`);
    try {
      const ask = await chat('saya mau bicara dengan admin');
      const res = await escalate({ session_id: ask.body.data.session_id, contact: '081234567890' });
      expect(res.status).toBe(201);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.message.content).toMatch(/belum ada AgenSUSI yang bertugas.*WhatsApp resmi SUSI/);
      expect(await one(`SELECT status FROM escalations WHERE id = ?`, [res.body.data.escalation.id])).toEqual({ status: 'pending' });
    } finally {
      await pool.query(`UPDATE users SET status = 'AKTIF' WHERE id IN (?, ?)`, [liaisonA.id, liaisonB.id]);
    }
  });

  it('LLM gagal saat meringkas → ringkasan aturan, tiket tetap dibuat', async () => {
    setLLMForTests({ name: 'gagal', model: 'x', fallbackModels: [], isConfigured: () => true, complete: async () => { throw new LLMTimeout('x'); } });
    const ask = await chat('saya mau bicara dengan manusia, bukan bot');
    const res = await escalate({ session_id: ask.body.data.session_id, contact: 'sari@mail.com' });
    expect(res.status).toBe(201);
    expect(await one(`SELECT summary, summary_source, summary_cost_usd FROM escalations WHERE id = ?`, [res.body.data.escalation.id])).toEqual({
      summary: 'Pengunjung (belum masuk) meminta bantuan AgenSUSI. Pertanyaan terakhir: "saya mau bicara dengan manusia, bukan bot". Alasan: minta bicara dengan AgenSUSI.',
      summary_source: 'rule',
      summary_cost_usd: null,
    });
  });

  it('liaison tidak bisa menyelesaikan tiket yang belum diklaim; admin bisa menutupnya (spam); validasi', async () => {
    const ask = await chat('saya mau bicara dengan agen');
    const { escalation } = (await escalate({ session_id: ask.body.data.session_id, contact: 'z@z.id' })).body.data;
    expect((await act('patch', `/${escalation.id}/resolve`, liaisonA, { resolution: 'Sudah dibantu lewat telepon.' })).status).toBe(409);
    expect((await act('post', `/${escalation.id}/reply`, liaisonA, { message: 'halo' })).status).toBe(409);
    expect((await act('patch', `/${escalation.id}/resolve`, admin, { resolution: 'pendek' })).status).toBe(400);
    expect((await act('patch', `/${escalation.id}/resolve`, admin, { outcome: 'closed', resolution: 'Pesan iseng, ditutup.', save_as_kb: true })).status).toBe(400);
    const closed = await act('patch', `/${escalation.id}/resolve`, admin, { outcome: 'closed', resolution: 'Pesan iseng, ditutup.' });
    expect(closed.body.data).toMatchObject({ status: 'closed', kb_entry_id: null, assigned_to: { id: admin.id } });
    expect((await act('patch', `/${escalation.id}/claim`, liaisonA)).status).toBe(409);
  });

  it('tiket pending > 24 jam ditandai basi di antrean & ringkasan liaison', async () => {
    const ask = await chat('saya mau bicara dengan cs');
    const { escalation } = (await escalate({ session_id: ask.body.data.session_id, contact: 'w@w.id' })).body.data;
    await pool.query(`UPDATE escalations SET created_at = NOW() - INTERVAL 25 HOUR WHERE id = ?`, [escalation.id]);
    const list = await queue('?status=pending', liaisonB);
    expect(list.body.data.items.find((e) => e.id === escalation.id)).toMatchObject({ stale: true });
    expect(list.body.data.counts.stale).toBeGreaterThanOrEqual(1);
    const summary = await api().get('/api/liaison/summary').set(liaisonB.auth);
    expect(summary.body.data.escalations.stale).toBeGreaterThanOrEqual(1);
  });

  it('tanpa giliran tanya-jawab, eskalasi ditolak (butuh konteks untuk AgenSUSI)', async () => {
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO chat_sessions (id, role) VALUES (?, 'public')`, [id]);
    const res = await escalate({ session_id: id, contact: 'a@b.id' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Tuliskan dulu pertanyaan/);
  });

  it('biaya ringkasan eskalasi ikut dihitung ke anggaran harian LLM', async () => {
    const before = await spentTodayUsd(pool);
    const ask = await chat('saya mau bicara dengan petugas');
    await escalate({ session_id: ask.body.data.session_id, contact: 'v@v.id' });
    const [[row]] = await pool.query(`SELECT summary_cost_usd FROM escalations ORDER BY id DESC LIMIT 1`);
    expect(await spentTodayUsd(pool)).toBeCloseTo(before + Number(row.summary_cost_usd), 8);
  });
});
