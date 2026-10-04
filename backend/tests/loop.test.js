// Acceptance T3: loop inti G4 dari kebutuhan masuk sampai reputasi terisi, seluruhnya lewat API,
// untuk jalur A (requester mandiri) dan jalur B (Assisted Intake oleh liaison).
import { describe, it, expect, beforeAll } from 'vitest';
import { api, resetData, one, createUser, PASSWORD } from './helpers.js';
import { pool } from '../config/db.js';

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function registerAndLogin({ email, role, name }) {
  const reg = await api().post('/api/auth/register').send({ email, password: PASSWORD, role, name });
  expect(reg.status, `register ${email}`).toBe(201);
  const login = await api().post('/api/auth/login').send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  return { id: login.body.data.user.id, headers: bearer(login.body.data.accessToken) };
}

async function loginExisting(user) {
  const login = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
  expect(login.status).toBe(200);
  return { id: user.id, headers: bearer(login.body.data.accessToken) };
}

async function notificationsOf(headers) {
  const res = await api().get('/api/notifications?limit=50').set(headers);
  expect(res.status).toBe(200);
  return res.body.data.items;
}

/**
 * Menjalankan satu loop penuh. `owner` adalah requester (jalur A) atau liaison (jalur B).
 */
async function runLoop({ owner, admin, talent, skillId, label }) {
  // 1) Komunitas & kebutuhan dalam bahasa sehari-hari
  const community = await api().post('/api/communities').set(owner.headers).send({
    name: `Komunitas ${label}`, type: 'UMKM', lat: -6.91, lng: 107.6,
  });
  expect(community.status).toBe(201);

  const created = await api().post('/api/needs').set(owner.headers).send({
    title: `Catatan kas ${label} masih di buku`,
    description: 'Bendahara mencatat kas di buku tulis dan sering selisih di akhir bulan.',
    category: 'PENCATATAN',
    community_id: community.body.data.id,
    skill_ids: [skillId],
  });
  expect(created.status).toBe(201);
  const need = created.body.data;
  expect(need.moderation_status).toBe('PENDING');

  // 2) Belum tayang sebelum moderasi
  const before = await api().get('/api/needs/catalog?limit=50').set(talent.headers);
  expect(before.body.data.items.map((n) => n.id)).not.toContain(need.id);

  // 3) Admin menyetujui dari antrean moderasi
  const queue = await api().get('/api/admin/moderation?decision=PENDING&limit=50').set(admin.headers);
  const item = queue.body.data.items.find((i) => i.item_type === 'KEBUTUHAN' && i.ref_id === need.id);
  expect(item).toBeTruthy();
  const approve = await api().patch(`/api/admin/moderation/${item.id}`).set(admin.headers)
    .send({ decision: 'APPROVED', checklist_layak: true, checklist_kategori: true });
  expect(approve.status).toBe(200);
  expect((await notificationsOf(owner.headers)).map((n) => n.title)).toContain('Kebutuhan disetujui');

  // 4) Talenta menemukan di katalog (dengan keahlian) dan melamar
  const catalog = await api().get(`/api/needs/catalog?skill=${skillId}&limit=50`).set(talent.headers);
  const listed = catalog.body.data.items.find((n) => n.id === need.id);
  expect(listed).toBeTruthy();
  expect(listed.skills.map((s) => s.id)).toContain(skillId);

  const applied = await api().post(`/api/applications/needs/${need.id}`).set(talent.headers)
    .send({ message: 'Saya biasa merapikan pencatatan kas dengan Google Sheets.' });
  expect(applied.status).toBe(201);

  // 5) Pemilik (requester atau liaison) menerima notifikasi dan melihat pelamar beserta jejaknya
  expect((await notificationsOf(owner.headers)).map((n) => n.title)).toContain('Lamaran baru');
  const applicants = await api().get(`/api/applications/for-need/${need.id}`).set(owner.headers);
  expect(applicants.status).toBe(200);
  const applicant = applicants.body.data.items[0];
  expect(applicant).toMatchObject({ talent_id: talent.id, status: 'MENUNGGU' });
  expect(applicant).toHaveProperty('projects_completed');
  expect(applicant).toHaveProperty('recent_testimonials');
  expect(applicant).not.toHaveProperty('email');

  // 6) Memilih talenta + menyepakati lingkup & definisi selesai
  const decided = await api().patch(`/api/applications/${applicant.id}/decide`).set(owner.headers).send({
    decision: 'DITERIMA',
    scope: 'Membuat pencatatan kas berbasis Google Sheets dengan rekap bulanan otomatis.',
    done_definition: 'Selesai bila bendahara bisa mencatat sendiri dan rekap muncul otomatis.',
  });
  expect(decided.status).toBe(200);

  const mine = await api().get('/api/projects/mine').set(talent.headers);
  const project = mine.body.data.items.find((p) => p.need_id === need.id);
  expect(project).toMatchObject({ status: 'AGREEMENT', requester_id: owner.id });

  // 7) Talenta menyetujui → dikerjakan
  const agreed = await api().patch(`/api/projects/${project.id}/agree`).set(talent.headers);
  expect(agreed.status).toBe(200);
  expect(agreed.body.data.status).toBe('IN_PROGRESS');
  expect((await notificationsOf(owner.headers)).map((n) => n.title)).toContain('Kesepakatan disetujui talenta');

  // 8) Talenta mengirim hasil → menunggu verifikasi; reputasi BELUM bertambah (sign-off dua arah)
  const delivered = await api().post(`/api/projects/${project.id}/deliveries`).set(talent.headers)
    .send({ link_url: 'https://example.com/hasil-kas' });
  expect(delivered.status).toBe(200);
  expect(delivered.body.data.status).toBe('AWAITING_VERIFICATION');
  const pointsBefore = (await one(`SELECT reputation_points AS p FROM talent_profiles WHERE user_id = ?`, [talent.id])).p;

  // 9) Pemilik memverifikasi + testimoni → reputasi +1
  const testimonial = `Hasilnya dipakai bendahara setiap hari (${label}).`;
  const verified = await api().post(`/api/projects/${project.id}/verify`).set(owner.headers).send({ testimonial });
  expect(verified.status).toBe(200);
  expect(verified.body.data.status).toBe('COMPLETED');

  const pointsAfter = (await one(`SELECT reputation_points AS p FROM talent_profiles WHERE user_id = ?`, [talent.id])).p;
  expect(pointsAfter).toBe(pointsBefore + 1);

  // 10) Testimoni tampil di profil publik talenta
  const testimonials = await api().get(`/api/talent/${talent.id}/testimonials`).set(owner.headers);
  expect(testimonials.status).toBe(200);
  expect(testimonials.body.data.items.map((t) => t.text)).toContain(testimonial);

  return { need, project };
}

