import { describe, it, expect } from 'vitest';
import { scoreMatch, WEIGHTS } from '../../services/recommendation/score.js';

// R1: fixture skor kecocokan talenta ↔ kebutuhan (fungsi murni, waktu acuan tetap).
const NOW = new Date('2026-10-05T12:00:00Z').getTime();
const daysAgo = (d) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

const need = (overrides = {}) => ({
  title: 'Website profil komunitas', description: 'Butuh halaman profil dan galeri kegiatan.',
  category: 'WEBSITE', skills: ['React', 'JavaScript', 'HTML & CSS'], community_id: 7, sector: 'BARAT–UTARA',
  created_at: daysAgo(10), ...overrides,
});
const talent = (overrides = {}) => ({
  skills: ['React', 'JavaScript', 'HTML & CSS'], level: 'TALENTA_MUDA', certified: false,
  completedCategories: [], appliedCategories: [], communityIds: [], sectors: [], activeProjects: 0, ...overrides,
});

describe('scoreMatch (R1)', () => {
  it('cocok penuh: semua keahlian + kategori + komunitas + sektor + kebutuhan baru', () => {
    const r = scoreMatch(
      talent({ skills: ['reactjs', 'JS', 'html css'], completedCategories: ['WEBSITE'], communityIds: [7], sectors: ['BARAT–UTARA'], level: 'TALENTA_AHLI' }),
      need({ created_at: daysAgo(1) }),
      { now: NOW },
    );
    // 50 + 15 + 10 + 5 + 8 (Ahli) + 5 (baru) = 93
    expect(r.score).toBe(93);
    expect(r.matched_skills).toEqual(['React', 'JavaScript', 'HTML & CSS']);
    expect(r.missing_skills).toEqual([]);
    expect(r.confidence).toBe('high');
    expect(r.reasons).toEqual([
      'Menguasai 3 dari 3 keahlian yang dibutuhkan (React, JavaScript, HTML & CSS)',
      'Pernah menyelesaikan proyek kategori Website',
      'Anggota komunitas pemilik kebutuhan ini',
      'Sudah aktif di wilayah yang sama (Barat–Utara)',
      'Level Talenta Ahli',
      'Kebutuhan baru dibuka',
    ]);
  });

  it('cocok sebagian: keahlian yang belum dimiliki dicatat sebagai "bisa dipelajari"', () => {
    const r = scoreMatch(talent({ skills: ['React'], appliedCategories: ['WEBSITE'] }), need(), { now: NOW });
    // 50 × 1/3 ≈ 16,7 + 7 (pernah melamar kategori) + 3 (Muda) + 1 (10 hari) = 27,7 → 28
    expect(r.score).toBe(28);
    expect(r.matched_skills).toEqual(['React']);
    expect(r.missing_skills).toEqual(['JavaScript', 'HTML & CSS']);
    expect(r.confidence).toBe('medium');
    expect(r.reasons).toContain('Pernah melamar proyek kategori Website');
  });

  it('talenta tanpa keahlian: tidak dihitung, dengan petunjuk melengkapi profil', () => {
    const r = scoreMatch(talent({ skills: [] }), need(), { now: NOW });
    expect(r).toMatchObject({ score: 0, confidence: 'none', matched_skills: [], missing_skills: ['React', 'JavaScript', 'HTML & CSS'] });
    expect(r.hint).toMatch(/Lengkapi keahlian/);
  });

  it('cold start: kebutuhan tanpa daftar keahlian dicocokkan lewat judul/deskripsi, keyakinan rendah', () => {
    const r = scoreMatch(
      talent({ skills: ['Excel', 'Google Sheets', 'Figma'] }),
      need({ skills: [], category: 'PENCATATAN', title: 'Rekap data warga', description: 'Data warga di buku tulis mau dipindah ke Google Sheets atau Excel.', created_at: daysAgo(2) }),
      { now: NOW },
    );
    // 35 (2 keahlian disebut; bobot dibatasi karena keyakinan rendah) + 3 (Muda) + 5 (baru) = 43
    expect(r.score).toBe(43);
    expect(r.matched_skills).toEqual(['Excel', 'Google Sheets']);
    expect(r.confidence).toBe('low');
    expect(r.reasons[0]).toBe('Deskripsi kebutuhan menyebut keahlian Anda (Excel, Google Sheets)');
  });

  it('beban kerja tinggi (≥ 2 proyek aktif) mengurangi skor 10 poin', () => {
    const free = scoreMatch(talent(), need(), { now: NOW });
    const busy = scoreMatch(talent({ activeProjects: 2 }), need(), { now: NOW });
    expect(free.score - busy.score).toBe(-WEIGHTS.workload);
    expect(busy.reasons).toContain('Sedang mengerjakan 2 proyek (kapasitas terbatas)');
  });

  it('sertifikasi memberi bonus kecil; bonus reputasi dibatasi 10 dan pemula tetap dapat dasar', () => {
    const muda = scoreMatch(talent(), need(), { now: NOW });
    const certified = scoreMatch(talent({ certified: true }), need(), { now: NOW });
    const ahliCertified = scoreMatch(talent({ level: 'TALENTA_AHLI', certified: true }), need(), { now: NOW });
    expect(certified.score - muda.score).toBe(2);
    expect(certified.reasons).toContain('Tersertifikasi SUSI');
    // 50 + 1 (10 hari) + min(10, 8 + 2) = 61; pemula tanpa sertifikat = 50 + 1 + 3 = 54
    expect(ahliCertified.score).toBe(61);
    expect(muda.score).toBe(54);
  });
});
