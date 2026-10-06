// Smoke API lintas peran (T16). Satu perintah, mencetak LULUS/GAGAL per langkah:
//   Jalur A (mandiri) & B (via AgenSUSI): ajukan → moderasi → lamar → pilih → setuju → kirim hasil →
//   verifikasi → reputasi naik → testimoni publik.
//   Tambahan: gabung komunitas + persetujuan, rekomendasi + undang, sertifikasi + verifikasi publik,
//   handoff Tanya SUSI → AgenSUSI.
// Membuat data baru: jalankan di DB sekali pakai (mis. DB_NAME=susi_community_e2e npm run demo:reset),
// atau ulangi `npm run demo:reset` sesudahnya.
//
//   npm run smoke:api [-- http://localhost:3019/api]
import 'dotenv/config';

const base = process.argv[2] || `http://localhost:${process.env.PORT || 3009}/api`;
const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const results = [];

async function call(method, path, token, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${json.message ?? json.error?.message ?? ''}`.trim());
  return json.data;
}
const login = async (email, password = process.env.SEED_USER_PASSWORD) => {
  const data = await call('POST', '/auth/login', null, { email, password });
  return { token: data.accessToken, id: data.user.id, name: data.user.name };
};
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`   ${pass ? 'LULUS' : 'GAGAL'}  ${name}${detail ? `  [${detail}]` : ''}`);
  return pass;
};
async function section(title, fn) {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (err) {
    check(`galat: ${err.message}`, false);
  }
}

const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const u = Object.fromEntries(await Promise.all(
  [['siti', 'siti@umkm.test'], ['ujang', 'ujang@kebun.test'], ['budi', 'budi@susi.test'], ['rizky', 'rizky@talenta.test'],
    ['alya', 'alya@talenta.test'], ['nabila', 'nabila@talenta.test'], ['deden', 'deden@karta.test']]
    .map(async ([k, email]) => [k, await login(email)]),
));
const skills = await call('GET', '/skills', admin.token);
const skillId = (name) => skills.find((s) => s.name === name)?.id;
const communityId = async (user, name) => (await call('GET', '/communities?limit=50', user.token)).items.find((c) => c.name === name)?.id;

/** Alur G4 lengkap untuk satu kebutuhan. `owner` = pemilik (komunitas atau AgenSUSI proksi). */
async function g4(label, { owner, talent, community, category, skill, inviteFirst = false }) {
  // 1. Ajukan
  const need = await call('POST', '/needs', owner.token, {
    title: `Smoke ${label} ${stamp}: rekap kas digital`, category, community_id: community,
    description: 'Catatan kas masih manual di buku; kami butuh rekap digital yang bisa dibuka pengurus dari HP.',
    skill_ids: skill ? [skillId(skill)] : [],
  });
  check('ajukan kebutuhan → PENDING', need.moderation_status === 'PENDING', `#${need.id}`);
  // 2. Moderasi admin
  const queue = await call('GET', '/admin/moderation?decision=PENDING&item_type=KEBUTUHAN&limit=50', admin.token);
  const item = queue.items.find((i) => Number(i.ref_id) === Number(need.id));
  await call('PATCH', `/admin/moderation/${item.id}`, admin.token, { decision: 'APPROVED', checklist_layak: true, checklist_kategori: true });
  const approved = await call('GET', `/needs/${need.id}`, talent.token);
  check('moderasi admin → tayang di katalog (APPROVED, OPEN)', approved.moderation_status === 'APPROVED' && approved.status === 'OPEN');
  // (Opsional) rekomendasi + undang sebelum talenta melamar.
  if (inviteFirst) {
    const recs = await call('GET', `/recommendations/talents?need_id=${need.id}`, owner.token);
    const target = recs.items.find((t) => Number(t.talent_id) === Number(talent.id));
    check('rekomendasi talenta memuat talenta yang cocok', Boolean(target), target ? `${target.name} ${target.score}%` : 'tidak ada');
    await call('POST', `/needs/${need.id}/invite`, owner.token, { talent_id: talent.id });
    const mine = await call('GET', '/recommendations/needs?limit=50', talent.token);
    check('undangan tampil di rekomendasi talenta (invited)', mine.items.some((n) => Number(n.id) === Number(need.id) && n.invited));
  }
  // 3. Lamar
  await call('POST', `/applications/needs/${need.id}`, talent.token, { message: 'Saya siap membantu membuat rekap kas digital.' });
  // 4. Pilih (pemilik)
  const applicants = await call('GET', `/applications/for-need/${need.id}`, owner.token);
  const application = (applicants.items ?? applicants).find((a) => Number(a.talent_id) === Number(talent.id));
  check('talenta melamar, terlihat oleh pemilik', Boolean(application));
  const deadline = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  await call('PATCH', `/applications/${application.id}/decide`, owner.token, {
    decision: 'DITERIMA', scope: 'Membuat rekap kas digital di Google Sheets.', done_definition: 'Pengurus bisa mencatat dan melihat saldo dari HP.', deadline,
  });
  const projects = await call('GET', '/projects/mine?limit=50', talent.token);
  const project = projects.items.find((p) => Number(p.need_id) === Number(need.id));
  check('pemilik memilih → proyek AGREEMENT', project?.status === 'AGREEMENT', `proyek #${project?.id}`);
  // 5. Setuju, 6. kirim hasil
  await call('PATCH', `/projects/${project.id}/agree`, talent.token);
  await call('POST', `/projects/${project.id}/deliveries`, talent.token, { link_url: 'https://example.com/demo/rekap-kas' });
  const delivered = await call('GET', `/projects/${project.id}`, owner.token);
  check('talenta setuju & kirim hasil → AWAITING_VERIFICATION', delivered.status === 'AWAITING_VERIFICATION');
  // 7. Verifikasi + testimoni, 8. reputasi naik, 9. testimoni publik
  const before = (await call('GET', '/talent/profile', talent.token)).profile.reputation_points;
  const text = `Smoke ${label} ${stamp}: rekapnya langsung dipakai pengurus.`;
  await call('POST', `/projects/${project.id}/verify`, owner.token, { testimonial: text });
  const done = await call('GET', `/projects/${project.id}`, talent.token);
  const after = (await call('GET', '/talent/profile', talent.token)).profile.reputation_points;
  check('verifikasi → COMPLETED, reputasi +1', done.status === 'COMPLETED' && Number(after) === Number(before) + 1, `${before} → ${after}`);
  const publicT = await call('GET', `/talent/${talent.id}/testimonials?limit=50`, u.deden.token);
  check('testimoni tampil di profil publik talenta', (publicT.items ?? publicT).some((t) => t.text === text));
}

