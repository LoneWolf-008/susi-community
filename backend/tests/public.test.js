import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData, one, createUser, createCommunity, createNeed, createProject } from './helpers.js';

describe('Endpoint publik tanpa login (T3.4)', () => {
  let requester;
  let hidden;
  let talent;
  let community;
  let hiddenCommunity;

  beforeAll(async () => {
    await resetData();
    requester = await createUser('requester');
    hidden = await createUser('requester');
    talent = await createUser('talent');
    community = await createCommunity(requester, { name: 'Paguyuban Terbuka', lat: -6.947212, lng: 107.594633 });
    await pool.query(
      `UPDATE communities SET address = 'Jl. Rahasia No. 7', whatsapp = '081299999999', leader_name = 'Pak Ketua' WHERE id = ?`,
      [community.id],
    );
    hiddenCommunity = await createCommunity(hidden, { name: 'Komunitas Privat', lat: -6.9, lng: 107.7 });
    await pool.query(`UPDATE user_settings SET show_location = 0 WHERE user_id = ?`, [hidden.id]);

    const open = await createNeed(requester, { title: 'Butuh katalog online', communityId: community.id, description: 'Detail panjang berisi alamat rumah ketua' });
    await pool.query(`UPDATE needs SET summary = 'Katalog produk sepatu', address = 'Jl. Rahasia No. 7', lat = -6.94, lng = 107.59 WHERE id = ?`, [open.id]);
    await createNeed(requester, { title: 'Masih pending', moderation: 'PENDING' });
    const done = await createNeed(requester, { communityId: community.id });
    await createProject({ need: done, owner: requester, talent, status: 'COMPLETED' });
  });

  it('GET /api/public/stats tanpa token → angka agregat', async () => {
    const res = await api().get('/api/public/stats');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/max-age=60/);
    expect(res.body.data).toMatchObject({
      projects_completed: 1, talents_total: 1, communities_total: 2, communities_helped: 1, needs_open: 1,
    });
    expect(res.body.data).not.toHaveProperty('moderation_pending');
    expect(res.body.data).not.toHaveProperty('disputes_open');
  });

  it('GET /api/public/catalog: field terbatas, tanpa deskripsi lengkap/alamat/koordinat/nama komunitas', async () => {
    const res = await api().get('/api/public/catalog');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    const item = res.body.data.items[0];
    expect(item).toMatchObject({ title: 'Butuh katalog online', summary: 'Katalog produk sepatu', community_type: 'UMKM' });
    for (const field of ['description', 'address', 'lat', 'lng', 'community_name', 'requester_id', 'created_by']) {
      expect(item, field).not.toHaveProperty(field);
    }
  });

  it('GET /api/public/communities: koordinat dibulatkan, tanpa kontak, show_location dihormati', async () => {
    const res = await api().get('/api/public/communities');
    expect(res.status).toBe(200);
    const open = res.body.data.items.find((c) => c.id === community.id);
    expect(open).toMatchObject({ name: 'Paguyuban Terbuka', lat: -6.947, lng: 107.595, needs_open: 1, projects_completed: 1 });
    for (const field of ['address', 'whatsapp', 'leader_name', 'created_by']) {
      expect(open, field).not.toHaveProperty(field);
    }
    const priv = res.body.data.items.find((c) => c.id === hiddenCommunity.id);
    expect(priv).toMatchObject({ lat: null, lng: null, sector: null });

    expect(res.body.data.sectors).toHaveLength(4);
    expect(res.body.data.sectors.find((s) => s.sector === 'BARAT–SELATAN')).toEqual({ sector: 'BARAT–SELATAN', communities: 1, needs_open: 1 });
  });

  it('POST /api/public/visit menaikkan daily_stats hari ini', async () => {
    const before = (await one(`SELECT COALESCE(SUM(visits), 0) AS v FROM daily_stats WHERE stat_date = CURDATE()`)).v;
    expect((await api().post('/api/public/visit')).status).toBe(200);
    expect((await api().post('/api/public/visit')).status).toBe(200);
    const after = (await one(`SELECT visits AS v FROM daily_stats WHERE stat_date = CURDATE()`)).v;
    expect(Number(after)).toBe(Number(before) + 2);
  });
});
