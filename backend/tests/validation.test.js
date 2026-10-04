import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, createUser, createNeed, createApplication } from './helpers.js';

describe('Validasi input zod (T3.6)', () => {
  let requester;
  let talent;

  beforeAll(async () => {
    await resetData();
    requester = await createUser('requester');
    talent = await createUser('talent');
  });

  it('pesan berbahasa Indonesia + details per kolom', async () => {
    const res = await api().post('/api/needs').set(requester.auth).send({ title: '', category: 'GAME', lat: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Judul wajib diisi');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'description', 'category', 'lat']));
    expect(res.body.error.details.find((d) => d.field === 'category').message).toMatch(/Kategori harus salah satu dari/);
  });

  it('register: email tidak valid & password pendek', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'bukan-email', password: 'pendek', role: 'talent', name: 'X' });
    expect(res.status).toBe(400);
    const messages = res.body.error.details.map((d) => d.message);
    expect(messages).toEqual(expect.arrayContaining(['Format email tidak valid', 'Password minimal 10 karakter']));
  });

  it('kolom tak dikenal dibuang: PATCH /auth/me tidak bisa mengubah role/status', async () => {
    const res = await api().patch('/api/auth/me').set(requester.auth).send({ name: 'Nama Baru', role: 'admin', status: 'AKTIF' });
    expect(res.status).toBe(200);
    expect(await one(`SELECT name, role FROM users WHERE id = ?`, [requester.id])).toEqual({ name: 'Nama Baru', role: 'requester' });
  });

  it('PATCH /auth/me tanpa kolom yang dikenal → 400', async () => {
    const res = await api().patch('/api/auth/me').set(requester.auth).send({ role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Tidak ada data yang diubah');
  });

  it('memilih talenta wajib menyertakan lingkup & definisi selesai (PRD P0-4)', async () => {
    const need = await createNeed(requester);
    const app = await createApplication(need, talent);
    const res = await api().patch(`/api/applications/${app.id}/decide`).set(requester.auth).send({ decision: 'DITERIMA' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(['scope', 'done_definition']);

    const past = await api().patch(`/api/applications/${app.id}/decide`).set(requester.auth)
      .send({ decision: 'DITERIMA', scope: 'Lingkup', done_definition: 'Selesai bila', deadline: '2020-01-01' });
    expect(past.status).toBe(400);
    expect(past.body.error.message).toBe('Tenggat tidak boleh di masa lalu');
  });

  it('avatar_url dan link_url harus http(s)', async () => {
    const res = await api().patch('/api/auth/me').set(requester.auth).send({ avatar_url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('URL avatar harus URL http/https');
  });

  it('pengaturan menerima true/false dan 0/1 lalu tersimpan', async () => {
    const res = await api().patch('/api/settings').set(requester.auth).send({ show_location: 0, notif_diskusi: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ show_location: 0, notif_diskusi: 1 });
    expect((await api().patch('/api/settings').set(requester.auth).send({ show_location: 'ya' })).status).toBe(400);
  });
});
