import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, all, createUser, createNeed, createProject } from './helpers.js';

describe('Verifikasi proyek (T2.2 — celah reputasi)', () => {
  let requesterA;
  let requesterB;
  let talent;
  let admin;
  let need;
  let project;

  beforeAll(async () => {
    await resetData();
    requesterA = await createUser('requester');
    requesterB = await createUser('requester');
    talent = await createUser('talent');
    admin = await createUser('admin');
    need = await createNeed(requesterA);
    project = await createProject({ need, owner: requesterA, talent, status: 'AWAITING_VERIFICATION' });
  });

  const points = async () => (await one(`SELECT reputation_points AS p FROM talent_profiles WHERE user_id = ?`, [talent.id])).p;

  it('stored procedure sp_verify_project sudah dihapus lewat migrasi', async () => {
    const routines = await all(`SELECT routine_name FROM information_schema.routines WHERE routine_schema = DATABASE()`);
    expect(routines).toHaveLength(0);
  });

  it('requester lain (bukan pemilik) → 403, status tidak berubah', async () => {
    const res = await api().post(`/api/projects/${project.id}/verify`).set(requesterB.auth).send({});
    expect(res.status).toBe(403);
    expect((await one(`SELECT status FROM projects WHERE id = ?`, [project.id])).status).toBe('AWAITING_VERIFICATION');
    expect(await points()).toBe(0);
  });

  it('talenta mencoba verifikasi proyeknya sendiri → 403', async () => {
    const res = await api().post(`/api/projects/${project.id}/verify`).set(talent.auth).send({});
    expect(res.status).toBe(403);
    expect(await points()).toBe(0);
  });

  it('pemilik memverifikasi: COMPLETED, reputasi +1, testimoni tayang, talenta diberi tahu', async () => {
    const res = await api().post(`/api/projects/${project.id}/verify`).set(requesterA.auth)
      .send({ testimonial: '  Kerja rapi dan komunikatif.  ' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');

    expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('COMPLETED');
    expect(await points()).toBe(1);
    expect(await all(`SELECT id FROM reputation_events WHERE project_id = ?`, [project.id])).toHaveLength(1);

    const testi = await one(`SELECT * FROM testimonials WHERE project_id = ?`, [project.id]);
    expect(testi).toMatchObject({ text: 'Kerja rapi dan komunikatif.', moderation_status: 'APPROVED', is_public: 1, to_user_id: talent.id });

    const notif = await one(`SELECT * FROM notifications WHERE user_id = ? AND type = 'verifikasi'`, [talent.id]);
    expect(notif.title).toMatch(/reputasi \+1/);

    const pub = await api().get(`/api/talent/${talent.id}/testimonials`).set(requesterB.auth);
    expect(pub.body.data.items.map((t) => t.text)).toContain('Kerja rapi dan komunikatif.');
  });

  it('detail proyek memuat testimoni untuk kedua pihak; yang diturunkan admin hilang (T6)', async () => {
    for (const viewer of [requesterA, talent]) {
      const res = await api().get(`/api/projects/${project.id}`).set(viewer.auth);
      expect(res.body.data.testimonials).toEqual([
        expect.objectContaining({ text: 'Kerja rapi dan komunikatif.', from_user_id: requesterA.id, to_user_id: talent.id, from_name: expect.any(String) }),
      ]);
    }

    const testi = await one(`SELECT id FROM testimonials WHERE project_id = ?`, [project.id]);
    const down = await api().patch(`/api/admin/testimonials/${testi.id}/takedown`).set(admin.auth).send({ reason: 'Uji' });
    expect(down.status).toBe(200);
    const after = await api().get(`/api/projects/${project.id}`).set(requesterA.auth);
    expect(after.body.data.testimonials).toEqual([]);
  });

  it('verifikasi dua kali → 409 dan poin tidak dobel', async () => {
    const res = await api().post(`/api/projects/${project.id}/verify`).set(requesterA.auth).send({});
    expect(res.status).toBe(409);
    expect(await points()).toBe(1);
  });

  it('belum ditandai selesai oleh talenta → 409 (sign-off dua arah)', async () => {
    const need2 = await createNeed(requesterA);
    const running = await createProject({ need: need2, owner: requesterA, talent, status: 'IN_PROGRESS' });
    const res = await api().post(`/api/projects/${running.id}/verify`).set(requesterA.auth).send({});
    expect(res.status).toBe(409);

    // Status AWAITING tapi talent_marked_done_at kosong (data tidak konsisten) juga ditolak.
    const need3 = await createNeed(requesterA);
    const odd = await createProject({ need: need3, owner: requesterA, talent, status: 'AWAITING_VERIFICATION', talentMarkedDone: false });
    const res2 = await api().post(`/api/projects/${odd.id}/verify`).set(requesterA.auth).send({});
    expect(res2.status).toBe(409);
    expect(res2.body.error.message).toMatch(/Talenta belum menandai/);
    expect(await points()).toBe(1);
  });

  it('admin boleh memverifikasi; level dihitung dari ambang yang sama', async () => {
    const need4 = await createNeed(requesterA);
    const p4 = await createProject({ need: need4, owner: requesterA, talent, status: 'AWAITING_VERIFICATION' });
    const res = await api().post(`/api/projects/${p4.id}/verify`).set(admin.auth).send({});
    expect(res.status).toBe(200);
    const profile = await one(`SELECT reputation_points, level, next_level_target FROM talent_profiles WHERE user_id = ?`, [talent.id]);
    expect(profile).toEqual({ reputation_points: 2, level: 'TALENTA_MUDA', next_level_target: 20 });
  });

  it('testimoni terlalu panjang → 400 dan transaksi dibatalkan', async () => {
    const need5 = await createNeed(requesterA);
    const p5 = await createProject({ need: need5, owner: requesterA, talent, status: 'AWAITING_VERIFICATION' });
    const res = await api().post(`/api/projects/${p5.id}/verify`).set(requesterA.auth).send({ testimonial: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
    expect((await one(`SELECT status FROM projects WHERE id = ?`, [p5.id])).status).toBe('AWAITING_VERIFICATION');
  });
});
