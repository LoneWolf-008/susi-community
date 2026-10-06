// Seed data demo SUSI Community.
//
//   npm run seed              isi data demo (ditolak bila NODE_ENV=production)
//   npm run seed -- --force   paksa di production (hanya bila benar-benar perlu)
//   npm run seed -- --sync-kb timpa entri KB yang sudah ada dengan isi kb.json terbaru (per slug)
//
// Idempoten: user dicari per email, komunitas per nama, kebutuhan per judul (beserta seluruh
// turunannya: lamaran, proyek, pengiriman, testimoni, sengketa, notifikasi), entri KB per slug.
// Data yang sudah ada dilewati, jadi menjalankan seed dua kali tidak menduplikasi. Semuanya dalam
// satu transaksi.
//
// Env khusus seed (tidak dibutuhkan server):
//   ADMIN_EMAIL, ADMIN_PASSWORD  akun admin
//   SEED_USER_PASSWORD           password semua akun demo lain (liaison, requester, talenta)
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { recomputeReputation } from './reputation.js';
import { readKbFile, upsertKbEntries } from './kbSeed.js';
import { syncKbIndex } from '../services/chatbot/kb.js';
import { ruleSummary } from '../services/chatbot/escalation.js';
import { escalationCreatedReply } from '../services/chatbot/replies.js';
import { generateCertificateCode, focusLabel } from '../services/certification.js';
import {
  SKILLS, USERS, COMMUNITIES, NEEDS, VISITS, TOPICS, INVITES, ESCALATIONS, CERTIFICATIONS,
} from '../db/seeds/demo.js';

const BCRYPT_ROUNDS = 12; // sama dengan authController.register
const MIN_PASSWORD = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

const daysAgo = (days) => new Date(now.getTime() - days * DAY_MS);
const pad = (n) => String(n).padStart(2, '0');
const dateFromToday = (offsetDays) => {
  const d = new Date(now.getTime() + offsetDays * DAY_MS);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function readSeedConfig() {
  const errors = [];
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const userPassword = process.env.SEED_USER_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) errors.push('ADMIN_EMAIL wajib berisi email yang valid');
  if (adminPassword.length < MIN_PASSWORD) errors.push(`ADMIN_PASSWORD wajib, minimal ${MIN_PASSWORD} karakter`);
  if (userPassword.length < MIN_PASSWORD) errors.push(`SEED_USER_PASSWORD wajib, minimal ${MIN_PASSWORD} karakter`);
  if (errors.length > 0) {
    throw new Error(`Konfigurasi seed belum lengkap di backend/.env:\n  - ${errors.join('\n  - ')}`);
  }
  return { adminEmail, adminPassword, userPassword };
}

const counter = () => ({ dibuat: 0, dilewati: 0 });
const stats = {
  pengguna: counter(), skill: counter(), komunitas: counter(), anggota: counter(), kebutuhan: counter(),
  kunjungan: counter(), topik: counter(), kb: counter(), eskalasi: counter(), sertifikasi: counter(),
};
let passwordsUpdated = 0;
let kbUpdated = 0;

