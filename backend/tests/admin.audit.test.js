import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, createUser } from './helpers.js';

describe('GET /api/admin/audit-logs (T3.8)', () => {
  let admin;
  let requester;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    requester = await createUser('requester');
    // Menghasilkan beberapa entri audit lewat aksi nyata.
    await api().post('/api/needs').set(requester.auth).send({ title: 'Kebutuhan A', description: 'Deskripsi A' });
    await api().post('/api/needs').set(requester.auth).send({ title: 'Kebutuhan B', description: 'Deskripsi B' });
    await api().patch(`/api/admin/users/${requester.id}/status`).set(admin.auth).send({ status: 'AKTIF' });
  });

  it('terpaginasi, terbaru dulu, dengan nama & peran aktor', async () => {
    const res = await api().get('/api/admin/audit-logs?limit=2').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(res.body.data.items[0]).toMatchObject({ action: 'UPDATE_STATUS', actor_name: expect.any(String), actor_role: 'admin' });
  });

  it('bisa difilter entity/action/actor; meta sudah di-parse', async () => {
    const res = await api().get(`/api/admin/audit-logs?entity=needs&action=CREATE&actor_id=${requester.id}`).set(admin.auth);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items.map((i) => i.title).sort()).toEqual(['Kebutuhan A', 'Kebutuhan B']);
  });

  it('non-admin → 403', async () => {
    expect((await api().get('/api/admin/audit-logs').set(requester.auth)).status).toBe(403);
  });
});
