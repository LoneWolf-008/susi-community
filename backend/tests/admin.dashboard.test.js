import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import {
  api, resetData, createUser, createCommunity, createNeed, createProject, createDispute,
} from './helpers.js';

describe('Data dasbor admin (T9)', () => {
  let admin;
  let owner;
  let talent;
  let need;
  let testimonialId;
  let dispute;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    owner = await createUser('requester', { name: 'Ibu Pemilik Uji' });
    talent = await createUser('talent', { name: 'Talenta Uji' });
    await createUser('talent', { status: 'DITANGGUHKAN' });
    const community = await createCommunity(owner, { name: 'PKK Uji Dasbor' });
    need = await createNeed(owner, {
      moderation: 'PENDING', moderationItem: true, communityId: community.id,
      description: 'Iuran warga dicatat di buku tulis',
    });

    // Testimoni talenta → pemilik (PENDING) membuat item moderasi TESTIMONI.
    const doneNeed = await createNeed(owner);
    const done = await createProject({ need: doneNeed, owner, talent, status: 'COMPLETED' });
    const res = await api().post('/api/testimonials').set(talent.auth)
      .send({ project_id: done.id, to_user_id: owner.id, text: 'Pengurusnya sangat responsif' });
    testimonialId = res.body.data.id;

    // Sengketa pada proyek tanpa komunitas: nama pemilik tetap tersedia.
    const disputedNeed = await createNeed(owner);
    const disputed = await createProject({ need: disputedNeed, owner, talent, status: 'DISPUTED' });
    dispute = await createDispute(disputed);

    await pool.query(`INSERT INTO daily_stats (stat_date, visits) VALUES (CURDATE(), 7), (CURDATE() - INTERVAL 10 DAY, 5)`);
  });

  it('GET /admin/stats: angka view + hasil moderasi, pengguna aktif per peran, kunjungan 6 minggu', async () => {
    const res = await api().get('/api/admin/stats').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      moderation_pending: 2,
      disputes_open: 1,
      moderation: { pending: 2, approved: 0, rejected: 0 },
      users_by_role: { requester: 1, talent: 1, liaison: 0, admin: 1 },
      weekly_visits: [0, 0, 0, 0, 5, 7],
    });
  });

  it('GET /admin/moderation: tiap item membawa isi kebutuhan / testimoni', async () => {
    const res = await api().get('/api/admin/moderation?decision=PENDING').set(admin.auth);
    const byType = Object.fromEntries(res.body.data.items.map((i) => [i.item_type, i]));
    expect(byType.KEBUTUHAN.detail).toMatchObject({
      id: need.id, description: 'Iuran warga dicatat di buku tulis', community_name: 'PKK Uji Dasbor', created_by_name: 'Ibu Pemilik Uji',
    });
    expect(byType.TESTIMONI.detail).toMatchObject({
      id: testimonialId, text: 'Pengurusnya sangat responsif', from_name: 'Talenta Uji', to_name: 'Ibu Pemilik Uji',
    });
  });

  it('daftar & detail sengketa membawa nama pemilik dan kesepakatan', async () => {
    const list = await api().get('/api/admin/disputes').set(admin.auth);
    expect(list.body.data.items[0]).toMatchObject({ id: dispute.id, requester_name: 'Ibu Pemilik Uji', talent_name: 'Talenta Uji' });
    const detail = await api().get(`/api/admin/disputes/${dispute.id}`).set(admin.auth);
    expect(detail.body.data).toMatchObject({ requester_name: 'Ibu Pemilik Uji', scope: 'Lingkup uji', done_definition: 'Selesai bila uji lulus' });
  });
});
