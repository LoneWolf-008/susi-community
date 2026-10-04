import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '../config/db.js';
import {
  api, resetData, all, createUser, createCommunity, createNeed, createApplication, createProject,
} from './helpers.js';

describe('Keahlian & rekam jejak (T3.3)', () => {
  let requester;
  let talent;
  let skills;

  beforeAll(async () => {
    await resetData();
    requester = await createUser('requester');
    talent = await createUser('talent');
    for (const name of ['React', 'Google Sheets', 'Canva']) {
      await pool.query(`INSERT INTO skills (name) VALUES (?)`, [name]);
    }
    skills = Object.fromEntries((await all(`SELECT id, name FROM skills`)).map((s) => [s.name, s.id]));
  });

  it('GET /api/skills mengembalikan daftar terurut nama (butuh login)', async () => {
    expect((await api().get('/api/skills')).status).toBe(401);
    const res = await api().get('/api/skills').set(requester.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.name)).toEqual(['Canva', 'Google Sheets', 'React']);
  });

  it('createNeed menyimpan skill_ids; id tak dikenal → 400', async () => {
    const community = await createCommunity(requester);
    const res = await api().post('/api/needs').set(requester.auth).send({
      title: 'Butuh rekap iuran', description: 'Iuran dicatat manual', community_id: community.id,
      skill_ids: [skills['Google Sheets'], skills.Canva],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.skills.map((s) => s.name)).toEqual(['Canva', 'Google Sheets']);

    const bad = await api().post('/api/needs').set(requester.auth).send({
      title: 'Butuh web', description: 'Belum punya web', skill_ids: [999999],
    });
    expect(bad.status).toBe(400);
  });

  it('updateNeed mengganti skill_ids (saat masih PENDING)', async () => {
    const created = await api().post('/api/needs').set(requester.auth).send({
      title: 'Butuh katalog', description: 'Katalog produk', skill_ids: [skills.Canva],
    });
    const res = await api().patch(`/api/needs/${created.body.data.id}`).set(requester.auth).send({ skill_ids: [skills.React] });
    expect(res.status).toBe(200);
    expect(res.body.data.skills.map((s) => s.name)).toEqual(['React']);
  });

  it('katalog bisa difilter skill (id atau nama) dan menampilkan skills', async () => {
    const need = await createNeed(requester, { title: 'Kebutuhan Sheets' });
    await pool.query(`INSERT INTO need_skills (need_id, skill_id) VALUES (?, ?)`, [need.id, skills['Google Sheets']]);
    const other = await createNeed(requester, { title: 'Kebutuhan React' });
    await pool.query(`INSERT INTO need_skills (need_id, skill_id) VALUES (?, ?)`, [other.id, skills.React]);

    const byId = await api().get(`/api/needs/catalog?skill=${skills['Google Sheets']}`).set(talent.auth);
    expect(byId.body.data.items.map((n) => n.title)).toEqual(['Kebutuhan Sheets']);
    expect(byId.body.data.items[0].skills).toEqual([{ id: skills['Google Sheets'], name: 'Google Sheets' }]);

    const byName = await api().get('/api/needs/catalog?skill=React').set(talent.auth);
    expect(byName.body.data.items.map((n) => n.title)).toEqual(['Kebutuhan React']);
  });

  it('profil talenta: skill_ids + nama baru; hasilnya dikembalikan', async () => {
    const res = await api().patch('/api/talent/profile').set(talent.auth)
      .send({ skill_ids: [skills.React], skills: ['Figma'] });
    expect(res.status).toBe(200);
    expect(res.body.data.skills.map((s) => s.name)).toEqual(['Figma', 'React']);
    expect((await api().patch('/api/talent/profile').set(talent.auth).send({ skill_ids: [424242] })).status).toBe(400);
  });

  it('daftar pelamar memuat proyek selesai, skills, dan maksimal 3 testimoni publik terbaru', async () => {
    // Riwayat: 4 proyek selesai dengan testimoni, satu di antaranya disembunyikan (is_public 0).
    for (let i = 1; i <= 4; i += 1) {
      const past = await createNeed(requester, { title: `Riwayat ${i}` });
      const project = await createProject({ need: past, owner: requester, talent, status: 'COMPLETED' });
      await pool.query(
        `INSERT INTO testimonials (project_id, from_user_id, to_user_id, text, is_public, moderation_status, created_at)
         VALUES (?, ?, ?, ?, ?, 'APPROVED', DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [project.id, requester.id, talent.id, `Testimoni ${i}`, i === 4 ? 0 : 1, 10 - i],
      );
    }
    const need = await createNeed(requester, { title: 'Kebutuhan baru' });
    await createApplication(need, talent);

    const res = await api().get(`/api/applications/for-need/${need.id}`).set(requester.auth);
    expect(res.status).toBe(200);
    const applicant = res.body.data.items[0];
    expect(applicant.projects_completed).toBe(4);
    expect(applicant.skills.map((s) => s.name)).toEqual(['Figma', 'React']);
    expect(applicant.recent_testimonials.map((t) => t.text)).toEqual(['Testimoni 3', 'Testimoni 2', 'Testimoni 1']);
    expect(applicant).not.toHaveProperty('email');
  });
});
