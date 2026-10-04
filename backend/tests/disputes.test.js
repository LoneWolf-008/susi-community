import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, all, createUser, createNeed, createProject, createDispute } from './helpers.js';

describe('Penyelesaian sengketa (T2.3)', () => {
  let admin;
  let requester;
  let talent;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    requester = await createUser('requester');
    talent = await createUser('talent');
  });

  async function disputedProject({ talentMarkedDone = true } = {}) {
    const need = await createNeed(requester);
    const project = await createProject({ need, owner: requester, talent, status: 'DISPUTED', talentMarkedDone });
    const dispute = await createDispute(project);
    return { need, project, dispute };
  }

  it('MARK_COMPLETE: proyek COMPLETED, reputasi +1, sengketa SELESAI, pernyataan admin bukan testimoni', async () => {
    const { need, project, dispute } = await disputedProject();
    const res = await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth)
      .send({ decision: 'MARK_COMPLETE', statement_admin: 'Hasil sudah sesuai definisi selesai' });
    expect(res.status).toBe(200);

    expect((await one(`SELECT status FROM projects WHERE id = ?`, [project.id])).status).toBe('COMPLETED');
    expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('COMPLETED');
    expect((await one(`SELECT reputation_points AS p FROM talent_profiles WHERE user_id = ?`, [talent.id])).p).toBe(1);
    expect(await one(`SELECT status, decision, decided_by FROM disputes WHERE id = ?`, [dispute.id]))
      .toEqual({ status: 'SELESAI', decision: 'MARK_COMPLETE', decided_by: admin.id });
    expect(await all(`SELECT id FROM testimonials WHERE project_id = ?`, [project.id])).toHaveLength(0);

    const events = await all(`SELECT label FROM dispute_events WHERE dispute_id = ?`, [dispute.id]);
    expect(events.map((e) => e.label).join(' ')).toMatch(/MARK_COMPLETE — Hasil sudah sesuai/);

    const notified = await all(
      `SELECT user_id FROM notifications WHERE type = 'sengketa' AND ref_id = ? ORDER BY user_id`, [dispute.id],
    );
    expect(notified.map((n) => n.user_id).sort()).toEqual([requester.id, talent.id].sort());
  });

  it('sengketa yang sudah SELESAI tidak bisa diputus lagi → 409', async () => {
    const { dispute } = await disputedProject();
    await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth).send({ decision: 'EXTEND_7_DAYS' });
    const again = await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth).send({ decision: 'MARK_COMPLETE' });
    expect(again.status).toBe(409);
  });

  it('EXTEND_7_DAYS: proyek kembali IN_PROGRESS, tenggat ≥ hari ini + 7, talenta perlu tandai selesai lagi', async () => {
    const { project, dispute } = await disputedProject();
    const res = await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth).send({ decision: 'EXTEND_7_DAYS' });
    expect(res.status).toBe(200);

    const row = await one(
      `SELECT status, talent_marked_done_at, DATEDIFF(deadline, CURDATE()) AS days_left FROM projects WHERE id = ?`,
      [project.id],
    );
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.talent_marked_done_at).toBeNull();
    expect(row.days_left).toBeGreaterThanOrEqual(7);
    expect((await one(`SELECT decision FROM disputes WHERE id = ?`, [dispute.id])).decision).toBe('EXTEND_7_DAYS');
  });

  it('MARK_COMPLETE saat talenta belum menyerahkan hasil → 409 dan sengketa tetap MEDIASI (rollback)', async () => {
    const { project, dispute } = await disputedProject({ talentMarkedDone: false });
    const res = await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth).send({ decision: 'MARK_COMPLETE' });
    expect(res.status).toBe(409);
    expect((await one(`SELECT status FROM disputes WHERE id = ?`, [dispute.id])).status).toBe('MEDIASI');
    expect((await one(`SELECT status FROM projects WHERE id = ?`, [project.id])).status).toBe('DISPUTED');
  });

  it('keputusan tidak dikenal → 400', async () => {
    const { dispute } = await disputedProject();
    const res = await api().patch(`/api/admin/disputes/${dispute.id}/resolve`).set(admin.auth).send({ decision: 'HAPUS' });
    expect(res.status).toBe(400);
  });

  it('sengketa tidak bisa dibuka untuk proyek COMPLETED → 409', async () => {
    const need = await createNeed(requester);
    const done = await createProject({ need, owner: requester, talent, status: 'COMPLETED' });
    const res = await api().post(`/api/projects/${done.id}/dispute`).set(requester.auth).send({ summary: 'Coba-coba' });
    expect(res.status).toBe(409);
  });

  it('pihak proyek membuka sengketa: status DISPUTED + dispute_event', async () => {
    const need = await createNeed(requester);
    const running = await createProject({ need, owner: requester, talent, status: 'AWAITING_VERIFICATION' });
    const res = await api().post(`/api/projects/${running.id}/dispute`).set(talent.auth)
      .send({ summary: 'Komunitas tidak merespons', statement: 'Sudah saya kirim dua kali' });
    expect(res.status).toBe(201);
    const dispute = await one(`SELECT * FROM disputes WHERE id = ?`, [res.body.data.id]);
    expect(dispute).toMatchObject({ status: 'MEDIASI', statement_talent: 'Sudah saya kirim dua kali', statement_community: null });
    expect((await one(`SELECT status FROM projects WHERE id = ?`, [running.id])).status).toBe('DISPUTED');
  });
});
