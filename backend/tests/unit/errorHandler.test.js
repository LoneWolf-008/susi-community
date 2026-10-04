import { describe, it, expect, vi, afterEach } from 'vitest';
import multer from 'multer';
import { createErrorHandler } from '../../middleware/errorHandler.js';
import { HttpError } from '../../utils/httpError.js';

function run(handler, err) {
  const res = {
    headersSent: false,
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  handler(err, { method: 'GET', originalUrl: '/api/x' }, res, () => {});
  return res;
}

describe('errorHandler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('production: 5xx tidak membocorkan err.message (regresi T2.6)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createErrorHandler({ isProduction: true });
    const err = new Error("Duplicate entry 'rahasia@contoh.test' for key 'uq_users_email'");
    const res = run(handler, err);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Terjadi kesalahan server' } });
    // Log production tidak memuat isi pesan (bisa berisi data pribadi).
    expect(console.error.mock.calls.flat().join(' ')).not.toContain('rahasia@contoh.test');
  });

  it('development: 5xx menampilkan pesan asli', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = run(createErrorHandler({ isProduction: false }), new Error('boom'));
    expect(res.body.error.message).toBe('boom');
  });

  it('4xx dari HttpError diteruskan apa adanya, juga di production', () => {
    const res = run(createErrorHandler({ isProduction: true }), new HttpError(409, 'Sudah diputus'));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: { message: 'Sudah diputus' } });
  });

  it('development: 4xx tidak membawa stack (format tetap { error: { message } })', () => {
    const res = run(createErrorHandler({ isProduction: false, exposeStack: true }), new HttpError(400, 'Tidak valid'));
    expect(res.body).toEqual({ error: { message: 'Tidak valid' } });
  });

  it('development: 5xx boleh membawa stack untuk debugging', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = run(createErrorHandler({ isProduction: false, exposeStack: true }), new Error('boom'));
    expect(res.body.error.stack).toMatch(/boom/);
  });

  it('error multer ukuran file → 413', () => {
    const res = run(createErrorHandler({ isProduction: true }), new multer.MulterError('LIMIT_FILE_SIZE'));
    expect(res.statusCode).toBe(413);
    expect(res.body.error.message).toMatch(/25 MB/);
  });

  it('JSON rusak → 400', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
    const res = run(createErrorHandler({ isProduction: true }), err);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Format JSON tidak valid');
  });
});
