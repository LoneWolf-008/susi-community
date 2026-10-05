// Berkas terpisah karena batas rate limit dibaca saat modul dimuat: app dimuat ulang per konfigurasi.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { TEST_ENV } from './testEnv.js';

const pools = [];
async function loadApp(overrides) {
  vi.resetModules();
  Object.assign(process.env, TEST_ENV, overrides);
  const { app } = await import('../app.js');
  const { pool } = await import('../config/db.js');
  const helpers = await import('./helpers.js');
  pools.push(pool);
  return { app, helpers };
}

afterAll(async () => {
  Object.assign(process.env, TEST_ENV);
  for (const pool of pools) await pool.end();
});

const post = (app, path, body, auth) => {
  const req = request(app).post(`/api/chatbot/${path}`);
  return (auth ? req.set(auth) : req).send(body);
};
const ask = (app, body, auth) => post(app, 'message', body, auth);
const tooMany = (res, pattern) => {
  expect(res.status).toBe(429);
  expect(res.body).toEqual({ error: { message: expect.stringMatching(pattern) } });
};

describe('Rate limit chatbot per menit (T12.5)', () => {
  let app;
  let helpers;

  beforeAll(async () => {
    ({ app, helpers } = await loadApp({
      CHATBOT_RATE_LIMIT_PER_MIN: '2',
      CHATBOT_ANON_RATE_LIMIT_PER_MIN: '2',
      CHATBOT_ANON_IP_RATE_LIMIT_PER_MIN: '4',
    }));
    await helpers.resetData();
  });

  it('pengguna terdaftar: dihitung per akun, dipakai bersama /message dan /stream', async () => {
    const a = await helpers.createUser('requester');
    const b = await helpers.createUser('talent');
    expect((await ask(app, { message: 'halo' }, a.auth)).status).toBe(200);
    expect((await ask(app, { message: 'halo' }, a.auth)).status).toBe(200);
    tooMany(await ask(app, { message: 'halo' }, a.auth), /terlalu cepat/);
    tooMany(await post(app, 'stream', { message: 'halo' }, a.auth), /terlalu cepat/);
    // Akun lain dari IP yang sama tidak ikut terblokir.
    expect((await ask(app, { message: 'halo' }, b.auth)).status).toBe(200);
  });

  it('anonim: lebih ketat per IP + sesi, dengan plafon per IP saat berganti-ganti sesi', async () => {
    const first = await ask(app, { message: 'halo' });
    expect(first.status).toBe(200);
    const sessionId = first.body.data.session_id;
    expect((await ask(app, { message: 'halo lagi', session_id: sessionId })).status).toBe(200);
    expect((await ask(app, { message: 'dan lagi', session_id: sessionId })).status).toBe(200);
    tooMany(await ask(app, { message: 'lagi', session_id: sessionId }), /terlalu cepat/);
    // Sesi lain masih punya kuota sendiri, tetapi plafon per IP (4/menit) tetap berlaku.
    expect((await ask(app, { message: 'halo', session_id: crypto.randomUUID() })).status).toBe(404);
    tooMany(await ask(app, { message: 'halo', session_id: crypto.randomUUID() }), /jaringan ini/);
  });
});

describe('Rate limit chatbot per hari (T12.5)', () => {
  let app;
  let helpers;

  beforeAll(async () => {
    ({ app, helpers } = await loadApp({
      CHATBOT_DAILY_LIMIT_USER: '2',
      CHATBOT_DAILY_LIMIT_ANON: '1',
      CHATBOT_DAILY_LIMIT_ANON_IP: '3',
    }));
  });

  it('pengguna terdaftar: batas harian per akun', async () => {
    const user = await helpers.createUser('requester');
    expect((await ask(app, { message: 'halo' }, user.auth)).status).toBe(200);
    expect((await ask(app, { message: 'halo' }, user.auth)).status).toBe(200);
    tooMany(await ask(app, { message: 'halo' }, user.auth), /harian Tanya SUSI/);
  });

  it('anonim: batas harian per sesi lalu plafon harian per IP, dengan ajakan masuk', async () => {
    const first = await ask(app, { message: 'halo' });
    const sessionId = first.body.data.session_id;
    expect((await ask(app, { message: 'halo lagi', session_id: sessionId })).status).toBe(200);
    tooMany(await ask(app, { message: 'lagi', session_id: sessionId }), /pengunjung.*Masuk ke akun/);
    expect((await ask(app, { message: 'percakapan baru' })).status).toBe(200);
    tooMany(await ask(app, { message: 'percakapan baru lagi' }), /harian dari jaringan ini/);
  });
});
