// Skema validasi body untuk semua endpoint POST/PATCH (T3.6). Pesan berbahasa Indonesia
// dan selalu menyebut nama kolom agar bisa langsung ditampilkan di form.
import { z } from 'zod';
import { isValidContact } from '../utils/contact.js';
import { FOCUS_AREAS, CERT_MAX_EVIDENCE } from '../services/certification.js';

// ===== Pembangun kolom =====

const text = (label, max, min = 1) =>
  z.string({ error: `${label} wajib diisi` })
    .trim()
    .min(min, min > 1 ? `${label} minimal ${min} karakter` : `${label} wajib diisi`)
    .max(max, `${label} maksimal ${max} karakter`);

const optText = (label, max) =>
  z.string({ error: `${label} harus berupa teks` })
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .nullable()
    .optional();

// Form sering mengirim '' untuk kolom kosong; tanpa ini z.coerce.number('') menjadi 0.
const emptyToNull = (schema) => z.preprocess((v) => (v === '' ? null : v), schema);

const id = (label) =>
  z.coerce.number({ error: `${label} tidak valid` }).int(`${label} tidak valid`).positive(`${label} tidak valid`);

const optId = (label) => emptyToNull(z.union([id(label), z.null()])).optional();

const enumOf = (label, values) =>
  z.enum(values, { error: `${label} harus salah satu dari: ${values.join(', ')}` });

const flag = (label) =>
  z.union([z.boolean(), z.literal(0), z.literal(1)], { error: `${label} harus true atau false` })
    .transform((v) => Boolean(v));

