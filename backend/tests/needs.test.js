import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import {
  api, resetData, one, all, createUser, createCommunity, createNeed, createApplication, createProject,
} from './helpers.js';

describe('Kebutuhan: hapus & ubah (T2.4)', () => {
  let owner;
  let other;
  let talent;

  beforeAll(async () => {
    await resetData();
    owner = await createUser('requester');
    other = await createUser('requester');
    talent = await createUser('talent');
  });

  it('hapus kebutuhan yang punya proyek → 409; kebutuhan & proyek tetap ada', async () => {
    const need = await createNeed(owner);
    const project = await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
    const res = await api().delete(`/api/needs/${need.id}`).set(owner.auth);
    expect(res.status).toBe(409);
    expect(await one(`SELECT id FROM needs WHERE id = ?`, [need.id])).toBeTruthy();
    expect(await one(`SELECT id FROM projects WHERE id = ?`, [project.id])).toBeTruthy();
  });

  it('hapus kebutuhan yang hanya punya lamaran → CLOSED (lunak), lamaran ditolak, talenta diberi tahu', async () => {
    const need = await createNeed(owner);
    const app = await createApplication(need, talent);
    const res = await api().delete(`/api/needs/${need.id}`).set(owner.auth);
    expect(res.status).toBe(200);
    expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('CLOSED');
    expect((await one(`SELECT status FROM applications WHERE id = ?`, [app.id])).status).toBe('DITOLAK');
    expect(await one(`SELECT id FROM notifications WHERE user_id = ? AND title = 'Kebutuhan ditutup'`, [talent.id])).toBeTruthy();

    const again = await api().delete(`/api/needs/${need.id}`).set(owner.auth);
    expect(again.status).toBe(409);
  });

  it('hapus kebutuhan milik orang lain → 404', async () => {
    const need = await createNeed(owner);
    const res = await api().delete(`/api/needs/${need.id}`).set(other.auth);
    expect(res.status).toBe(404);
    expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('OPEN');
  });

  it('FK fk_proj_need kini RESTRICT: DELETE langsung tidak menghapus proyek berantai', async () => {
    const need = await createNeed(owner);
    await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
    await expect(pool.query(`DELETE FROM needs WHERE id = ?`, [need.id])).rejects.toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2' });
  });

  it('ubah kebutuhan APPROVED → 409', async () => {
    const need = await createNeed(owner, { moderation: 'APPROVED' });
    const res = await api().patch(`/api/needs/${need.id}`).set(owner.auth).send({ title: 'Judul baru' });
    expect(res.status).toBe(409);
  });

  it('ubah kebutuhan REJECTED → kembali PENDING + item moderasi baru', async () => {
    const need = await createNeed(owner, {
      moderation: 'REJECTED', rejectReason: 'SALAH KATEGORI', moderationItem: true,
    });
    const res = await api().patch(`/api/needs/${need.id}`).set(owner.auth)
      .send({ title: 'Judul diperbaiki', category: 'WEBSITE' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ moderation_status: 'PENDING', reject_reason: null, category: 'WEBSITE', title: 'Judul diperbaiki' });

    const items = await all(
      `SELECT decision, title FROM moderation_items WHERE item_type = 'KEBUTUHAN' AND ref_id = ? ORDER BY id`, [need.id],
    );
    expect(items).toEqual([
      { decision: 'REJECTED', title: need.title },
      { decision: 'PENDING', title: 'Judul diperbaiki' },
    ]);
  });

  it('ubah kebutuhan PENDING menyelaraskan judul di antrean moderasi', async () => {
    const need = await createNeed(owner, { moderation: 'PENDING', moderationItem: true });
    const res = await api().patch(`/api/needs/${need.id}`).set(owner.auth).send({ title: 'Judul sinkron' });
    expect(res.status).toBe(200);
    const item = await one(`SELECT title FROM moderation_items WHERE ref_id = ? AND decision = 'PENDING'`, [need.id]);
    expect(item.title).toBe('Judul sinkron');
  });

  it('kategori tidak dikenal → 400 (bukan 500)', async () => {
    const need = await createNeed(owner, { moderation: 'PENDING' });
    const res = await api().patch(`/api/needs/${need.id}`).set(owner.auth).send({ category: 'GAME' });
    expect(res.status).toBe(400);
  });
});

describe('Kebutuhan: validasi komunitas & visibilitas (T2.8)', () => {
  let requester;
  let stranger;
  let liaison;
  let community;

  beforeAll(async () => {
    requester = await createUser('requester');
    stranger = await createUser('requester');
    liaison = await createUser('liaison');
    community = await createCommunity(requester);
  });

  const body = (communityId) => ({ title: 'Butuh pencatatan', description: 'Catatan kas masih manual', community_id: communityId });

  it('requester bukan anggota komunitas → 403', async () => {
    const res = await api().post('/api/needs').set(stranger.auth).send(body(community.id));
    expect(res.status).toBe(403);
  });

  it('komunitas tidak ada → 404', async () => {
    const res = await api().post('/api/needs').set(requester.auth).send(body(999999));
    expect(res.status).toBe(404);
  });

  it('anggota komunitas → 201 sumber MANDIRI; liaison → 201 sumber AGENSUSI tanpa requester_id', async () => {
    const mine = await api().post('/api/needs').set(requester.auth).send(body(community.id));
    expect(mine.status).toBe(201);
    expect(mine.body.data).toMatchObject({ source: 'MANDIRI', requester_id: requester.id, moderation_status: 'PENDING' });

    const assisted = await api().post('/api/needs').set(liaison.auth).send(body(community.id));
    expect(assisted.status).toBe(201);
    expect(assisted.body.data).toMatchObject({ source: 'AGENSUSI', requester_id: null, created_by: liaison.id });
  });

  it('kebutuhan PENDING milik orang lain tidak bisa dibuka lewat GET /needs/:id', async () => {
    const need = await createNeed(requester, { moderation: 'PENDING' });
    expect((await api().get(`/api/needs/${need.id}`).set(stranger.auth)).status).toBe(404);
    expect((await api().get(`/api/needs/${need.id}`).set(requester.auth)).status).toBe(200);
  });
});