async function upsertUser(conn, def, password) {
  const [rows] = await conn.query(`SELECT id, role, password_hash FROM users WHERE email = ?`, [def.email]);
  let id;
  if (rows[0]) {
    id = rows[0].id;
    if (rows[0].role !== def.role) {
      throw new Error(`Email ${def.email} sudah dipakai akun ber-peran ${rows[0].role}, bukan ${def.role}`);
    }
    // Ikuti password di .env bila berubah sejak seed sebelumnya.
    if (!(await bcrypt.compare(password, rows[0].password_hash))) {
      await conn.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [await bcrypt.hash(password, BCRYPT_ROUNDS), id]);
      passwordsUpdated += 1;
    }
    stats.pengguna.dilewati += 1;
  } else {
    const [res] = await conn.query(
      `INSERT INTO users (name, email, password_hash, role, phone, bio, extra_info)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [def.name, def.email, await bcrypt.hash(password, BCRYPT_ROUNDS), def.role,
        def.phone ?? null, def.bio ?? null, def.extra_info ?? null],
    );
    id = res.insertId;
    stats.pengguna.dibuat += 1;
  }

  await conn.query(`INSERT IGNORE INTO user_settings (user_id) VALUES (?)`, [id]);
  if (def.role === 'talent') await conn.query(`INSERT IGNORE INTO talent_profiles (user_id) VALUES (?)`, [id]);
  if (def.role === 'liaison') await conn.query(`INSERT IGNORE INTO liaison_profiles (user_id) VALUES (?)`, [id]);
  return id;
}

async function seedSkills(conn) {
  const ids = {};
  for (const name of SKILLS) {
    const [res] = await conn.query(`INSERT IGNORE INTO skills (name) VALUES (?)`, [name]);
    stats.skill[res.affectedRows ? 'dibuat' : 'dilewati'] += 1;
    const [[row]] = await conn.query(`SELECT id FROM skills WHERE name = ?`, [name]);
    ids[name] = row.id;
  }
  return ids;
}

async function seedCommunities(conn, userIds) {
  const ids = {};
  for (const def of COMMUNITIES) {
    const [rows] = await conn.query(`SELECT id FROM communities WHERE name = ? LIMIT 1`, [def.name]);
    if (rows[0]) {
      ids[def.key] = rows[0].id;
      stats.komunitas.dilewati += 1;
    } else {
      const creator = USERS.find((u) => u.key === def.createdBy);
      const [res] = await conn.query(
        `INSERT INTO communities
           (name, type, description, leader_name, leader_role, members_count, established_at,
            whatsapp, address, lat, lng, source, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [def.name, def.type, def.description, def.leader_name, def.leader_role, def.members_count,
          def.established_at, def.whatsapp, def.address, def.lat, def.lng,
          creator.role === 'liaison' ? 'AGENSUSI' : 'MANDIRI', userIds[def.createdBy]],
      );
      ids[def.key] = res.insertId;
      stats.komunitas.dibuat += 1;
    }
    // Keanggotaan diisi juga untuk komunitas yang sudah ada (INSERT IGNORE per pasangan
    // komunitas–pengguna), agar DB lama ikut mendapat contoh permintaan gabung U1.
    await seedMembers(conn, def, ids[def.key], userIds);
  }
  return ids;
}

/**
 * Anggota komunitas: pengurus (ACTIVE) dan talenta yang bergabung lewat persetujuan (U1).
 * Permintaan PENDING yang baru dibuat ikut memberi notifikasi ke pemutusnya: pengurus, atau
 * liaison pembuat bila komunitas belum punya pengurus berakun.
 */
