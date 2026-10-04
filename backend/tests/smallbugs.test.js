import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import {
  api, resetData, one, all, createUser, createCommunity, createNeed, createProject, createDispute,
} from './helpers.js';

describe('Bug kecil (T2.8)', () => {
  let admin;
  let owner;
  let talent;
  let stranger;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    owner = await createUser('requester');
    talent = await createUser('talent');
    stranger = await createUser('requester');
  });

  describe('pesan admin ke sengketa', () => {
    it('mengembalikan 201 dengan isi pesan (dulu success(rows) → 500)', async () => {
      const need = await createNeed(owner);
      const project = await createProject({ need, owner, talent, status: 'DISPUTED', talentMarkedDone: true });
      const dispute = await createDispute(project);
      const res = await api().post(`/api/admin/disputes/${dispute.id}/messages`).set(admin.auth)
        .send({ body: 'Mohon kirim bukti', target_type: 'USER', target_id: 999 });
      expect(res.status).toBe(201);
      // Target selalu sengketa pada URL; target dari body diabaikan.
      expect(res.body.data).toMatchObject({ body: 'Mohon kirim bukti', target_type: 'DISPUTE', target_id: dispute.id });
    });

    it('sengketa tidak ada → 404', async () => {
      const res = await api().post('/api/admin/disputes/999999/messages').set(admin.auth).send({ body: 'Halo' });
      expect(res.status).toBe(404);
    });
  });

  describe('testimoni manual', () => {
    let project;

    beforeAll(async () => {
      const need = await createNeed(owner);
      project = await createProject({ need, owner, talent, status: 'COMPLETED' });
    });

    it('to_user_id harus pihak lawan di proyek → selain itu 400', async () => {
      const res = await api().post('/api/testimonials').set(talent.auth)
        .send({ project_id: project.id, to_user_id: stranger.id, text: 'Komunitasnya ramah' });
      expect(res.status).toBe(400);
    });

    it('orang luar proyek → 403', async () => {
      const res = await api().post('/api/testimonials').set(stranger.auth)
        .send({ project_id: project.id, to_user_id: talent.id, text: 'Bagus' });
      expect(res.status).toBe(403);
    });

    it('is_public=false tersimpan 0 dan testimoni masuk antrean moderasi (PENDING)', async () => {
      const res = await api().post('/api/testimonials').set(talent.auth)
        .send({ project_id: project.id, to_user_id: owner.id, text: 'Komunitas kooperatif', is_public: false });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ is_public: 0, moderation_status: 'PENDING', to_user_id: owner.id });
      const item = await one(`SELECT decision FROM moderation_items WHERE item_type = 'TESTIMONI' AND ref_id = ?`, [res.body.data.id]);
      expect(item.decision).toBe('PENDING');
    });

    it('testimoni PENDING belum tampil publik; setelah disetujui admin baru tampil', async () => {
      const res = await api().post('/api/testimonials').set(owner.auth)
        .send({ project_id: project.id, to_user_id: talent.id, text: 'Talenta disiplin' });
      expect(res.status).toBe(201);

      const before = await api().get(`/api/talent/${talent.id}/testimonials`).set(stranger.auth);
      expect(before.body.data.items.map((t) => t.text)).not.toContain('Talenta disiplin');

      const item = await one(`SELECT id FROM moderation_items WHERE item_type = 'TESTIMONI' AND ref_id = ?`, [res.body.data.id]);
      await api().patch(`/api/admin/moderation/${item.id}`).set(admin.auth).send({ decision: 'APPROVED' });

      const after = await api().get(`/api/talent/${talent.id}/testimonials`).set(stranger.auth);
      expect(after.body.data.items.map((t) => t.text)).toContain('Talenta disiplin');
    });

    it('admin dapat menurunkan testimoni (termasuk dari alur verifikasi)', async () => {
      const [res] = await pool.query(
        `INSERT INTO testimonials (project_id, from_user_id, to_user_id, text, moderation_status)
         VALUES (?, ?, ?, 'Testimoni auto-approve', 'APPROVED')`,
        [project.id, admin.id, talent.id],
      );
      const down = await api().patch(`/api/admin/testimonials/${res.insertId}/takedown`).set(admin.auth).send({ reason: 'Tidak pantas' });
      expect(down.status).toBe(200);
      const list = await api().get(`/api/talent/${talent.id}/testimonials`).set(stranger.auth);
      expect(list.body.data.items.map((t) => t.text)).not.toContain('Testimoni auto-approve');
      expect((await api().patch(`/api/admin/testimonials/${res.insertId}/takedown`).set(admin.auth)).status).toBe(409);
    });
  });

  describe('kunjungan liaison', () => {
    let liaison;
    let otherLiaison;

    beforeAll(async () => {
      liaison = await createUser('liaison');
      otherLiaison = await createUser('liaison');
    });

    const newVisit = async (who) => {
      const res = await api().post('/api/liaison/visits').set(who.auth)
        .send({ community_name: 'RW 01', scheduled_date: '2026-10-10' });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    it('menautkan kebutuhan milik liaison lain → 400', async () => {
      const visit = await newVisit(liaison);
      const foreignNeed = await createNeed(otherLiaison);
      const res = await api().post(`/api/liaison/visits/${visit.id}/finish`).set(liaison.auth).send({ need_id: foreignNeed.id });
      expect(res.status).toBe(400);
      expect((await one(`SELECT status FROM liaison_visits WHERE id = ?`, [visit.id])).status).toBe('DIRENCANAKAN');
    });

    it('selesai dengan kebutuhan sendiri: TERDATA, status kebutuhan tidak dipaksa OPEN, tidak bisa selesai dua kali', async () => {
      const visit = await newVisit(liaison);
      const need = await createNeed(liaison, { moderation: 'APPROVED', status: 'IN_PROGRESS' });
      const res = await api().post(`/api/liaison/visits/${visit.id}/finish`).set(liaison.auth).send({ need_id: need.id, note: 'Data lengkap' });
      expect(res.status).toBe(200);
      expect(await one(`SELECT status, need_id FROM liaison_visits WHERE id = ?`, [visit.id])).toEqual({ status: 'TERDATA', need_id: need.id });
      expect((await one(`SELECT status FROM needs WHERE id = ?`, [need.id])).status).toBe('IN_PROGRESS');

      const again = await api().post(`/api/liaison/visits/${visit.id}/finish`).set(liaison.auth).send({});
      expect(again.status).toBe(409);
    });

    it('status kunjungan tidak bisa diubah lewat PATCH umum', async () => {
      const visit = await newVisit(liaison);
      const res = await api().patch(`/api/liaison/visits/${visit.id}`).set(liaison.auth).send({ status: 'TERDATA' });
      expect(res.status).toBe(400);
    });
  });

  describe('komunitas & mading: validasi community_id', () => {
    let community;

    beforeAll(async () => {
      community = await createCommunity(owner);
    });

    it('menulis topik atas nama komunitas yang bukan miliknya → 403', async () => {
      const res = await api().post('/api/discussions').set(stranger.auth).send({ text: 'Halo', community_id: community.id });
      expect(res.status).toBe(403);
    });

    it('anggota → 201; liaison boleh atas nama komunitas mana pun', async () => {
      expect((await api().post('/api/discussions').set(owner.auth).send({ text: 'Info kegiatan', community_id: community.id })).status).toBe(201);
      const liaison = await createUser('liaison');
      expect((await api().post('/api/discussions').set(liaison.auth).send({ text: 'Info AgenSUSI', community_id: community.id })).status).toBe(201);
    });

    it('balasan atas nama komunitas lain → 403; tanpa komunitas → 201', async () => {
      const topic = await api().post('/api/discussions').set(owner.auth).send({ text: 'Topik baru' });
      const bad = await api().post(`/api/discussions/${topic.body.data.id}/replies`).set(stranger.auth)
        .send({ text: 'Balas', community_id: community.id });
      expect(bad.status).toBe(403);
      const ok = await api().post(`/api/discussions/${topic.body.data.id}/replies`).set(stranger.auth).send({ text: 'Balas' });
      expect(ok.status).toBe(201);
    });

    it('bergabung ke komunitas yang tidak ada → 404', async () => {
      const res = await api().post('/api/communities/999999/join').set(stranger.auth);
      expect(res.status).toBe(404);
    });

    it('keluar saat members_count 0 tidak memicu error unsigned', async () => {
      const c = await createCommunity(owner);
      await pool.query(`UPDATE communities SET members_count = 0 WHERE id = ?`, [c.id]);
      const res = await api().delete(`/api/communities/${c.id}/leave`).set(owner.auth);
      expect(res.status).toBe(200);
      expect((await one(`SELECT members_count FROM communities WHERE id = ?`, [c.id])).members_count).toBe(0);
    });
  });
});

describe('Paginasi & format error (T2.6)', () => {
  let user;

  beforeAll(async () => {
    user = await createUser('talent');
  });

  it('limit di atas 50 dibatasi menjadi 50', async () => {
    for (const url of ['/api/needs/catalog?limit=500', '/api/notifications?limit=1000', '/api/discussions?limit=999']) {
      const res = await api().get(url).set(user.auth);
      expect(res.status, url).toBe(200);
      expect(res.body.data, url).toMatchObject({ limit: 50, page: 1 });
      expect(Array.isArray(res.body.data.items)).toBe(true);
    }
  });

  it('JSON rusak → 400 berformat { error: { message } }', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Format JSON tidak valid' } });
  });

  it('endpoint tidak dikenal → 404 berformat sama', async () => {
    const res = await api().get('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Endpoint tidak ditemukan' } });
  });

  it('daftar milik sendiri kini berbentuk { items, total, page, limit }', async () => {
    const res = await api().get('/api/applications/mine').set(user.auth);
    expect(res.body.data).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    expect(await all(`SELECT 1`)).toHaveLength(1);
  });
});
