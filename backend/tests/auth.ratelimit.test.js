// Berkas terpisah karena batas rate limit dibaca saat modul dimuat: modul dimuat ulang
// dengan AUTH_RATE_LIMIT_MAX=3.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

let app;
let freshPool;

beforeAll(async () => {
  vi.resetModules();
  process.env.AUTH_RATE_LIMIT_MAX = '3';
  ({ app } = await import('../app.js'));
  ({ pool: freshPool } = await import('../config/db.js'));
  const { resetData, createUser } = await import('./helpers.js');
  await resetData();
  globalThis.__rateLimitUser = await createUser('requester');
});

afterAll(async () => {
  process.env.AUTH_RATE_LIMIT_MAX = '100000';
  await freshPool.end();
});

describe('Rate limit auth (T2.6)', () => {
  it('login: hanya percobaan gagal yang dihitung, yang ke-4 → 429', async () => {
    const user = globalThis.__rateLimitUser;
    const bad = () => request(app).post('/api/auth/login').send({ email: user.email, password: 'salah-password-1' });
    const good = () => request(app).post('/api/auth/login').send({ email: user.email, password: user.password });

    expect((await bad()).status).toBe(401);
    expect((await bad()).status).toBe(401);
    // Login sukses tidak menghabiskan kuota (demo dengan banyak akun dari satu IP).
    for (let i = 0; i < 4; i += 1) expect((await good()).status).toBe(200);
    expect((await bad()).status).toBe(401);

    const blocked = await bad();
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: { message: expect.stringMatching(/Terlalu banyak percobaan/) } });
  });

  it('register: lebih dari 3 per jendela → 429', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await request(app).post('/api/auth/register').send({
        email: `rl-${i}@uji.test`, password: 'password-panjang', role: 'talent', name: `RL ${i}`,
      });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([201, 201, 201, 429]);
  });
});