const date = (label) =>
  z.string({ error: `${label} wajib diisi` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus format YYYY-MM-DD`);

const time = (label) =>
  z.string({ error: `${label} tidak valid` }).regex(/^\d{2}:\d{2}(:\d{2})?$/, `${label} harus format HH:MM`);

const coordinate = (label, min, max) =>
  emptyToNull(z.union([
    z.null(),
    z.coerce.number({ error: `${label} tidak valid` }).min(min, `${label} tidak valid`).max(max, `${label} tidak valid`),
  ])).optional();

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const optHttpUrl = (label, max) =>
  z.string({ error: `${label} harus berupa teks` })
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .refine((v) => v === '' || isHttpUrl(v), `${label} harus URL http/https`)
    .nullable()
    .optional();

const phone = (label) =>
  z.string({ error: `${label} harus berupa teks` })
    .trim()
    .max(30, `${label} maksimal 30 karakter`)
    .regex(/^[0-9+()\-\s]*$/, `${label} hanya boleh berisi angka, spasi, +, -, ( )`)
    .nullable()
    .optional();

const email = z.string({ error: 'Email wajib diisi' })
  .trim()
  .toLowerCase()
  .max(150, 'Email maksimal 150 karakter')
  .email('Format email tidak valid');

// bcrypt hanya memakai 72 byte pertama.
const newPassword = z.string({ error: 'Password wajib diisi' })
  .min(10, 'Password minimal 10 karakter')
  .max(72, 'Password maksimal 72 karakter');

const idList = (label, max) =>
  z.array(id(label), { error: `${label} harus berupa daftar` })
    .max(max, `${label} maksimal ${max} item`)
    .transform((ids) => [...new Set(ids)]);

const atLeastOneField = (obj) => Object.values(obj).some((v) => v !== undefined);

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ===== Enum domain =====

export const NEED_CATEGORIES = ['PENCATATAN', 'WEBSITE', 'APLIKASI', 'LAINNYA'];
export const COMMUNITY_TYPES = ['KELUARGA', 'PEMUDA', 'HOBI', 'UMKM', 'PKK', 'RT/RW', 'KARANG TARUNA', 'LAINNYA'];
export const REJECT_REASONS = ['SPAM', 'DUPLIKAT', 'SALAH KATEGORI', 'TIDAK LAYAK'];
export const TOPIC_CATEGORIES = ['DISKUSI', 'TANYA', 'INFO'];
const USER_STATUSES = ['AKTIF', 'DITANGGUHKAN'];

// ===== Auth =====

export const registerSchema = z.object({
  email,
  password: newPassword,
  role: z.enum(['requester', 'talent'], {
    error: 'Peran tidak valid. Pilih komunitas (requester) atau talenta.',
  }),
  name: text('Nama', 120),
  extra_info: optText('Info tambahan', 150),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Email wajib diisi' }).trim().toLowerCase().min(1, 'Email wajib diisi').max(150),
  password: z.string({ error: 'Password wajib diisi' }).min(1, 'Password wajib diisi').max(200),
});

export const updateMeSchema = z.object({
  name: text('Nama', 120).optional(),
  phone: phone('Nomor telepon'),
  bio: optText('Bio', 1000),
  extra_info: optText('Info tambahan', 150),
  avatar_url: optHttpUrl('URL avatar', 255),
}).refine(atLeastOneField, 'Tidak ada data yang diubah');

// ===== Admin =====

export const moderationDecisionSchema = z.object({
  decision: enumOf('Keputusan', ['APPROVED', 'REJECTED']),
  reject_reason: z.union([enumOf('Alasan penolakan', REJECT_REASONS), z.null()]).optional(),
  checklist_layak: flag('Checklist layak').optional(),
  checklist_kategori: flag('Checklist kategori').optional(),
}).superRefine((body, ctx) => {
  if (body.decision === 'REJECTED' && !body.reject_reason) {
    ctx.addIssue({
      code: 'custom',
      path: ['reject_reason'],
      message: `Alasan penolakan wajib salah satu dari: ${REJECT_REASONS.join(', ')}`,
    });
  }
});

export const takedownSchema = z.object({ reason: optText('Alasan', 200) });

export const resolveDisputeSchema = z.object({
  decision: enumOf('Keputusan', ['MARK_COMPLETE', 'EXTEND_7_DAYS']),
  statement_admin: optText('Pernyataan admin', 1000),
});

export const adminMessageSchema = z.object({ body: text('Pesan', 2000) });

export const userStatusSchema = z.object({ status: enumOf('Status', USER_STATUSES) });

const target = (label) => z.coerce.number({ error: `${label} tidak valid` }).int(`${label} tidak valid`)
  .min(0, `${label} minimal 0`).max(1000, `${label} maksimal 1000`).optional();

export const createLiaisonSchema = z.object({
  name: text('Nama', 120),
  email,
  password: newPassword,
  phone: phone('Nomor telepon'),
  target_visits_month: target('Target kunjungan per bulan'),
  target_intake_month: target('Target intake per bulan'),
});

// ===== Kebutuhan =====

const needFields = {
  title: text('Judul', 200),
  description: text('Deskripsi', 5000),
  category: enumOf('Kategori', NEED_CATEGORIES).optional(),
  summary: optText('Ringkasan', 300),
  address: optText('Alamat', 255),
  lat: coordinate('Latitude', -90, 90),
  lng: coordinate('Longitude', -180, 180),
  community_id: optId('Komunitas'),
  skill_ids: idList('Keahlian', 10).optional(),
};

export const createNeedSchema = z.object(needFields);

export const updateNeedSchema = z.object({
  ...needFields,
  title: needFields.title.optional(),
  description: needFields.description.optional(),
}).refine(atLeastOneField, 'Tidak ada data yang diubah');

export const withdrawNeedSchema = z.object({ reason: optText('Alasan', 300) });

// ===== Lamaran =====

export const applySchema = z.object({ message: optText('Pesan lamaran', 2000) });

// R1: pemilik kebutuhan mengundang talenta dari rekomendasi.
export const inviteTalentSchema = z.object({ talent_id: id('Talenta') });

// Saat menerima, kesepakatan (lingkup + definisi selesai) wajib diisi (PRD P0-4).
export const decideApplicationSchema = z.object({
  decision: enumOf('Keputusan', ['DITERIMA', 'DITOLAK']),
  scope: optText('Lingkup pekerjaan', 5000),
  done_definition: optText('Definisi selesai', 2000),
  deadline: emptyToNull(z.union([date('Tenggat'), z.null()])).optional(),
}).superRefine((body, ctx) => {
  if (body.decision !== 'DITERIMA') return;
  if (!body.scope || body.scope.length < 5) {
    ctx.addIssue({ code: 'custom', path: ['scope'], message: 'Lingkup pekerjaan wajib diisi (minimal 5 karakter)' });
  }
  if (!body.done_definition || body.done_definition.length < 5) {
    ctx.addIssue({ code: 'custom', path: ['done_definition'], message: 'Definisi selesai wajib diisi (minimal 5 karakter)' });
  }
  if (body.deadline && body.deadline < todayString()) {
    ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Tenggat tidak boleh di masa lalu' });
  }
});

// ===== Proyek =====

export const deliverySchema = z.object({
  file_name: optText('Nama berkas', 255),
  file_path: optText('Lokasi berkas', 500),
  link_url: optText('Tautan', 500),
});

export const verifySchema = z.object({ testimonial: optText('Testimoni', 1000) });

export const revisionSchema = z.object({ note: text('Catatan revisi', 2000) });

export const openDisputeSchema = z.object({
  summary: text('Ringkasan sengketa', 1000),
  statement: optText('Pernyataan', 2000),
});

export const disputeStatementSchema = z.object({ statement: text('Pernyataan', 2000) });

export const cancelProjectSchema = z.object({ reason: text('Alasan mundur', 500, 5) });

// ===== Komunitas & mading =====

export const createCommunitySchema = z.object({
  name: text('Nama komunitas', 150),
  type: enumOf('Jenis komunitas', COMMUNITY_TYPES).optional(),
  description: optText('Deskripsi', 2000),
  leader_name: optText('Nama ketua', 120),
  leader_role: optText('Jabatan ketua', 80),
  established_at: optText('Tahun berdiri', 20),
  whatsapp: phone('Nomor WhatsApp'),
  address: optText('Alamat', 255),
  lat: coordinate('Latitude', -90, 90),
  lng: coordinate('Longitude', -180, 180),
});

// U1: talenta mengajukan gabung (pesan singkat opsional); pengurus memutuskan.
export const joinRequestSchema = z.object({
  message: optText('Pesan', 300),
});

export const joinDecisionSchema = z.object({
  decision: enumOf('Keputusan', ['ACTIVE', 'REJECTED']),
});

const position = (label, min, max) =>
  z.coerce.number({ error: `${label} tidak valid` }).int(`${label} harus bilangan bulat`)
    .min(min, `${label} minimal ${min}`).max(max, `${label} maksimal ${max}`);

// Lama topik dipajang di mading (hari).
export const TOPIC_DURATIONS = [1, 3, 7, 14, 30];
const durationDays = z.coerce.number({ error: 'Lama dipajang tidak valid' })
  .refine((v) => TOPIC_DURATIONS.includes(v), `Lama dipajang harus salah satu dari: ${TOPIC_DURATIONS.join(', ')} hari`);

export const createTopicSchema = z.object({
  text: text('Isi topik', 1000),
  community_id: optId('Komunitas'),
  category: enumOf('Kategori', TOPIC_CATEGORIES).optional(),
  duration_days: durationDays.optional(),
  pos_x: position('Posisi X', 0, 32767).optional(),
  pos_y: position('Posisi Y', 0, 32767).optional(),
  rotation: position('Rotasi', -45, 45).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus format #RRGGBB').optional(),
});

export const extendTopicSchema = z.object({
  duration_days: durationDays,
});

export const createReplySchema = z.object({
  text: text('Balasan', 1000),
  community_id: optId('Komunitas'),
});

export const topicPositionSchema = z.object({
  pos_x: position('Posisi X', 0, 32767),
  pos_y: position('Posisi Y', 0, 32767),
  rotation: position('Rotasi', -45, 45).optional(),
});

// ===== Liaison =====

const visitFields = {
  community_id: optId('Komunitas'),
  community_name: text('Nama komunitas', 150),
  scheduled_date: date('Tanggal kunjungan'),
  scheduled_time: emptyToNull(z.union([time('Jam kunjungan'), z.null()])).optional(),
  address: optText('Alamat', 255),
  lat: coordinate('Latitude', -90, 90),
  lng: coordinate('Longitude', -180, 180),
  note: optText('Catatan', 2000),
  contact_person: optText('Narahubung', 120),
};

export const createVisitSchema = z.object(visitFields);

export const updateVisitSchema = z.object({
  ...visitFields,
  community_name: visitFields.community_name.optional(),
  scheduled_date: visitFields.scheduled_date.optional(),
  // Status hanya berubah lewat /start dan /finish.
  status: z.undefined({ error: 'Status kunjungan diubah lewat aksi mulai/selesai' }).optional(),
});

export const finishVisitSchema = z.object({
  note: optText('Catatan', 2000),
  need_id: optId('Kebutuhan'),
  address: optText('Alamat', 255),
  lat: coordinate('Latitude', -90, 90),
  lng: coordinate('Longitude', -180, 180),
});

// ===== Talenta, testimoni, pengaturan =====

export const talentProfileSchema = z.object({
  bio: optText('Bio', 1000),
  phone: phone('Nomor telepon'),
  extra_info: optText('Info tambahan', 150),
  skill_ids: idList('Keahlian', 20).optional(),
  skills: z.array(text('Nama keahlian', 60), { error: 'Keahlian harus berupa daftar' })
    .max(20, 'Keahlian maksimal 20 item').optional(),
}).refine(atLeastOneField, 'Tidak ada data yang diubah');

export const testimonialSchema = z.object({
  project_id: id('Proyek'),
  to_user_id: id('Penerima testimoni'),
  text: text('Testimoni', 1000),
  is_public: flag('Tampil publik').optional(),
});

export const settingsSchema = z.object({
  notif_email: flag('Notifikasi email').optional(),
  notif_whatsapp: flag('Notifikasi WhatsApp').optional(),
  notif_talenta: flag('Notifikasi talenta').optional(),
  notif_diskusi: flag('Notifikasi diskusi').optional(),
  show_location: flag('Tampilkan lokasi').optional(),
  // Tanya SUSI (T15): izinkan AI (LLM) & simpan riwayat chat.
  allows_ai_chat: flag('Izinkan AI di Tanya SUSI').optional(),
  allows_chat_history_storage: flag('Simpan riwayat chat').optional(),
  // R3: Tanya SUSI boleh membaca profil & rekomendasi untuk jawaban pribadi.
  allows_ai_personalization: flag('Personalisasi Tanya SUSI').optional(),
  // R1: talenta tampil di rekomendasi untuk pemilik kebutuhan.
  show_in_recommendations: flag('Tampil di rekomendasi').optional(),
}).refine(atLeastOneField, 'Tidak ada pengaturan yang diubah');

// ===== Chatbot =====

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const chatMessageSchema = z.object({
  // Kosong/tidak dikirim = mulai percakapan baru.
  session_id: emptyToNull(z.union([z.string().regex(UUID_RE, 'Sesi chat tidak valid'), z.null()])).optional(),
  message: text('Pesan', 500),
});

const chatSessionId = z.string({ error: 'Sesi chat wajib diisi' }).regex(UUID_RE, 'Sesi chat tidak valid');

// 👍 = 1, 👎 = -1. session_id wajib: bagi pengguna anonim, memegang id sesi = bukti kepemilikan.
export const chatFeedbackSchema = z.object({
  session_id: chatSessionId,
  message_id: id('Pesan'),
  value: z.union([z.literal(1), z.literal(-1)], { error: 'Nilai umpan balik harus 1 (membantu) atau -1 (tidak membantu)' }),
});

// Kontak balik untuk eskalasi: email atau nomor WhatsApp (wajib bagi anonim, dicek di controller).
export const escalateSchema = z.object({
  session_id: chatSessionId,
  contact: emptyToNull(z.union([
    z.string().trim().max(150, 'Kontak maksimal 150 karakter')
      .refine(isValidContact, 'Kontak harus email atau nomor WhatsApp yang valid'),
    z.null(),
  ])).optional(),
});

export const escalationReplySchema = z.object({ message: text('Balasan', 2000) });

// ===== Ruang AgenSUSI (U6) =====

export const handoffSessionSchema = z.object({ session_id: chatSessionId });

export const handoffRateSchema = z.object({
  session_id: chatSessionId,
  // Tanpa nilai = tutup bagian AgenSUSI tanpa menilai.
  rating: z.union([
    z.number({ error: 'Penilaian harus angka 1–5' }).int('Penilaian harus angka 1–5').min(1, 'Penilaian minimal 1').max(5, 'Penilaian maksimal 5'),
    z.null(),
  ]).optional(),
});

// "Kembalikan ke AI": pesan opsional untuk pengguna (kosong = pesan bawaan).
export const handbackSchema = z.object({ message: optText('Pesan untuk pengguna', 2000) });

// ===== Manajer KB admin (T14) =====

export const KB_AUDIENCES = ['all', 'public', 'requester', 'talent', 'liaison'];

// Daftar kata kunci atau satu teks dipisah koma → disimpan sebagai teks dipisah koma.
const kbKeywords = z.union([
  z.array(text('Kata kunci', 60), { error: 'Kata kunci wajib diisi' })
    .min(1, 'Kata kunci wajib diisi').max(30, 'Kata kunci maksimal 30 item'),
  text('Kata kunci', 500),
], { error: 'Kata kunci wajib diisi' })
  .transform((v) => (Array.isArray(v) ? v.join(', ') : v))
  .refine((v) => v.length <= 500, 'Kata kunci maksimal 500 karakter');

const kbFields = {
  title: text('Judul', 200, 3),
  category: optText('Kategori', 50),
  keywords: kbKeywords,
  reply: text('Jawaban', 2000, 10),
  audience: enumOf('Audiens', KB_AUDIENCES).optional(),
  status: enumOf('Status', ['active', 'draft', 'archived']).optional(),
  source: optText('Sumber', 255),
};

export const createKbSchema = z.object(kbFields);

export const updateKbSchema = z.object({
  ...kbFields,
  title: kbFields.title.optional(),
  keywords: kbKeywords.optional(),
  reply: kbFields.reply.optional(),
}).refine(atLeastOneField, 'Tidak ada data yang diubah');

// resolved = masalah selesai; closed = ditutup tanpa penyelesaian (spam, duplikat, salah sasaran).
export const resolveEscalationSchema = z.object({
  outcome: enumOf('Hasil', ['resolved', 'closed']).optional(),
  resolution: text('Catatan penyelesaian', 2000, 10),
  save_as_kb: flag('Simpan sebagai draft KB').optional(),
  kb_title: optText('Judul draft KB', 200),
  kb_keywords: z.array(text('Kata kunci', 60), { error: 'Kata kunci harus berupa daftar' })
    .max(15, 'Kata kunci maksimal 15 item').optional(),
}).superRefine((body, ctx) => {
  if (body.save_as_kb && body.outcome === 'closed') {
    ctx.addIssue({ code: 'custom', path: ['save_as_kb'], message: 'Tiket yang ditutup tanpa penyelesaian tidak bisa disimpan sebagai KB' });
  }
});

// ===== Sertifikasi talenta (U5) =====

export const certificationRequestSchema = z.object({
  focus_area: enumOf('Bidang', Object.keys(FOCUS_AREAS)),
  pitch: text('Alasan pengajuan', 1500, 30),
  // Jumlah minimal (CERT_MIN_PROJECTS) dan kepemilikan proyek dicek di controller.
  project_ids: idList('Proyek bukti', CERT_MAX_EVIDENCE).pipe(z.array(z.number()).min(1, 'Pilih proyek bukti')),
});

export const certificationDecisionSchema = z.object({
  decision: enumOf('Keputusan', ['APPROVED', 'REJECTED']),
  note: optText('Catatan', 1000),
}).superRefine((body, ctx) => {
  if (body.decision === 'REJECTED' && !body.note) {
    ctx.addIssue({ code: 'custom', path: ['note'], message: 'Catatan wajib diisi saat menolak, agar talenta tahu yang perlu diperbaiki' });
  }
});

export const certificateRevokeSchema = z.object({ reason: text('Alasan pencabutan', 500, 5) });
