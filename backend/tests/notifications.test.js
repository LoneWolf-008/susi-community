import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import {
  api, resetData, one, all, createUser, createNeed, createApplication, createProject, createDispute,
} from './helpers.js';

const latest = (userId) => one(`SELECT type, title, body, ref_type, ref_id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]);

describe('Notifikasi untuk semua transisi (T3.5)', () => {
  let admin;
  let owner;
  let talent;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    owner = await createUser('requester');
    talent = await createUser('talent');
  });

  it('hasil moderasi kebutuhan → pengaju (setuju & tolak)', async () => {
    const approvedNeed = await createNeed(owner, { moderation: 'PENDING', moderationItem: true });
    const item = await one(`SELECT id FROM moderation_items WHERE ref_id = ?`, [approvedNeed.id]);
    await api().patch(`/api/admin/moderation/${item.id}`).set(admin.auth).send({ decision: 'APPROVED' });
    expect(await latest(owner.id)).toMatchObject({ type: 'moderasi', title: 'Kebutuhan disetujui', ref_type: 'need', ref_id: approvedNeed.id });

    const rejectedNeed = await createNeed(owner, { moderation: 'PENDING', moderationItem: true });
    const item2 = await one(`SELECT id FROM moderation_items WHERE ref_id = ?`, [rejectedNeed.id]);
    await api().patch(`/api/admin/moderation/${item2.id}`).set(admin.auth).send({ decision: 'REJECTED', reject_reason: 'DUPLIKAT' });
    const notif = await latest(owner.id);
    expect(notif).toMatchObject({ title: 'Kebutuhan ditolak' });
    expect(notif.body).toMatch(/DUPLIKAT/);
  });

  it('talenta menyetujui kesepakatan → pemilik', async () => {
    const need = await createNeed(owner);
    const project = await createProject({ need, owner, talent, status: 'AGREEMENT' });
    await api().patch(`/api/projects/${project.id}/agree`).set(talent.auth);
    expect(await latest(owner.id)).toMatchObject({ title: 'Kesepakatan disetujui talenta', ref_id: project.id });
  });

  it('talenta mundur → pemilik; penarikan kebutuhan → pelamar', async () => {
    const need = await createNeed(owner);
    const project = await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
    await api().post(`/api/projects/${project.id}/cancel`).set(talent.auth).send({ reason: 'Sakit cukup lama' });
    expect(await latest(owner.id)).toMatchObject({ title: 'Talenta mundur dari proyek', ref_type: 'need', ref_id: need.id });

    const talent2 = await createUser('talent');
    const another = await createNeed(owner);
    await createApplication(another, talent2);
    await api().post(`/api/needs/${another.id}/withdraw`).set(owner.auth).send({});
    expect(await latest(talent2.id)).toMatchObject({ title: 'Kebutuhan ditutup' });
  });

  it('sengketa dibuka → pihak lawan; pesan admin → kedua pihak', async () => {
    const need = await createNeed(owner);
    const project = await createProject({ need, owner, talent, status: 'AWAITING_VERIFICATION' });
    const opened = await api().post(`/api/projects/${project.id}/dispute`).set(owner.auth).send({ summary: 'Hasil belum lengkap' });
    expect(opened.status).toBe(201);
    expect(await latest(talent.id)).toMatchObject({ type: 'sengketa', title: 'Sengketa dibuka', ref_id: project.id });

    await api().post(`/api/admin/disputes/${opened.body.data.id}/messages`).set(admin.auth).send({ body: 'Mohon kirim bukti' });
    expect(await latest(owner.id)).toMatchObject({ title: 'Pesan baru dari admin', body: 'Mohon kirim bukti' });
    expect(await latest(talent.id)).toMatchObject({ title: 'Pesan baru dari admin' });
  });

  it('balasan di topik → penulis topik (bukan diri sendiri; hormati notif_diskusi)', async () => {
    const topic = await api().post('/api/discussions').set(owner.auth).send({ text: 'Ada yang punya template kas?' });
    const countBefore = (await all(`SELECT id FROM notifications WHERE user_id = ?`, [owner.id])).length;

    await api().post(`/api/discussions/${topic.body.data.id}/replies`).set(owner.auth).send({ text: 'Menjawab sendiri' });
    expect((await all(`SELECT id FROM notifications WHERE user_id = ?`, [owner.id])).length).toBe(countBefore);

    await api().post(`/api/discussions/${topic.body.data.id}/replies`).set(talent.auth).send({ text: 'Saya punya, Bu' });
    expect(await latest(owner.id)).toMatchObject({ type: 'diskusi', title: 'Balasan baru di topik Anda', ref_type: 'topic' });

    await pool.query(`UPDATE user_settings SET notif_diskusi = 0 WHERE user_id = ?`, [owner.id]);
    const countMuted = (await all(`SELECT id FROM notifications WHERE user_id = ?`, [owner.id])).length;
    await api().post(`/api/discussions/${topic.body.data.id}/replies`).set(talent.auth).send({ text: 'Satu lagi' });
    expect((await all(`SELECT id FROM notifications WHERE user_id = ?`, [owner.id])).length).toBe(countMuted);
  });

  it('enum notifications.type sudah memuat "eskalasi" (untuk T13)', async () => {
    await expect(pool.query(
      `INSERT INTO notifications (user_id, type, title) VALUES (?, 'eskalasi', 'Uji eskalasi')`, [admin.id],
    )).resolves.toBeTruthy();
  });

  it('sengketa yang ada tetap dapat dibaca kedua pihak lewat GET /projects/:id/dispute', async () => {
    const need = await createNeed(owner);
    const project = await createProject({ need, owner, talent, status: 'DISPUTED', talentMarkedDone: true });
    await createDispute(project);
    const res = await api().get(`/api/projects/${project.id}/dispute`).set(talent.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'MEDIASI', project_status: 'DISPUTED' });
  });
});
