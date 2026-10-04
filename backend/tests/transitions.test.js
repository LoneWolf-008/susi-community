import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, resetData, one, all, createUser, createNeed, createApplication, createProject,
} from './helpers.js';

const AGREEMENT = { scope: 'Lingkup kerja uji', done_definition: 'Selesai bila uji lulus' };

describe('Transisi tambahan PRD §7 (T3.2)', () => {
  let owner;
  let other;
  let talent;
  let talent2;
  let liaison;

  beforeAll(async () => {
    await resetData();
    owner = await createUser('requester');
    other = await createUser('requester');
    talent = await createUser('talent');
    talent2 = await createUser('talent');
    liaison = await createUser('liaison');
  });

  describe('POST /needs/:id/withdraw', () => {
    it('pemilik menarik kebutuhan tanpa proyek → CLOSED, pelamar diberi tahu', async () => {
      const need = await createNeed(owner);
      await createApplication(need, talent);
      const res = await api().post(`/api/needs/${need.id}/withdraw`).set(owner.auth).send({ reason: 'Sudah tidak perlu' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ id: need.id, status: 'CLOSED' });
      expect(await one(`SELECT title FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [talent.id]))
        .toEqual({ title: 'Kebutuhan ditutup' });
      const log = await one(`SELECT meta FROM audit_logs WHERE action = 'CLOSE' AND entity_id = ?`, [need.id]);
      expect(JSON.parse(log.meta)).toEqual({ reason: 'Sudah tidak perlu' });
    });

    it('bukan pemilik → 404; kebutuhan dengan proyek aktif → 409', async () => {
      const need = await createNeed(owner);
      expect((await api().post(`/api/needs/${need.id}/withdraw`).set(other.auth).send({})).status).toBe(404);
      await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
      expect((await api().post(`/api/needs/${need.id}/withdraw`).set(owner.auth).send({})).status).toBe(409);
    });

    it('liaison bisa menarik kebutuhan Assisted yang ia catat', async () => {
      const need = await createNeed(liaison);
      const res = await api().post(`/api/needs/${need.id}/withdraw`).set(liaison.auth).send({});
      expect(res.status).toBe(200);
    });
  });

  describe('POST /projects/:id/cancel (talenta mundur)', () => {
    it.each(['AGREEMENT', 'IN_PROGRESS', 'REVISION'])('dari %s → CANCELLED, kebutuhan OPEN, lamaran ditolak, pemilik diberi tahu', async (status) => {
      const need = await createNeed(owner);
      const project = await createProject({ need, owner, talent, status });
      const res = await api().post(`/api/projects/${project.id}/cancel`).set(talent.auth).send({ reason: 'Ada tugas kuliah mendadak' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('OPEN');
      expect((await one(`SELECT status FROM applications WHERE id = ?`, [project.applicationId])).status).toBe('DITOLAK');
      const notif = await one(`SELECT title, body FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [owner.id]);
      expect(notif.title).toBe('Talenta mundur dari proyek');
      expect(notif.body).toMatch(/Ada tugas kuliah mendadak/);
      expect(await one(`SELECT event_type FROM project_events WHERE project_id = ? ORDER BY id DESC LIMIT 1`, [project.id]))
        .toEqual({ event_type: 'CANCELLED' });
    });

    it.each(['AWAITING_VERIFICATION', 'COMPLETED', 'DISPUTED'])('dari %s → 409', async (status) => {
      const need = await createNeed(owner);
      const project = await createProject({ need, owner, talent, status, talentMarkedDone: true });
      const res = await api().post(`/api/projects/${project.id}/cancel`).set(talent.auth).send({ reason: 'Mau mundur saja' });
      expect(res.status).toBe(409);
    });

    it('alasan wajib (minimal 5 karakter); talenta lain → 404; requester → 403', async () => {
      const need = await createNeed(owner);
      const project = await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
      expect((await api().post(`/api/projects/${project.id}/cancel`).set(talent.auth).send({})).status).toBe(400);
      expect((await api().post(`/api/projects/${project.id}/cancel`).set(talent2.auth).send({ reason: 'Bukan proyek saya' })).status).toBe(404);
      expect((await api().post(`/api/projects/${project.id}/cancel`).set(owner.auth).send({ reason: 'Pemilik tidak bisa' })).status).toBe(403);
    });

    it('setelah talenta mundur, kebutuhan kembali di katalog dan boleh punya proyek baru', async () => {
      const need = await createNeed(owner);
      const first = await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
      await api().post(`/api/projects/${first.id}/cancel`).set(talent.auth).send({ reason: 'Tidak sanggup lagi' });

      const catalog = await api().get('/api/needs/catalog?limit=50').set(talent2.auth);
      expect(catalog.body.data.items.map((n) => n.id)).toContain(need.id);

      const applied = await api().post(`/api/applications/needs/${need.id}`).set(talent2.auth).send({ message: 'Saya siap' });
      expect(applied.status).toBe(201);
      const decided = await api().patch(`/api/applications/${applied.body.data.id}/decide`).set(owner.auth)
        .send({ decision: 'DITERIMA', ...AGREEMENT });
      expect(decided.status).toBe(200);

      const projects = await all(`SELECT status, talent_id FROM projects WHERE need_id = ? ORDER BY id`, [need.id]);
      expect(projects).toEqual([
        { status: 'CANCELLED', talent_id: talent.id },
        { status: 'AGREEMENT', talent_id: talent2.id },
      ]);
    });

    it('unique key tetap mencegah dua proyek aktif untuk kebutuhan yang sama', async () => {
      const need = await createNeed(owner);
      await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
      await expect(createProject({ need, owner, talent: talent2, status: 'AGREEMENT' }))
        .rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    });
  });
});
