import { describe, it, expect } from 'vitest';
import {
  scoreConversation, priorityFor, withinServiceHours, clipWords, ruleSummary, summarizeConversation,
  ESCALATION_WEIGHTS,
} from '../../services/chatbot/escalation.js';
import { isValidContact } from '../../utils/contact.js';
import { validateEnv } from '../../config/env.js';
import { LLMTimeout } from '../../services/llm/errors.js';

const turn = (question, extra = {}) => ({ question, intent: 'faq', matched: 1, feedback: null, ...extra });

describe('Skor eskalasi (T13.2)', () => {
  it('bobot sesuai spesifikasi', () => {
    expect(ESCALATION_WEIGHTS).toEqual({
      explicit_request: 100, sensitive: 50, complaint: 40, repeated: 35, unanswered: 30, long_unresolved: 30,
    });
  });

  it('permintaan eksplisit = 100', () => {
    expect(scoreConversation([turn('saya mau bicara dengan agen susi', { intent: 'escalation_request' })]))
      .toEqual({ score: 100, reasons: ['explicit_request'] });
  });

  it('topik sensitif (sengketa, penipuan, data pribadi) = 50; ditambah nada keluhan = 90', () => {
    expect(scoreConversation([turn('bagaimana cara mengajukan sengketa?')])).toEqual({ score: 50, reasons: ['sensitive'] });
    expect(scoreConversation([turn('data pribadi saya bocor ke orang lain')]).reasons).toContain('sensitive');
    expect(scoreConversation([turn('saya ditipu talenta, kecewa sekali', { intent: 'complaint' })]))
      .toEqual({ score: 90, reasons: ['sensitive', 'complaint'] });
  });

  it('keluhan saja = 40 (di bawah ambang 50)', () => {
    expect(scoreConversation([turn('webnya lemot banget', { intent: 'complaint' })])).toEqual({ score: 40, reasons: ['complaint'] });
  });

  it('pertanyaan yang sama > 2 kali (setelah dibakukan) = 35', () => {
    const q = 'Gimana cara daftar?';
    expect(scoreConversation([turn(q), turn('gmn cara daftar')]).reasons).not.toContain('repeated');
    expect(scoreConversation([turn(q), turn('gmn cara daftar'), turn('GIMANA CARA DAFTAR??')]))
      .toEqual({ score: 35, reasons: ['repeated'] });
  });

  it('dua jawaban "belum tahu" berturut-turut untuk pertanyaan yang semestinya bisa dijawab = 30', () => {
    const unknown = (q) => turn(q, { matched: 0 });
    expect(scoreConversation([unknown('fitur lupa password ada?'), unknown('cara ganti email akun?')]))
      .toEqual({ score: 30, reasons: ['unanswered'] });
    // Di luar topik / basa-basi tidak dihitung.
    expect(scoreConversation([unknown('resep nasi goreng'), turn('cuaca hari ini', { intent: 'out_of_scope', matched: 0 })]).reasons)
      .not.toContain('unanswered');
    expect(scoreConversation([unknown('fitur lupa password ada?')]).reasons).not.toContain('unanswered');
  });

  it('> 5 giliran tanpa 👍 = 30; satu 👍 menghapus sinyal ini', () => {
    const turns = ['a satu', 'b dua', 'c tiga', 'd empat', 'e lima', 'f enam'].map((q) => turn(`soal ${q}`));
    expect(scoreConversation(turns)).toEqual({ score: 30, reasons: ['long_unresolved'] });
    turns[2].feedback = 1;
    expect(scoreConversation(turns).reasons).not.toContain('long_unresolved');
    expect(scoreConversation(turns.slice(0, 5)).reasons).not.toContain('long_unresolved');
  });

  it('sinyal digabung; percakapan biasa = 0', () => {
    const unknown = (q, intent = 'faq') => turn(q, { matched: 0, intent });
    const turns = [unknown('fitur lupa password?'), unknown('fitur lupa password?'), unknown('fitur lupa password?', 'complaint')];
    expect(scoreConversation(turns)).toEqual({ score: 105, reasons: ['complaint', 'repeated', 'unanswered'] });
    expect(scoreConversation([turn('berapa biaya pakai susi?')])).toEqual({ score: 0, reasons: [] });
    expect(scoreConversation([])).toEqual({ score: 0, reasons: [] });
  });

  it('prioritas tinggi untuk topik sensitif atau keluhan', () => {
    expect(priorityFor(['sensitive'])).toBe('high');
    expect(priorityFor(['complaint', 'repeated'])).toBe('high');
    expect(priorityFor(['explicit_request'])).toBe('normal');
    expect(priorityFor([])).toBe('normal');
  });
});

