import { describe, it, expect } from 'vitest';
import {
  normalizeText, canonical, deslang, stripSuffix, queryTerms, expandForSearch, canonicalText, intentText, isStopword,
} from '../../services/chatbot/text.js';

describe('Normalisasi Bahasa Indonesia (T12.2.4)', () => {
  it('huruf kecil, tanda baca hilang, spasi dirapatkan, frasa slang digabung', () => {
    expect(normalizeText('  Gimana   Cara LOG IN di SUSI?!  ')).toBe('gimana cara login di susi');
    expect(normalizeText('Nomor WhatsApp-nya (sign up) agen susi')).toBe('nomor whatsapp nya signup agensusi');
    expect(normalizeText('Terima kasih ya')).toBe('terimakasih ya');
  });

  it('slang & sinonim umum → bentuk baku', () => {
    expect(canonical('gmn')).toBe('bagaimana');
    expect(canonical('gw')).toBe('saya');
    expect(canonical('project')).toBe('proyek');
    expect(canonical('regis')).toBe('daftar');
    expect(canonical('apply')).toBe('lamar');
    expect(canonical('wa')).toBe('whatsapp');
    expect(canonical('gratis')).toBe('biaya');
    expect(canonical('kata-asing')).toBe('kata-asing');
  });

  it('deslang hanya membakukan slang, istilah domain apa adanya (untuk intent)', () => {
    expect(deslang('gw')).toBe('saya');
    expect(deslang('melamar')).toBe('melamar');
    expect(canonical('melamar')).toBe('lamar');
    expect(intentText('Gmn status lamaran gw?')).toBe('bagaimana status lamaran saya');
    expect(canonicalText('Gmn status project gw?')).toBe('bagaimana status proyek saya');
  });

  it('sufiks -nya/-ku/-mu dilepas hanya bila sisanya ≥ 4 huruf', () => {
    expect(stripSuffix('proyeknya')).toBe('proyek');
    expect(stripSuffix('akunku')).toBe('akun');
    expect(stripSuffix('proyekmu')).toBe('proyek');
    for (const word of ['tanya', 'punya', 'hanya', 'buku', 'kamu', 'ilmu']) expect(stripSuffix(word)).toBe(word);
  });

  it('kata isi pertanyaan = grup varian tanpa kata tanya/fungsi', () => {
    const terms = queryTerms('gmn cara regis jd talent dong kak?');
    expect(terms.map((t) => t.word)).toEqual(['regis', 'talent']);
    expect(terms[0].variants).toEqual(expect.arrayContaining(['regis', 'daftar']));
    expect(terms[1].variants).toEqual(expect.arrayContaining(['talent', 'talenta']));
    expect(queryTerms('gimana caranya dong?')).toEqual([]);
    expect(queryTerms('biayanya')).toEqual([{ word: 'biayanya', variants: ['biayanya', 'biaya'] }]);
  });

  it('kueri FULLTEXT memuat kata asli + bentuk baku kata isi, tanpa bentuk baku kata fungsi', () => {
    const words = expandForSearch('gmn cara apply project?').split(' ');
    expect(words).toEqual(expect.arrayContaining(['gmn', 'cara', 'apply', 'project', 'lamar', 'proyek']));
    expect(words).not.toContain('bagaimana');
  });

  it('daftar kata henti mencakup bentuk baku slang', () => {
    expect(isStopword('gimana')).toBe(true);
    expect(isStopword('gw')).toBe(true);
    expect(isStopword('daftar')).toBe(false);
  });
});
