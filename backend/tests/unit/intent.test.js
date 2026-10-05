import { describe, it, expect } from 'vitest';
import { classifyIntent, dataTopics, smalltalkKind, isFollowUp, hasDomainTerms } from '../../services/chatbot/intent.js';

const intentOf = (text) => classifyIntent(text).intent;

describe('Intent berbasis kata kunci (T12.2.2)', () => {
  it.each([
    ['halo kak', 'smalltalk'],
    ['makasih ya min', 'smalltalk'],
    ['selamat pagi, mau tanya', 'smalltalk'],
    ['apa kabar?', 'smalltalk'],
    ['gimana cara daftar jadi talenta?', 'howto'],
    ['di mana menu verifikasi?', 'howto'],
    ['berapa biaya pakai susi?', 'faq'],
    ['apa itu agensusi', 'faq'],
    ['status proyek saya gimana?', 'status_data'],
    ['lamaranku udah diterima belum', 'status_data'],
    ['berapa poin reputasi gw', 'status_data'],
    ['kebutuhan saya kok belum tayang', 'status_data'],
    ['saya mau bicara dengan agen susi', 'escalation_request'],
    ['tolong sambungkan ke admin', 'escalation_request'],
    ['bisa minta bantuan agensusi?', 'escalation_request'],
    ['saya mau ngobrol sama orang asli, bukan bot', 'escalation_request'],
    ['talentanya kabur, saya kecewa', 'complaint'],
    ['webnya error terus', 'complaint'],
  ])('"%s" → %s', (text, intent) => {
    expect(intentOf(text)).toBe(intent);
  });

  it('bukan data pribadi: menjelaskan kebutuhan, atau kata kerja "melamar" (bukan "lamaran saya")', () => {
    expect(intentOf('kebutuhan saya adalah website untuk toko')).not.toBe('status_data');
    expect(intentOf('kebutuhan saya website untuk warung')).not.toBe('status_data');
    expect(intentOf('gimana cara melamar saya bingung')).not.toBe('status_data');
    expect(intentOf('apa yang terjadi kalau saya mundur dari proyek')).not.toBe('status_data');
  });

  it('bukan eskalasi: bertanya tentang AgenSUSI atau ingin menjadi agen', () => {
    expect(intentOf('apa itu agensusi')).toBe('faq');
    expect(intentOf('bisa jadi agen?')).not.toBe('escalation_request');
  });

  it('topik data pribadi; kosong = ringkasan sesuai peran', () => {
    expect(dataTopics('status proyek saya')).toEqual(['projects']);
    expect(dataTopics('lamaranku gimana')).toEqual(['applications']);
    expect(dataTopics('notif saya ada berapa')).toEqual(['notifications']);
    expect(dataTopics('berapa poin reputasi saya')).toEqual(['reputation']);
    expect(dataTopics('status saya')).toEqual([]);
    expect(dataTopics('cara daftar')).toBeNull();
  });

  it('nada keluhan ditandai terpisah dari intent utama (sinyal eskalasi T13)', () => {
    const r = classifyIntent('proyek saya kok lambat banget, kecewa');
    expect(r.intent).toBe('status_data');
    expect(r.negative).toBe(true);
    expect(classifyIntent('cara daftar').negative).toBe(false);
  });

  it('jenis basa-basi', () => {
    expect(smalltalkKind('halo')).toBe('greeting');
    expect(smalltalkKind('oke makasih kak')).toBe('thanks');
    expect(smalltalkKind('sampai jumpa')).toBe('bye');
    expect(smalltalkKind('sip')).toBe('ack');
    expect(smalltalkKind('halo, cara daftar gimana?')).toBeNull();
    expect(smalltalkKind('')).toBeNull();
  });

  it('pesan lanjutan: tanpa kata isi, atau satu kata isi + penanda lanjutan', () => {
    expect(isFollowUp('terus apa lagi?')).toBe(true);
    expect(isFollowUp('kalau talenta?')).toBe(true);
    expect(isFollowUp('maksudnya gimana?')).toBe(true);
    expect(isFollowUp('biaya?')).toBe(false);
    expect(isFollowUp('apakah talenta juga dapat testimoni?')).toBe(false);
  });

  it('istilah SUSI membedakan "belum tahu" dari "di luar topik"', () => {
    expect(hasDomainTerms('apakah bisa bikin game di aplikasi susi?')).toBe(true);
    expect(hasDomainTerms('proyeknya kenapa')).toBe(true);
    expect(hasDomainTerms('resep nasi goreng')).toBe(false);
    expect(hasDomainTerms('siapa presiden indonesia')).toBe(false);
  });
});
