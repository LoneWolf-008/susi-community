import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, resetData, one, createUser, createNeed, createProject, createDispute,
} from './helpers.js';

describe('Sengketa: pernyataan pihak & akses (T3.7)', () => {
  let admin;
  let owner;
  let talent;
  let stranger;
  let project;
  let dispute;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    owner = await createUser('requester');
    talent = await createUser('talent');
    stranger = await createUser('talent');
    const need = await createNeed(owner);
    project = await createProject({ need, owner, talent, status: 'DISPUTED', talentMarkedDone: true });
    dispute = await createDispute(project);
  });

  it('talenta mengisi pernyataannya → statement_talent + dispute_event', async () => {
    const res = await api().post(`/api/projects/${project.id}/dispute/statement`).set(talent.auth)
      .send({ statement: 'Saya sudah mengirim dua kali sesuai kesepakatan.' });
    expect(res.status).toBe(200);
    expect(res.body.data.statement_talent).toBe('Saya sudah mengirim dua kali sesuai kesepakatan.');
    expect(await one(`SELECT label FROM dispute_events WHERE dispute_id = ? ORDER BY id DESC LIMIT 1`, [dispute.id]))
      .toEqual({ label: 'Talenta mengisi pernyataan' });
  });

  it('pemilik mengisi pernyataan komunitas; orang luar → 403; kosong → 400', async () => {
    const ok = await api().post(`/api/projects/${project.id}/dispute/statement`).set(owner.auth).send({ statement: 'Formulir belum bisa diisi dari HP.' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.statement_community).toBe('Formulir belum bisa diisi dari HP.');
    expect((await api().post(`/api/projects/${project.id}/dispute/statement`).set(stranger.auth).send({ statement: 'Ikut campur' })).status).toBe(403);
    expect((await api().post(`/api/projects/${project.id}/dispute/statement`).set(owner.auth).send({ statement: '   ' })).status).toBe(400);
  });

  it('pihak proyek dan admin bisa membaca sengketa beserta pesan admin; orang luar 403', async () => {
    await api().post(`/api/admin/disputes/${dispute.id}/messages`).set(admin.auth).send({ body: 'Kita jadwalkan mediasi Jumat.' });
    for (const user of [owner, talent, admin]) {
      const res = await api().get(`/api/projects/${project.id}/dispute`).set(user.auth);
      expect(res.status).toBe(200);
      expect(res.body.data.messages.map((m) => m.body)).toContain('Kita jadwalkan mediasi Jumat.');
      expect(res.body.data.events.length).toBeGreaterThan(0);
    }
    expect((await api().get(`/api/projects/${project.id}/dispute`).set(stranger.auth)).status).toBe(403);
  });

  it('setelah diputus admin, pernyataan tidak bisa diubah lagi → 409', async () => {
    await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth).send({ decision: 'EXTEND_7_DAYS' });
    const res = await api().post(`/api/projects/${project.id}/dispute/statement`).set(talent.auth).send({ statement: 'Tambahan' });
    expect(res.status).toBe(409);
  });

  it('proyek tanpa sengketa → GET 404', async () => {
    const need = await createNeed(owner);
    const clean = await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
    expect((await api().get(`/api/projects/${clean.id}/dispute`).set(owner.auth)).status).toBe(404);
  });
});

describe('Mading: simpan posisi catatan (T3.7)', () => {
  let author;
  let other;
  let topicId;

  beforeAll(async () => {
    author = await createUser('requester');
    other = await createUser('requester');
    const res = await api().post('/api/discussions').set(author.auth).send({ text: 'Catatan bisa digeser' });
    topicId = res.body.data.id;
  });

  it('penulis menyimpan posisi; nilai di luar batas → 400', async () => {
    const res = await api().patch(`/api/discussions/${topicId}/position`).set(author.auth).send({ pos_x: 420, pos_y: 180, rotation: -3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: topicId, pos_x: 420, pos_y: 180, rotation: -3 });
    expect((await api().patch(`/api/discussions/${topicId}/position`).set(author.auth).send({ pos_x: -5, pos_y: 10 })).status).toBe(400);
  });

  it('orang lain → 403; topik tidak ada → 404', async () => {
    expect((await api().patch(`/api/discussions/${topicId}/position`).set(other.auth).send({ pos_x: 1, pos_y: 1 })).status).toBe(403);
    expect((await api().patch('/api/discussions/999999/position').set(author.auth).send({ pos_x: 1, pos_y: 1 })).status).toBe(404);
  });
});