describe('Loop G4 end-to-end (acceptance T3)', () => {
  let admin;
  let skillId;

  beforeAll(async () => {
    await resetData();
    admin = await loginExisting(await createUser('admin'));
    const [res] = await pool.query(`INSERT INTO skills (name) VALUES ('Google Sheets')`);
    skillId = res.insertId;
  });

  it('Jalur A — requester mandiri sampai reputasi talenta +1', async () => {
    const requester = await registerAndLogin({ email: 'ibu.ani@uji.test', role: 'requester', name: 'Ibu Ani' });
    const talent = await registerAndLogin({ email: 'dimas@uji.test', role: 'talent', name: 'Dimas' });
    const { need } = await runLoop({ owner: requester, admin, talent, skillId, label: 'A' });
    expect((await one(`SELECT source, requester_id FROM needs WHERE id = ?`, [need.id])))
      .toEqual({ source: 'MANDIRI', requester_id: requester.id });
  });

  it('Jalur B — Assisted Intake: liaison sebagai pemilik proksi sampai reputasi talenta +1', async () => {
    const liaison = await loginExisting(await createUser('liaison'));
    const talent = await registerAndLogin({ email: 'sari@uji.test', role: 'talent', name: 'Sari' });
    const { need, project } = await runLoop({ owner: liaison, admin, talent, skillId, label: 'B' });
    expect(await one(`SELECT source, requester_id, created_by FROM needs WHERE id = ?`, [need.id]))
      .toEqual({ source: 'AGENSUSI', requester_id: null, created_by: liaison.id });
    expect((await one(`SELECT requester_id FROM projects WHERE id = ?`, [project.id])).requester_id).toBe(liaison.id);

    // Liaison melihat kebutuhan Assisted-nya lewat /needs/mine
    const mine = await api().get('/api/needs/mine').set(liaison.headers);
    expect(mine.body.data.items.map((n) => n.id)).toContain(need.id);
  });
});
