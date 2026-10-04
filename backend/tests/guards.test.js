import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, all, createUser, createNeed, createApplication, createProject } from './helpers.js';

// Kesepakatan wajib saat menerima (PRD P0-4, T3.6).
const AGREEMENT = { scope: 'Lingkup kerja uji', done_definition: 'Selesai bila uji lulus' };

describe('Guard status & race condition (T2.7)', () => {
  let admin;
  let owner;
  let talentA;
  let talentB;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    owner = await createUser('requester');
    talentA = await createUser('talent');
    talentB = await createUser('talent');
  });

  describe('moderasi', () => {
    it('item yang sudah diputus tidak bisa diputus ulang → 409', async () => {
      const need = await createNeed(owner, { moderation: 'PENDING', moderationItem: true });
      const item = await one(`SELECT id FROM moderation_items WHERE ref_id = ?`, [need.id]);

      const first = await api().patch(`/api/admin/moderation/${item.id}`).set(admin.auth)
        .send({ decision: 'APPROVED', checklist_layak: true, checklist_kategori: true });
      expect(first.status).toBe(200);
      expect((await one(`SELECT moderation_status FROM needs WHERE id = ?`, [need.id])).moderation_status).toBe('APPROVED');

      const second = await api().patch(`/api/admin/moderation/${item.id}`).set(admin.auth)
        .send({ decision: 'REJECTED', reject_reason: 'SPAM' });
      expect(second.status).toBe(409);
      expect((await one(`SELECT moderation_status FROM needs WHERE id = ?`, [need.id])).moderation_status).toBe('APPROVED');
    });

    it('alasan penolakan di luar daftar → 400 (bukan 500)', async () => {
      const need = await createNeed(owner, { moderation: 'PENDING', moderationItem: true });
      const item = await one(`SELECT id FROM moderation_items WHERE ref_id = ?`, [need.id]);
      const res = await api().patch(`/api/admin/moderation/${item.id}`).set(admin.auth)
        .send({ decision: 'REJECTED', reject_reason: 'ALASAN BEBAS' });
      expect(res.status).toBe(400);
    });

    it('dua admin memutus bersamaan: hanya satu yang berhasil', async () => {
      const need = await createNeed(owner, { moderation: 'PENDING', moderationItem: true });
      const item = await one(`SELECT id FROM moderation_items WHERE ref_id = ?`, [need.id]);
      const admin2 = await createUser('admin');
      const results = await Promise.all([
        api().patch(`/api/admin/moderation/${item.id}`).set(admin.auth).send({ decision: 'APPROVED' }),
        api().patch(`/api/admin/moderation/${item.id}`).set(admin2.auth).send({ decision: 'REJECTED', reject_reason: 'SPAM' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });
  });

  describe('memilih talenta', () => {
    it('lamaran yang sudah diputus tidak bisa diputus ulang → 409', async () => {
      const need = await createNeed(owner);
      const app = await createApplication(need, talentA, 'DITOLAK');
      const res = await api().patch(`/api/applications/${app.id}/decide`).set(owner.auth).send({ decision: 'DITERIMA', ...AGREEMENT });
      expect(res.status).toBe(409);
      expect(await all(`SELECT id FROM projects WHERE need_id = ?`, [need.id])).toHaveLength(0);
    });

    it('dua penerimaan serentak untuk kebutuhan yang sama → tepat satu proyek', async () => {
      const need = await createNeed(owner);
      const appA = await createApplication(need, talentA);
      const appB = await createApplication(need, talentB);

      const results = await Promise.all([
        api().patch(`/api/applications/${appA.id}/decide`).set(owner.auth).send({ decision: 'DITERIMA', ...AGREEMENT, scope: 'Lingkup A' }),
        api().patch(`/api/applications/${appB.id}/decide`).set(owner.auth).send({ decision: 'DITERIMA', ...AGREEMENT, scope: 'Lingkup B' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await all(`SELECT id FROM projects WHERE need_id = ?`, [need.id])).toHaveLength(1);

      const statuses = await all(`SELECT status FROM applications WHERE need_id = ? ORDER BY status`, [need.id]);
      expect(statuses.map((s) => s.status)).toEqual(['DITERIMA', 'DITOLAK']);
      expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('IN_PROGRESS');
    });

    it('kebutuhan yang tidak lagi OPEN tidak bisa memilih talenta → 409', async () => {
      const need = await createNeed(owner, { status: 'CLOSED' });
      const app = await createApplication(need, talentA);
      const res = await api().patch(`/api/applications/${app.id}/decide`).set(owner.auth).send({ decision: 'DITERIMA', ...AGREEMENT });
      expect(res.status).toBe(409);
    });

    it('format tenggat salah → 400', async () => {
      const need = await createNeed(owner);
      const app = await createApplication(need, talentA);
      const res = await api().patch(`/api/applications/${app.id}/decide`).set(owner.auth)
        .send({ decision: 'DITERIMA', ...AGREEMENT, deadline: '31/12/2026' });
      expect(res.status).toBe(400);
    });
  });

  describe('melamar', () => {
    it('dua lamaran serentak dari talenta yang sama → tepat satu tersimpan', async () => {
      const need = await createNeed(owner);
      const results = await Promise.all([
        api().post(`/api/applications/needs/${need.id}`).set(talentA.auth).send({ message: 'Lamaran 1' }),
        api().post(`/api/applications/needs/${need.id}`).set(talentA.auth).send({ message: 'Lamaran 2' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await all(`SELECT id FROM applications WHERE need_id = ?`, [need.id])).toHaveLength(1);
    });

    it('kebutuhan yang sudah punya proyek tidak menerima lamaran', async () => {
      const need = await createNeed(owner);
      await createProject({ need, owner, talent: talentA, status: 'IN_PROGRESS' });
      const res = await api().post(`/api/applications/needs/${need.id}`).set(talentB.auth).send({});
      expect(res.status).toBe(404);
    });

    it('melamar kebutuhan jalur Assisted tidak lagi 500: notifikasi ke liaison pemilik', async () => {
      const liaison = await createUser('liaison');
      const need = await createNeed(liaison);
      const res = await api().post(`/api/applications/needs/${need.id}`).set(talentB.auth).send({ message: 'Siap' });
      expect(res.status).toBe(201);
      expect(await one(`SELECT title FROM notifications WHERE user_id = ?`, [liaison.id])).toMatchObject({ title: 'Lamaran baru' });
    });
  });
});