describe('Jam layanan AgenSUSI (T13.6)', () => {
  // 2026-10-05 03:30 UTC = 10:30 WIB; 12:30 UTC = 19:30 WIB.
  const morning = new Date('2026-10-05T03:30:00Z');
  const evening = new Date('2026-10-05T12:30:00Z');

  it('tanpa konfigurasi = selalu tersedia', () => {
    expect(withinServiceHours(evening, { hours: null, timeZone: 'Asia/Jakarta' })).toBe(true);
  });

  it('memakai zona waktu yang diatur, bukan zona waktu server', () => {
    expect(withinServiceHours(morning, { hours: '08:00-17:00', timeZone: 'Asia/Jakarta' })).toBe(true);
    expect(withinServiceHours(evening, { hours: '08:00-17:00', timeZone: 'Asia/Jakarta' })).toBe(false);
    expect(withinServiceHours(evening, { hours: '08:00-17:00', timeZone: 'UTC' })).toBe(true);
  });

  it('rentang lewat tengah malam', () => {
    expect(withinServiceHours(evening, { hours: '19:00-02:00', timeZone: 'Asia/Jakarta' })).toBe(true);
    expect(withinServiceHours(morning, { hours: '19:00-02:00', timeZone: 'Asia/Jakarta' })).toBe(false);
  });

  it('konfigurasi salah ditolak saat start', () => {
    const base = {
      DB_HOST: 'h', DB_PORT: '3306', DB_USER: 'u', DB_NAME: 'n', FRONTEND_URL: 'http://x',
      JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40),
    };
    expect(validateEnv({ ...base, CHATBOT_SERVICE_HOURS: '08:00-17:00', CHATBOT_SERVICE_TZ: 'Asia/Jakarta' })).toEqual([]);
    expect(validateEnv({ ...base, CHATBOT_SERVICE_HOURS: '8-17' })).toEqual([expect.stringMatching(/CHATBOT_SERVICE_HOURS/)]);
    expect(validateEnv({ ...base, CHATBOT_SERVICE_TZ: 'Bandung/Kota' })).toEqual([expect.stringMatching(/CHATBOT_SERVICE_TZ/)]);
    expect(validateEnv({ ...base, CHATBOT_ESCALATION_THRESHOLD: '0' })).toEqual([expect.stringMatching(/CHATBOT_ESCALATION_THRESHOLD/)]);
  });
});

describe('Ringkasan untuk AgenSUSI (T13.3)', () => {
  it('ringkasan aturan: siapa, 3 pertanyaan terakhir (PII disamarkan), alasan; ≤ 80 kata', () => {
    const text = ruleSummary({
      role: 'public',
      questions: ['halo', 'cara daftar?', 'nomor saya 081234567890, tolong telepon', 'kenapa gagal terus?'],
      reasons: ['complaint', 'repeated'],
    });
    expect(text).toBe('Pengunjung (belum masuk) meminta bantuan AgenSUSI. Pertanyaan terakhir: "cara daftar?"; "nomor saya [nomor disamarkan], tolong telepon"; "kenapa gagal terus?". Alasan: keluhan, pertanyaan berulang.');
    expect(ruleSummary({ role: 'talent', questions: [], reasons: [] })).toBe('Pengguna Talenta meminta bantuan AgenSUSI. Alasan: permintaan pengguna.');
    expect(ruleSummary({ role: 'requester', questions: ['x '.repeat(200)], reasons: [] }).split(/\s+/).length).toBeLessThanOrEqual(80);
  });

  it('clipWords memotong per kata', () => {
    expect(clipWords('a b c d', 2)).toBe('a b…');
    expect(clipWords('  a   b ', 5)).toBe('a b');
  });

  const noSpend = { query: async () => [[{ spent: 0 }]] };
  const transcript = [
    { role: 'user', content: 'cara daftar [nomor disamarkan]?' },
    { role: 'assistant', content: 'Buka halaman Masuk.' },
  ];

  it('LLM merangkum transkrip; hasil disamarkan PII-nya & dipotong 80 kata', async () => {
    const seen = [];
    const llm = {
      isConfigured: () => true,
      complete: async ({ messages, maxTokens }) => {
        seen.push({ messages, maxTokens });
        return { content: `Pengguna ingin daftar, hubungi 081234567890. ${'kata '.repeat(100)}`, model: 'm', usage: { costUsd: 0.0001 } };
      },
    };
    const out = await summarizeConversation({ db: noSpend, llm, transcript, fallback: 'cadangan' });
    expect(out).toMatchObject({ source: 'llm', model: 'm', costUsd: 0.0001 });
    expect(out.text).toContain('[nomor disamarkan]');
    expect(out.text).not.toContain('081234567890');
    expect(out.text.split(/\s+/).length).toBeLessThanOrEqual(80);
    expect(seen[0].maxTokens).toBe(200);
    expect(seen[0].messages[1].content).toContain('Pengguna: cara daftar [nomor disamarkan]?\nAsisten: Buka halaman Masuk.');
  });

  it('LLM gagal / tanpa key / anggaran habis → ringkasan aturan', async () => {
    const failing = { isConfigured: () => true, complete: async () => { throw new LLMTimeout('x'); } };
    expect(await summarizeConversation({ db: noSpend, llm: failing, transcript, fallback: 'cadangan' }))
      .toEqual({ text: 'cadangan', source: 'rule', llmError: 'LLMTimeout' });
    const noKey = { isConfigured: () => false, complete: async () => { throw new Error('tidak dipanggil'); } };
    expect(await summarizeConversation({ db: noSpend, llm: noKey, transcript, fallback: 'cadangan' }))
      .toEqual({ text: 'cadangan', source: 'rule' });
    const broke = { query: async () => [[{ spent: 999 }]] };
    const llm = { isConfigured: () => true, complete: async () => { throw new Error('tidak dipanggil'); } };
    expect(await summarizeConversation({ db: broke, llm, transcript, fallback: 'cadangan' })).toEqual({ text: 'cadangan', source: 'rule' });
  });
});

describe('Kontak balik (T13.3)', () => {
  it('email atau nomor WhatsApp 9–15 digit', () => {
    for (const ok of ['budi@mail.com', '081234567890', '+62 812-3456-7890', '(022) 1234 5678']) expect(isValidContact(ok), ok).toBe(true);
    for (const bad of ['', 'budi', '12345', 'telepon saya ya', '1234567890123456', 'a@b']) expect(isValidContact(bad), bad).toBe(false);
  });
});
