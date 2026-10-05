import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import { api, resetData, createUser, createNeed } from './helpers.js';

const addVisit = (liaison, { status = 'TERDATA', finishedDaysAgo = 0 } = {}) => pool.query(
  `INSERT INTO liaison_visits (liaison_id, community_name, scheduled_date, status, finished_at)
   VALUES (?, 'Komunitas Uji', CURDATE(), ?, IF(? = 'TERDATA', NOW() - INTERVAL ? DAY, NULL))`,
  [liaison.id, status, status, finishedDaysAgo],
);

describe('Ringkasan liaison GET /liaison/summary (T8)', () => {
  let liaison;

  beforeAll(async () => {
    await resetData();
    liaison = await createUser('liaison');
    await addVisit(liaison);
    await addVisit(liaison);
    await addVisit(liaison, { finishedDaysAgo: 40 }); // bulan lalu & di luar 4 minggu
    await addVisit(liaison, { status: 'DIRENCANAKAN' });
    await createNeed(liaison, { moderation: 'PENDING' });
    await createNeed(liaison, { status: 'IN_PROGRESS' });
    // Data liaison lain tidak ikut terhitung.
    const other = await createUser('liaison');
    await addVisit(other);
    await createNeed(other);
  });

  it('target default, capaian bulan ini, status kebutuhan, kunjungan per minggu', async () => {
    const res = await api().get('/api/liaison/summary').set(liaison.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      targets: { visits_month: 30, intake_month: 25 },
      month: { visits: 2, intake: 2 },
      needs: { total: 2, pending: 1, open: 0, in_progress: 1, completed: 0 },
      weekly_visits: [0, 0, 0, 2],
      escalations: { pending: 0, mine: 0, stale: 0 },
    });
  });

  it('GET /liaison/visits?date= menyaring agenda satu hari; format salah → 400', async () => {
    await pool.query(
      `INSERT INTO liaison_visits (liaison_id, community_name, scheduled_date) VALUES (?, 'Besok', CURDATE() + INTERVAL 1 DAY)`,
      [liaison.id],
    );
    const [[{ today }]] = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`);
    const res = await api().get(`/api/liaison/visits?date=${today}`).set(liaison.auth);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.items.every((v) => v.community_name !== 'Besok')).toBe(true);
    expect((await api().get('/api/liaison/visits?date=04-10-2026').set(liaison.auth)).status).toBe(400);
  });

  it('hanya untuk liaison', async () => {
    const requester = await createUser('requester');
    expect((await api().get('/api/liaison/summary').set(requester.auth)).status).toBe(403);
  });
});
