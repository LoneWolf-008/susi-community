import { describe, it, expect } from 'vitest';
import { validateEnv } from '../../config/env.js';

const base = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_NAME: 'susi',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  FRONTEND_URL: 'http://localhost:5173',
};

describe('validateEnv (regresi T0: start tanpa secret harus gagal)', () => {
  it('menerima konfigurasi lengkap', () => {
    expect(validateEnv(base)).toEqual([]);
  });

  it('menolak JWT_ACCESS_SECRET kosong atau hanya spasi', () => {
    expect(validateEnv({ ...base, JWT_ACCESS_SECRET: undefined })).toContain('JWT_ACCESS_SECRET wajib diisi');
    expect(validateEnv({ ...base, JWT_ACCESS_SECRET: '   ' })).toContain('JWT_ACCESS_SECRET wajib diisi');
  });

  it('melaporkan semua variabel wajib yang hilang sekaligus', () => {
    const errors = validateEnv({});
    for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL']) {
      expect(errors).toContain(`${key} wajib diisi`);
    }
  });

  it('menolak secret access dan refresh yang sama', () => {
    expect(validateEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET }))
      .toContain('JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET harus berbeda');
  });

  it('di production: secret minimal 32 karakter dan DB_PASSWORD wajib', () => {
    const errors = validateEnv({ ...base, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'pendek', DB_PASSWORD: '' });
    expect(errors).toContain('JWT_ACCESS_SECRET minimal 32 karakter di production');
    expect(errors).toContain('DB_PASSWORD wajib diisi di production');
  });

  it('DB_PASSWORD boleh kosong di development', () => {
    expect(validateEnv({ ...base, DB_PASSWORD: '' })).toEqual([]);
  });

  it('menolak DB_PORT bukan angka', () => {
    expect(validateEnv({ ...base, DB_PORT: 'abc' })).toContain('DB_PORT harus berupa angka');
  });

  it('chatbot (T11): variabel LLM opsional, tetapi nilai yang diisi harus valid', () => {
    // Tanpa key/provider sama sekali tetap valid: chatbot menjawab dari KB.
    expect(validateEnv({ ...base, OPENROUTER_API_KEY: '' })).toEqual([]);
    expect(validateEnv({
      ...base, LLM_PROVIDER: 'OpenRouter', OPENROUTER_DATA_COLLECTION: 'deny', OPENROUTER_REASONING_EFFORT: 'low',
      OPENROUTER_TIMEOUT_MS: '12000', CHATBOT_MAX_TOKENS: '350', CHATBOT_DAILY_BUDGET_USD: '0.5',
    })).toEqual([]);
    expect(validateEnv({
      ...base, LLM_PROVIDER: 'openai', OPENROUTER_DATA_COLLECTION: 'maybe', OPENROUTER_REASONING_EFFORT: 'turbo',
      OPENROUTER_TIMEOUT_MS: '12s', CHATBOT_MAX_TOKENS: '-1', CHATBOT_DAILY_BUDGET_USD: 'gratis',
    })).toEqual([
      'LLM_PROVIDER harus salah satu dari: openrouter, mock',
      'OPENROUTER_DATA_COLLECTION harus salah satu dari: allow, deny',
      'OPENROUTER_REASONING_EFFORT harus salah satu dari: none, minimal, low, medium, high',
      'OPENROUTER_TIMEOUT_MS harus bilangan bulat positif',
      'CHATBOT_MAX_TOKENS harus bilangan bulat positif',
      'CHATBOT_DAILY_BUDGET_USD harus angka ≥ 0',
    ]);
  });
});
