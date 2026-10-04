import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, createUser } from './helpers.js';

const register = (body) => api().post('/api/auth/register').send(body);
const refreshCookie = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('susi_refresh_token='));

describe('Auth (T2.1, T2.6)', () => {
  beforeAll(resetData);

  it('register dengan role liaison ditolak 400 dan tidak membuat akun', async () => {
    const res = await register({ email: 'liaison@uji.test', password: 'password-panjang', role: 'liaison', name: 'Liaison Palsu' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Peran tidak valid/);
    expect(await one(`SELECT id FROM users WHERE email = 'liaison@uji.test'`)).toBeUndefined();
  });

  it('register admin juga ditolak', async () => {
    const res = await register({ email: 'admin@uji.test', password: 'password-panjang', role: 'admin', name: 'Admin Palsu' });
    expect(res.status).toBe(400);
  });

  it('register requester berhasil: token + cookie refresh', async () => {
    const res = await register({ email: 'Komunitas@Uji.test', password: 'password-panjang', role: 'requester', name: 'Komunitas' });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user).toMatchObject({ email: 'komunitas@uji.test', role: 'requester' });
    expect(refreshCookie(res)).toMatch(/HttpOnly/);
  });

  it('register talenta membuat talent_profiles', async () => {
    const res = await register({ email: 'talenta@uji.test', password: 'password-panjang', role: 'talent', name: 'Talenta' });
    expect(res.status).toBe(201);
    expect(await one(`SELECT user_id FROM talent_profiles WHERE user_id = ?`, [res.body.data.user.id])).toBeTruthy();
  });

  it('register email duplikat → 409', async () => {
    const res = await register({ email: 'komunitas@uji.test', password: 'password-panjang', role: 'requester', name: 'Dobel' });
    expect(res.status).toBe(409);
  });

  it('body bukan string ditolak 400 (bukan 500)', async () => {
    const res = await api().post('/api/auth/login').send({ email: 123, password: ['x'] });
    expect(res.status).toBe(400);
  });

  it('login lalu refresh di detik yang sama tidak bentrok (regresi jwtid)', async () => {
    const user = await createUser('talent');
    const login = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
    const cookie = refreshCookie(login);
    const refresh = await api().post('/api/auth/refresh').set('Cookie', cookie.split(';')[0]);
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();
  });

  it('refresh mengembalikan profil lengkap seperti login (regresi T6: bio/telepon hilang setelah reload)', async () => {
    const user = await createUser('requester');
    const profile = { phone: '0812-3456-7890', bio: 'Pengurus PKK RW 05', extra_info: 'PKK RW 05 Sukajadi' };
    const patch = await api().patch('/api/auth/me').set(user.auth).send(profile);
    expect(patch.status).toBe(200);

    const login = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    const refresh = await api().post('/api/auth/refresh').set('Cookie', refreshCookie(login).split(';')[0]);
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.user).toMatchObject({ id: user.id, role: 'requester', ...profile });
    expect(Object.keys(refresh.body.data.user).sort()).toEqual(Object.keys(login.body.data.user).sort());
    expect(refresh.body.data.user).not.toHaveProperty('password_hash');
  });

  it('logout tidak mensyaratkan access token; cookie refresh dicabut (regresi T2.6)', async () => {
    const user = await createUser('requester');
    const login = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    const cookie = refreshCookie(login).split(';')[0];

    // Tanpa header Authorization sama sekali.
    const logout = await api().post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const refresh = await api().post('/api/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });

  it('akun ditangguhkan tidak bisa login', async () => {
    const user = await createUser('requester', { status: 'DITANGGUHKAN' });
    const res = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/ditangguhkan/);
  });
});