await section('Jalur A (mandiri): Ibu Siti → Rizky, dengan rekomendasi + undangan', async () => {
  await g4('A', { owner: u.siti, talent: u.rizky, community: await communityId(u.siti, 'Paguyuban UMKM Sepatu Cibaduyut'), category: 'WEBSITE', skill: 'React', inviteFirst: true });
});

await section('Jalur B (via AgenSUSI): Budi (pemilik proksi) → Alya', async () => {
  await g4('B', { owner: u.budi, talent: u.alya, community: await communityId(u.budi, 'PKK RW 04 Ujungberung'), category: 'LAINNYA', skill: 'Canva' });
});

await section('Gabung komunitas + persetujuan pengurus', async () => {
  const cib = await communityId(u.siti, 'Paguyuban UMKM Sepatu Cibaduyut');
  // Seed: Rizky sudah mengajukan gabung (PENDING) ke Cibaduyut.
  await call('PATCH', `/communities/${cib}/join-requests/${u.rizky.id}`, u.siti.token, { decision: 'ACTIVE' });
  const mine = await call('GET', '/communities?mine=true&limit=50', u.rizky.token);
  check('pengurus menyetujui → Rizky anggota aktif', mine.items.some((c) => c.id === cib && c.is_member));
  const kebun = await communityId(u.alya, 'Komunitas Urban Farming Buahbatu');
  await call('POST', `/communities/${kebun}/join`, u.alya.token, { message: 'Saya ingin bantu desain materi kebun.' });
  await call('PATCH', `/communities/${kebun}/join-requests/${u.alya.id}`, u.ujang.token, { decision: 'ACTIVE' });
  const alyaMine = await call('GET', '/communities?mine=true&limit=50', u.alya.token);
  check('talenta ajukan gabung → pengurus setujui', alyaMine.items.some((c) => c.id === kebun && c.is_member));
});

await section('Sertifikasi talenta + verifikasi publik', async () => {
  const e = await call('GET', '/certifications/eligibility', u.nabila.token);
  check('Nabila layak (≥ 3 proyek selesai)', e.eligible, `${e.completed} proyek`);
  const req = await call('POST', '/certifications', u.nabila.token, {
    focus_area: 'PENCATATAN', pitch: 'Tiga proyek pencatatan untuk PKK, Karang Taruna, dan UMKM sudah dipakai pengurus setiap bulan.',
    project_ids: e.completed_projects.map((p) => p.id),
  });
  const decided = await call('PATCH', `/admin/certifications/${req.id}`, u.budi.token, { decision: 'APPROVED', note: 'Bukti lengkap.' });
  const pub = await fetch(`${base}/public/certificates/${decided.code}`).then((r) => r.json());
  check('AgenSUSI menyetujui → sertifikat publik VALID tanpa login', pub.data?.status === 'VALID' && !('email' in pub.data), decided.code);
});

await section('Handoff Tanya SUSI → AgenSUSI', async () => {
  const ask = await call('POST', '/chatbot/message', u.alya.token, { message: 'apakah ada aplikasi android susi di play store?' });
  check('AI menyarankan eskalasi', ask.escalation_suggested === true);
  const esc = await call('POST', '/chatbot/escalate', u.alya.token, { session_id: ask.session_id });
  await call('PATCH', `/liaison/escalations/${esc.escalation.id}/claim`, u.budi.token);
  await call('POST', `/liaison/escalations/${esc.escalation.id}/reply`, u.budi.token, { message: 'Halo, aplikasi Android belum ada; SUSI bisa dibuka lewat peramban.' });
  const s = await call('GET', `/chatbot/session/${ask.session_id}`, u.alya.token);
  check('agen klaim & membalas → handoff assigned, pesan agent', s.handoff.status === 'assigned' && s.messages.at(-1).role === 'agent', s.handoff.agent?.name);
  const waiting = await call('POST', '/chatbot/message', u.alya.token, { session_id: ask.session_id, message: 'Baik, terima kasih.' });
  check('selama handoff AI dijeda (message null)', waiting.message === null && waiting.source === 'handoff');
  await call('PATCH', `/liaison/escalations/${esc.escalation.id}/resolve`, u.budi.token, { resolution: 'Aplikasi Android belum ada; pakai peramban.' });
  const r = await call('GET', `/chatbot/session/${ask.session_id}`, u.alya.token);
  check('selesai → handoff resolved', r.handoff.status === 'resolved');
});

const failed = results.filter((x) => !x).length;
console.log(failed ? `\nHASIL: ${failed} dari ${results.length} cek GAGAL` : `\nHASIL: semua ${results.length} cek LULUS`);
process.exit(failed ? 1 : 0);
