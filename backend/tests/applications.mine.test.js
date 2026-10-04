import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, createUser, createNeed, createApplication, createProject } from './helpers.js';

describe('Lamaran saya: filter status & tautan proyek (T7)', () => {
  let talent;
  let project;

  beforeAll(async () => {
    await resetData();
    const owner = await createUser('requester');
    talent = await createUser('talent');
    await createApplication(await createNeed(owner), talent, 'MENUNGGU');
    await createApplication(await createNeed(owner), talent, 'DITOLAK');
    project = await createProject({ need: await createNeed(owner), owner, talent });
    // Lamaran talenta lain tidak boleh ikut terhitung.
    await createApplication(await createNeed(owner), await createUser('talent'), 'MENUNGGU');
  });

  const mine = (query = '') => api().get(`/api/applications/mine${query}`).set(talent.auth);

  it('tanpa filter: semua lamaran sendiri; lamaran diterima membawa project_id', async () => {
    const res = await mine();
    expect(res.body.data.total).toBe(3);
    const accepted = res.body.data.items.find((a) => a.status === 'DITERIMA');
    expect(accepted.project_id).toBe(project.id);
    expect(res.body.data.items.filter((a) => a.status !== 'DITERIMA').every((a) => a.project_id === null)).toBe(true);
  });

  it('?status= menyaring daftar dan total', async () => {
    const res = await mine('?status=MENUNGGU');
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items.map((a) => a.status)).toEqual(['MENUNGGU']);
  });

  it('status tidak dikenal → 400', async () => {
    const res = await mine('?status=SEMUA');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/status harus salah satu/);
  });
});