async function seedMembers(conn, def, communityId, userIds) {
  const managers = def.members.filter((m) => m.role_in === 'PENGURUS').map((m) => m.user);
  const deciders = managers.length > 0 ? managers : [def.createdBy];
  for (const m of def.members) {
    const at = m.daysAgo === undefined ? now : daysAgo(m.daysAgo);
    const status = m.status ?? 'ACTIVE';
    const [res] = await conn.query(
      `INSERT IGNORE INTO community_members
         (community_id, user_id, role_in, status, message, decided_by, decided_at, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [communityId, userIds[m.user], m.role_in, status, m.message ?? null,
        m.decidedBy ? userIds[m.decidedBy] : null, m.decidedBy ? at : null, at],
    );
    stats.anggota[res.affectedRows ? 'dibuat' : 'dilewati'] += 1;
    if (!res.affectedRows || status !== 'PENDING') continue;
    const talent = USERS.find((u) => u.key === m.user);
    for (const decider of deciders) {
      await notify(conn, {
        userId: userIds[decider], type: 'komunitas', title: 'Permintaan bergabung',
        body: `${talent.name} ingin bergabung dengan ${def.name}: "${m.message}"`.slice(0, 255),
        refType: 'community', refId: communityId, read: false, at,
      });
    }
  }
}

const notify = (conn, { userId, type, title, body, refType, refId, read, at }) =>
  conn.query(
    `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, title, body, refType, refId, read ? 1 : 0, at],
  );

const addEvent = (conn, projectId, actorId, eventType, label, at) =>
  conn.query(
    `INSERT INTO project_events (project_id, actor_id, event_type, label, created_at) VALUES (?, ?, ?, ?, ?)`,
    [projectId, actorId, eventType, label, at],
  );

async function seedProject(conn, def, ctx) {
  const p = def.project;
  const t = p.timeline;
  const talentId = ctx.userIds[p.talent];
  const at = (key) => (t[key] === undefined ? null : daysAgo(t[key]));

  const [res] = await conn.query(
    `INSERT INTO projects
       (need_id, community_id, requester_id, talent_id, application_id, scope, done_definition, deadline,
        status, progress_pct, agreed_by_talent_at, agreed_by_community_at, started_at,
        talent_marked_done_at, community_verified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ctx.needId, ctx.communityId, ctx.ownerId, talentId, ctx.applicationIds[p.talent], p.scope,
      p.done_definition, dateFromToday(p.deadlineInDays), p.status, p.progress, at('agreedByTalent'),
      at('agreedByCommunity'), at('started'), at('done'), at('verified'), at('created')],
  );
  const projectId = res.insertId;

  await addEvent(conn, projectId, ctx.ownerId, 'CREATED', 'Proyek dibuat dari lamaran yang diterima', at('created'));
  if (t.started !== undefined) {
    await addEvent(conn, projectId, talentId, 'STARTED', 'Talenta menyetujui dan mulai mengerjakan', at('started'));
  }

  for (const [index, delivery] of (p.deliveries || []).entries()) {
    await conn.query(
      `INSERT INTO project_deliveries (project_id, round_no, file_name, file_path, file_size, link_url, delivered_at)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
      [projectId, index + 1, delivery.link_url, daysAgo(delivery.daysAgo)],
    );
  }
  if (t.done !== undefined) {
    await addEvent(conn, projectId, talentId, 'DELIVERED', 'Talenta menandai proyek selesai', at('done'));
  }

  if (p.status === 'COMPLETED') {
    await addEvent(conn, projectId, ctx.ownerId, 'VERIFIED', 'Komunitas telah memverifikasi', at('verified'));
    await conn.query(
      `INSERT INTO reputation_events (talent_id, project_id, delta, created_at) VALUES (?, ?, 1, ?)`,
      [talentId, projectId, at('verified')],
    );
  }

  if (p.testimonial) {
    await conn.query(
      `INSERT INTO testimonials (project_id, from_user_id, to_user_id, text, is_public, moderation_status, created_at)
       VALUES (?, ?, ?, ?, 1, 'APPROVED', ?)`,
      [projectId, ctx.userIds[p.testimonial.from], talentId, p.testimonial.text, daysAgo(p.testimonial.daysAgo)],
    );
  }

  let disputeId = null;
  if (p.dispute) {
    const d = p.dispute;
    const [dRes] = await conn.query(
      `INSERT INTO disputes (project_id, status, summary, statement_community, statement_talent, opened_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, d.status, d.summary, d.statement_community, d.statement_talent, daysAgo(d.openedDaysAgo)],
    );
    disputeId = dRes.insertId;
    await conn.query(
      `INSERT INTO dispute_events (dispute_id, label, created_at) VALUES (?, 'Sengketa dibuka oleh komunitas', ?)`,
      [disputeId, daysAgo(d.openedDaysAgo)],
    );
    await addEvent(conn, projectId, ctx.ownerId, 'DISPUTED', 'Sengketa dibuka', daysAgo(d.openedDaysAgo));
  }

  return { projectId, disputeId };
}

async function seedNeeds(conn, ctx) {
  const ids = {};
  for (const def of NEEDS) {
    const [existing] = await conn.query(`SELECT id FROM needs WHERE title = ? LIMIT 1`, [def.title]);
    if (existing[0]) {
      ids[def.key] = existing[0].id;
      stats.kebutuhan.dilewati += 1;
      continue;
    }

    const owner = USERS.find((u) => u.key === def.owner);
    const ownerId = ctx.userIds[def.owner];
    const community = COMMUNITIES.find((c) => c.key === def.community);
    const communityId = ctx.communityIds[def.community];
    const source = owner.role === 'liaison' ? 'AGENSUSI' : 'MANDIRI';
    const createdAt = daysAgo(def.createdDaysAgo);
    const reviewedAt = daysAgo(Math.max(def.createdDaysAgo - 1, 0));

    const [res] = await conn.query(
      `INSERT INTO needs
         (community_id, requester_id, created_by, title, category, summary, description, address, lat, lng,
          source, moderation_status, reject_reason, risk_level, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RENDAH', ?, ?, ?)`,
      [communityId, owner.role === 'requester' ? ownerId : null, ownerId, def.title, def.category, def.summary,
        def.description, community.address, community.lat, community.lng, source, def.moderation,
        def.rejectReason ?? null, def.status, createdAt, createdAt],
    );
    const needId = res.insertId;
    ids[def.key] = needId;

    for (const skill of def.skills) {
      await conn.query(`INSERT IGNORE INTO need_skills (need_id, skill_id) VALUES (?, ?)`, [needId, ctx.skillIds[skill]]);
    }

    const decided = def.moderation !== 'PENDING';
    await conn.query(
      `INSERT INTO moderation_items
         (item_type, ref_id, title, submitted_by, source, risk_level, checklist_layak, checklist_kategori,
          decision, reject_reason, reviewed_by, reviewed_at, created_at)
       VALUES ('KEBUTUHAN', ?, ?, ?, ?, 'RENDAH', ?, ?, ?, ?, ?, ?, ?)`,
      [needId, def.title, ownerId, source, def.moderation === 'APPROVED' ? 1 : 0, decided ? 1 : 0,
        def.moderation, def.rejectReason ?? null, decided ? ctx.adminId : null, decided ? reviewedAt : null, createdAt],
    );
    await conn.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title, created_at)
       VALUES (?, 'CREATE', 'needs', ?, ?, ?)`,
      [ownerId, needId, def.title, createdAt],
    );
    if (decided) {
      await conn.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title, meta, created_at)
         VALUES (?, 'MODERATE', 'needs', ?, ?, ?, ?)`,
        [ctx.adminId, needId, def.title,
          JSON.stringify({ decision: def.moderation, reject_reason: def.rejectReason ?? null }), reviewedAt],
      );
    }

    const applicationIds = {};
    for (const app of def.applications) {
      const [appRes] = await conn.query(
        `INSERT INTO applications (need_id, talent_id, message, status, created_at, decided_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [needId, ctx.userIds[app.talent], app.message, app.status, daysAgo(app.daysAgo),
          app.decidedDaysAgo === undefined ? null : daysAgo(app.decidedDaysAgo)],
      );
      applicationIds[app.talent] = appRes.insertId;
    }

    let projectId = null;
    if (def.project) {
      ({ projectId } = await seedProject(conn, def, {
        ...ctx, needId, communityId, ownerId, applicationIds,
      }));
    }

    for (const n of def.notifications || []) {
      let refType = n.ref;
      let refId = needId;
      if (n.ref === 'project') refId = projectId;
      if (n.ref.startsWith('application:')) {
        refType = 'application';
        refId = applicationIds[n.ref.split(':')[1]];
      }
      await notify(conn, {
        userId: ctx.userIds[n.user], type: n.type, title: n.title, body: n.body,
        refType, refId, read: n.read, at: daysAgo(n.daysAgo),
      });
    }
    stats.kebutuhan.dibuat += 1;
  }
  return ids;
}

async function seedVisits(conn, ctx) {
  for (const def of VISITS) {
    const community = COMMUNITIES.find((c) => c.key === def.community);
    const liaisonId = ctx.userIds[def.liaison];
    const [rows] = await conn.query(
      `SELECT id FROM liaison_visits WHERE liaison_id = ? AND community_name = ? LIMIT 1`,
      [liaisonId, community.name],
    );
    if (rows[0]) {
      stats.kunjungan.dilewati += 1;
      continue;
    }
    const done = def.status === 'TERDATA';
    const visitAt = new Date(`${dateFromToday(def.dayOffset)}T${def.time}`);
    const [res] = await conn.query(
      `INSERT INTO liaison_visits
         (liaison_id, community_id, community_name, scheduled_date, scheduled_time, address, lat, lng,
          status, note, contact_person, need_id, started_at, finished_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [liaisonId, ctx.communityIds[def.community], community.name, dateFromToday(def.dayOffset), def.time,
        community.address, community.lat, community.lng, def.status, def.note, def.contact_person,
        def.need ? ctx.needIds[def.need] : null, done ? visitAt : null,
        done ? new Date(visitAt.getTime() + 90 * 60 * 1000) : null, daysAgo(Math.max(-def.dayOffset + 3, 3))],
    );
    if (def.notification) {
      await notify(conn, {
        userId: liaisonId, ...def.notification, refType: 'visit', refId: res.insertId, at: now,
      });
    }
    stats.kunjungan.dibuat += 1;
  }
}

