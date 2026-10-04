import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { api, resetData, one, createUser, createNeed, createProject } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n% berkas uji\n');

const upload = (user, { buffer = PDF, filename = 'hasil.pdf', contentType = 'application/pdf' } = {}) =>
  api().post('/api/upload/delivery').set(user.auth).attach('file', buffer, { filename, contentType });

const fileOnDisk = (filePath) => fs.existsSync(path.join(env.deliveriesDir, path.basename(filePath)));

describe('Unggah & akses berkas hasil kerja (T2.5)', () => {
  let owner;
  let talent;
  let otherTalent;
  let admin;
  let project;

  beforeAll(async () => {
    await resetData();
    owner = await createUser('requester');
    talent = await createUser('talent');
    otherTalent = await createUser('talent');
    admin = await createUser('admin');
    const need = await createNeed(owner);
    project = await createProject({ need, owner, talent, status: 'IN_PROGRESS' });
  });

  it('folder unggahan tidak lagi dilayani statis tanpa login', async () => {
    const res = await api().get('/uploads/deliveries/delivery-1700000000000-1.pdf');
    expect(res.status).toBe(404);
  });

  it('unduh tanpa token → 401', async () => {
    const res = await api().get('/api/upload/delivery/delivery-1700000000000-1.pdf');
    expect(res.status).toBe(401);
  });

  it('hanya talenta yang boleh mengunggah', async () => {
    const res = await upload(owner);
    expect(res.status).toBe(403);
  });

  it('ekstensi atau mimetype tidak cocok → 400', async () => {
    expect((await upload(talent, { filename: 'virus.exe', contentType: 'application/octet-stream' })).status).toBe(400);
    expect((await upload(talent, { filename: 'palsu.pdf', contentType: 'text/html' })).status).toBe(400);
  });

  it('berkas lebih dari 25 MB → 413', async () => {
    const big = Buffer.alloc(25 * 1024 * 1024 + 1, 0x20);
    const res = await upload(talent, { buffer: big, filename: 'besar.zip', contentType: 'application/zip' });
    expect(res.status).toBe(413);
  });

  it('file_path palsu ditolak 400', async () => {
    for (const file_path of ['/etc/passwd', '/uploads/deliveries/../../.env', '/uploads/deliveries/x.pdf', 'C:\\Windows\\win.ini']) {
      const res = await api().post(`/api/projects/${project.id}/deliveries`).set(talent.auth).send({ file_path, file_name: 'x' });
      expect(res.status, file_path).toBe(400);
    }
    // Format sah tetapi berkas tidak ada di server.
    const ghost = await api().post(`/api/projects/${project.id}/deliveries`).set(talent.auth)
      .send({ file_path: '/uploads/deliveries/delivery-1700000000000-123.pdf' });
    expect(ghost.status).toBe(400);
  });

  it('link_url non-http ditolak 400', async () => {
    const res = await api().post(`/api/projects/${project.id}/deliveries`).set(talent.auth).send({ link_url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('berkas yatim dihapus bila pengiriman gagal dicatat', async () => {
    const up = await upload(talent);
    expect(up.status).toBe(200);
    const { file_path } = up.body.data;
    expect(fileOnDisk(file_path)).toBe(true);

    // Talenta lain mencoba mengirim ke proyek yang bukan miliknya → 404, berkas dibersihkan.
    const res = await api().post(`/api/projects/${project.id}/deliveries`).set(otherTalent.auth).send({ file_path });
    expect(res.status).toBe(404);
    expect(fileOnDisk(file_path)).toBe(false);
  });

  describe('setelah pengiriman tercatat', () => {
    let filePath;

    beforeAll(async () => {
      const up = await upload(talent, { filename: 'Laporan Akhir.pdf' });
      filePath = up.body.data.file_path;
      const res = await api().post(`/api/projects/${project.id}/deliveries`).set(talent.auth)
        .send({ file_path: filePath, file_name: 'Laporan Akhir.pdf', file_size: 999999999 });
      expect(res.status).toBe(200);
    });

    it('ukuran berkas diambil dari disk, bukan dari klien', async () => {
      const row = await one(`SELECT file_size FROM project_deliveries WHERE file_path = ?`, [filePath]);
      expect(row.file_size).toBe(PDF.length);
    });

    it('talenta, pemilik, dan admin bisa mengunduh; talenta lain 403', async () => {
      const url = `/api/upload/delivery/${path.basename(filePath)}`;
      for (const user of [talent, owner, admin]) {
        const res = await api().get(url).set(user.auth);
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toMatch(/Laporan Akhir\.pdf/);
      }
      expect((await api().get(url).set(otherTalent.auth)).status).toBe(403);
    });

    it('berkas yang sudah dipakai tidak bisa dipakai pengiriman lain dan tidak ikut terhapus', async () => {
      const need2 = await createNeed(owner);
      const project2 = await createProject({ need: need2, owner, talent, status: 'IN_PROGRESS' });
      const res = await api().post(`/api/projects/${project2.id}/deliveries`).set(talent.auth).send({ file_path: filePath });
      expect(res.status).toBe(409);
      expect(fileOnDisk(filePath)).toBe(true);
    });
  });
});
