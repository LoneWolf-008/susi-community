import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, createUser } from './helpers.js';

describe('POST /api/admin/liaisons (T2.1)', () => {
  let admin;
  let requester;

  beforeAll(async () => {
    await resetData();
    admin = await createUser('admin');
    requester = await createUser('requester');
  });

  it('admin membuat akun liaison + liaison_profiles, lalu liaison bisa login', async () => {
    const res = await api().post('/api/admin/liaisons').set(admin.auth).send({
      name: 'Liaison Baru', email: 'Liaison.Baru@uji.test', password: 'password-liaison', target_visits_month: 12,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'liaison.baru@uji.test', role: 'liaison', target_visits_month: 12, target_intake_month: 25 });
    expect(res.body.data.password_hash).toBeUndefined();

    expect(await one(`SELECT user_id FROM liaison_profiles WHERE user_id = ?`, [res.body.data.id])).toBeTruthy();
    expect(await one(`SELECT action FROM audit_logs WHERE action = 'CREATE_LIAISON'`)).toBeTruthy();

    const login = await api().post('/api/auth/login').send({ email: 'liaison.baru@uji.test', password: 'password-liaison' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('liaison');
  });

  it('non-admin ditolak 403', async () => {
    const res = await api().post('/api/admin/liaisons').set(requester.auth).send({
      name: 'X', email: 'x@uji.test', password: 'password-liaison',
    });
    expect(res.status).toBe(403);
  });

  it('email duplikat → 409, password pendek → 400', async () => {
    const dup = await api().post('/api/admin/liaisons').set(admin.auth).send({
      name: 'Dobel', email: 'liaison.baru@uji.test', password: 'password-liaison',
    });
    expect(dup.status).toBe(409);

    const short = await api().post('/api/admin/liaisons').set(admin.auth).send({
      name: 'Pendek', email: 'pendek@uji.test', password: 'abc',
    });
    expect(short.status).toBe(400);
  });
});