async function seedTopics(conn, ctx) {
  for (const def of TOPICS) {
    const authorId = ctx.userIds[def.author];
    const [rows] = await conn.query(
      `SELECT id FROM discussion_topics WHERE author_id = ? AND text = ? LIMIT 1`,
      [authorId, def.text],
    );
    if (rows[0]) {
      stats.topik.dilewati += 1;
      continue;
    }
    const expiresAt = def.expiresInHours == null ? null : new Date(now.getTime() + def.expiresInHours * 60 * 60 * 1000);
    const [res] = await conn.query(
      `INSERT INTO discussion_topics
         (author_id, community_id, category, text, pos_x, pos_y, rotation, color, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [authorId, def.community ? ctx.communityIds[def.community] : null, def.category, def.text,
        def.pos_x, def.pos_y, def.rotation, def.color, daysAgo(def.daysAgo), expiresAt],
    );
    for (const reply of def.replies) {
      await conn.query(
        `INSERT INTO discussion_replies (topic_id, author_id, community_id, text, created_at) VALUES (?, ?, ?, ?, ?)`,
        [res.insertId, ctx.userIds[reply.author], reply.community ? ctx.communityIds[reply.community] : null,
          reply.text, daysAgo(reply.daysAgo)],
      );
    }
    stats.topik.dibuat += 1;
  }
}

/** Undangan melamar (R1), idempoten per pasangan kebutuhan–talenta; notifikasi hanya saat baru dibuat. */
async function seedInvites(conn, ctx) {
  for (const inv of INVITES) {
    const needId = ctx.needIds[inv.need];
    const talentId = ctx.userIds[inv.talent];
    const at = daysAgo(inv.daysAgo);
    const [res] = await conn.query(
      `INSERT IGNORE INTO need_invites (need_id, talent_id, invited_by, created_at) VALUES (?, ?, ?, ?)`,
      [needId, talentId, ctx.userIds[inv.by], at],
    );
    if (!res.affectedRows) continue;
    const def = NEEDS.find((n) => n.key === inv.need);
    await notify(conn, {
      userId: talentId, type: 'talenta', title: 'Undangan melamar',
      body: `Anda diundang melamar "${def.title}". Lamar bila Anda tertarik.`.slice(0, 255),
      refType: 'need', refId: needId, read: false, at,
    });
  }
}

/**
 * Sertifikasi talenta (U5), idempoten per (talenta, bidang, status). Sama dengan alur nyata: pengajuan +
 * proyek bukti + item moderasi TALENTA; yang disetujui mendapat sertifikat berkode acak dan notifikasi.
 */
async function seedCertifications(conn, ctx) {
  for (const def of CERTIFICATIONS) {
    const talentId = ctx.userIds[def.talent];
    const [[existing]] = await conn.query(
      `SELECT id FROM certification_requests WHERE talent_id = ? AND focus_area = ? AND status = ? LIMIT 1`,
      [talentId, def.focus, def.status],
    );
    if (existing) {
      stats.sertifikasi.dilewati += 1;
      continue;
    }
    const talent = USERS.find((u) => u.key === def.talent);
    const createdAt = daysAgo(def.daysAgo);
    const reviewedAt = def.reviewedDaysAgo === undefined ? null : daysAgo(def.reviewedDaysAgo);
    const reviewerId = def.reviewer ? ctx.userIds[def.reviewer] : null;
    const [req] = await conn.query(
      `INSERT INTO certification_requests (talent_id, focus_area, pitch, status, reviewer_id, review_note, reviewed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [talentId, def.focus, def.pitch, def.status, reviewerId, def.note ?? null, reviewedAt, createdAt],
    );
    const requestId = req.insertId;
    for (const needKey of def.projects) {
      const [[project]] = await conn.query(`SELECT id FROM projects WHERE need_id = ? AND talent_id = ? LIMIT 1`, [ctx.needIds[needKey], talentId]);
      await conn.query(`INSERT INTO certification_request_projects (request_id, project_id) VALUES (?, ?)`, [requestId, project.id]);
    }
    const decided = def.status !== 'PENDING';
    await conn.query(
      `INSERT INTO moderation_items (item_type, ref_id, title, submitted_by, source, risk_level, decision, reviewed_by, reviewed_at, created_at)
       VALUES ('TALENTA', ?, ?, ?, 'MANDIRI', 'RENDAH', ?, ?, ?, ?)`,
      [requestId, `Sertifikasi ${focusLabel(def.focus)}: ${talent.name}`, talentId, def.status, reviewerId, reviewedAt, createdAt],
    );

    if (def.status === 'APPROVED') {
      const code = generateCertificateCode();
      await conn.query(
        `INSERT INTO certificates (talent_id, request_id, code, focus_area, project_count, issued_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [talentId, requestId, code, def.focus, def.projects.length, reviewedAt],
      );
      await notify(conn, {
        userId: talentId, type: 'verifikasi', title: 'Selamat, Anda Tersertifikasi SUSI',
        body: `Sertifikasi bidang ${focusLabel(def.focus)} disetujui. Kode sertifikat: ${code}.`,
        refType: 'certificate', refId: requestId, read: true, at: reviewedAt,
      });
      await conn.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title, meta, created_at)
         VALUES (?, 'APPROVE_CERTIFICATION', 'certification_requests', ?, ?, ?, ?)`,
        [reviewerId, requestId, `${talent.name} · ${focusLabel(def.focus)}`, JSON.stringify({ note: def.note ?? null, code }), reviewedAt],
      );
    } else if (!decided) {
      // Pengajuan baru: peninjau mendapat notifikasi seperti alur nyata.
      for (const reviewer of [ctx.adminId, ...USERS.filter((u) => u.role === 'liaison').map((u) => ctx.userIds[u.key])]) {
        await notify(conn, {
          userId: reviewer, type: 'moderasi', title: 'Pengajuan sertifikasi baru',
          body: `${talent.name} mengajukan sertifikasi bidang ${focusLabel(def.focus)} dengan ${def.projects.length} proyek bukti.`,
          refType: 'certification', refId: requestId, read: false, at: createdAt,
        });
      }
    }
    stats.sertifikasi.dibuat += 1;
  }
}

/**
 * Percakapan yang dialihkan ke AgenSUSI (U6), idempoten per id sesi. Urutan sama dengan alur nyata:
 * bagian AI (+ ask_logs) → tiket + pesan konfirmasi → klaim → pesan AgenSUSI/pengguna.
 */
async function seedEscalations(conn, ctx) {
  const minutesAgo = (m) => new Date(now.getTime() - m * 60 * 1000);
  const addMessage = async (sessionId, role, content, at) => {
    const [res] = await conn.query(
      `INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`,
      [sessionId, role, content, at],
    );
    return res.insertId;
  };

  for (const def of ESCALATIONS) {
    const userId = ctx.userIds[def.user];
    const agentId = ctx.userIds[def.agent];
    const owner = USERS.find((u) => u.key === def.user);
    const startedAt = minutesAgo(def.ai[0].minutesAgo);
    const [session] = await conn.query(
      `INSERT IGNORE INTO chat_sessions (id, user_id, role, started_at, last_active_at) VALUES (?, ?, ?, ?, ?)`,
      [def.session, userId, owner.role, startedAt, minutesAgo(def.afterHandoff.at(-1).minutesAgo)],
    );
    if (!session.affectedRows) {
      stats.eskalasi.dilewati += 1;
      continue;
    }

    for (const turn of def.ai) {
      const at = minutesAgo(turn.minutesAgo);
      await addMessage(def.session, 'user', turn.question, at);
      const answerId = await addMessage(def.session, 'assistant', turn.answer, at);
      await conn.query(
        `INSERT INTO ask_logs (user_id, session_id, message_id, question, matched, intent, model, prompt_version, latency_ms, created_at)
         VALUES (?, ?, ?, ?, 1, ?, NULL, 'seed', 0, ?)`,
        [userId, def.session, answerId, turn.question, turn.intent, at],
      );
    }

    const handoffAt = minutesAgo(def.handoffMinutesAgo);
    const summary = ruleSummary({ role: owner.role, questions: def.ai.map((t) => t.question), reasons: def.reasons });
    const [esc] = await conn.query(
      `INSERT INTO escalations (session_id, user_id, reason, score, priority, summary, summary_source, status, assigned_to,
                                created_at, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, 'rule', ?, ?, ?, ?)`,
      [def.session, userId, def.reasons.join(','), def.score, def.priority, summary, def.status, agentId, handoffAt,
        minutesAgo(def.assignedMinutesAgo)],
    );
    const escalationId = esc.insertId;
    const confirmId = await addMessage(
      def.session, 'assistant', escalationCreatedReply({ id: escalationId, available: true, anonymous: false }), handoffAt,
    );

    let userReadId = confirmId;
    let agentReadId = confirmId;
    for (const m of def.afterHandoff) {
      const id = await addMessage(def.session, m.role, m.text, minutesAgo(m.minutesAgo));
      // Agen sudah membaca semua pesan pengguna (ia membalas sesudahnya); pengguna belum membaca yang `unread`.
      agentReadId = id;
      if (!m.unread) userReadId = id;
    }
    await conn.query(
      `UPDATE escalations SET handoff_message_id = ?, user_read_id = ?, agent_read_id = ? WHERE id = ?`,
      [confirmId, userReadId, agentReadId, escalationId],
    );

    await notify(conn, {
      userId: agentId, type: 'eskalasi', title: 'Eskalasi chat baru', body: summary.slice(0, 255),
      refType: 'escalation', refId: escalationId, read: true, at: handoffAt,
    });
    const lastAgent = def.afterHandoff.filter((m) => m.role === 'agent').at(-1);
    await notify(conn, {
      userId, type: 'eskalasi', title: 'Balasan dari AgenSUSI', body: lastAgent.text.slice(0, 255),
      refType: 'escalation', refId: escalationId, read: false, at: minutesAgo(lastAgent.minutesAgo),
    });
    stats.eskalasi.dibuat += 1;
  }
}

async function seedKnowledgeBase(conn) {
  const sync = process.argv.includes('--sync-kb');
  const { created, updated, skipped } = await upsertKbEntries(conn, await readKbFile(), { sync });
  stats.kb.dibuat += created;
  stats.kb.dilewati += skipped + updated;
  kbUpdated = updated;
}

async function seedDailyStats(conn) {
  // 14 hari terakhir; INSERT IGNORE agar hitungan kunjungan nyata tidak tertimpa.
  for (let d = 13; d >= 0; d -= 1) {
    await conn.query(`INSERT IGNORE INTO daily_stats (stat_date, visits) VALUES (?, ?)`, [
      dateFromToday(-d), 18 + ((d * 7) % 23),
    ]);
  }
}

async function main() {
  if (env.isProduction && !process.argv.includes('--force')) {
    throw new Error('Seed ditolak: NODE_ENV=production. Tambahkan --force bila memang disengaja.');
  }
  const config = readSeedConfig();

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    charset: 'utf8mb4_unicode_ci',
  });

  try {
    const [[{ ready }]] = await conn.query(
      `SELECT COUNT(*) AS ready FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'`,
    );
    if (!ready) throw new Error(`Database ${env.db.name} belum diinisialisasi. Jalankan "npm run db:init" dulu.`);

    await conn.beginTransaction();

    const userIds = {};
    const adminId = await upsertUser(
      conn, { role: 'admin', name: 'Admin SUSI', email: config.adminEmail }, config.adminPassword,
    );
    for (const def of USERS) userIds[def.key] = await upsertUser(conn, def, config.userPassword);

    const skillIds = await seedSkills(conn);
    for (const def of USERS.filter((u) => u.skills)) {
      for (const skill of def.skills) {
        await conn.query(`INSERT IGNORE INTO talent_skills (talent_id, skill_id) VALUES (?, ?)`, [
          userIds[def.key], skillIds[skill],
        ]);
      }
    }

    const communityIds = await seedCommunities(conn, userIds);
    const ctx = { adminId, userIds, skillIds, communityIds };
    ctx.needIds = await seedNeeds(conn, ctx);
    await seedInvites(conn, ctx);
    await seedCertifications(conn, ctx);
    await seedVisits(conn, ctx);
    await seedTopics(conn, ctx);
    await seedEscalations(conn, ctx);
    await seedKnowledgeBase(conn);
    await seedDailyStats(conn);

    // Poin = jumlah reputation_events; level mengikuti ambang di utils/reputation.js.
    await recomputeReputation(conn, USERS.filter((u) => u.role === 'talent').map((u) => userIds[u.key]));

    await conn.commit();
    // Di luar transaksi (OPTIMIZE melakukan commit implisit): tanpa ini, DB yang baru di-reset
    // memberi skor FULLTEXT 0 untuk semua entri sehingga chatbot memilih entri KB yang salah.
    await syncKbIndex(conn);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }

  console.log(`[seed] ${env.db.name} selesai.`);
  for (const [name, c] of Object.entries(stats)) {
    console.log(`  ${name.padEnd(11)} dibuat ${String(c.dibuat).padStart(2)} · sudah ada ${c.dilewati}`);
  }
  if (passwordsUpdated > 0) console.log(`  password diperbarui mengikuti .env: ${passwordsUpdated} akun`);
  if (kbUpdated > 0) console.log(`  entri KB disinkronkan dari kb.json (--sync-kb): ${kbUpdated}`);
}

main().catch((err) => {
  console.error(`\n[seed] GAGAL: ${err.message}`);
  process.exit(1);
});
