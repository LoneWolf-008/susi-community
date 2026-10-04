import multer from 'multer';
import { env } from '../config/env.js';

const MAX_UPLOAD_MB = 25;

// Error dari library yang sebenarnya kesalahan klien → status + pesan yang ramah.
function normalize(err) {
  if (err.type === 'entity.parse.failed') return { status: 400, message: 'Format JSON tidak valid' };
  if (err.type === 'entity.too.large') return { status: 413, message: 'Ukuran data terlalu besar' };
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return { status: 413, message: `Ukuran file maksimal ${MAX_UPLOAD_MB} MB` };
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return { status: 400, message: 'Field file tidak dikenal (gunakan "file")' };
    return { status: 400, message: 'Unggahan file tidak valid' };
  }
  const status = Number(err.status || err.statusCode) || 500;
  return { status: status >= 400 && status < 600 ? status : 500, message: err.message };
}

/**
 * @param {{ isProduction: boolean, exposeStack?: boolean }} options
 */
export const createErrorHandler = ({ isProduction, exposeStack = false }) =>
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const { status, message } = normalize(err);
    const isServerError = status >= 500;

    if (isServerError) {
      if (isProduction) {
        // Jangan log err.message mentah: pesan SQL bisa memuat data pengguna (mis. email duplikat).
        const frames = (err.stack || '').split('\n').slice(1, 6).join('\n');
        console.error(`[error] ${req.method} ${req.originalUrl} status=${status} code=${err.code || '-'}\n${frames}`);
      } else {
        console.error('[error]', err);
      }
    }

    const body = {
      error: {
        message: isServerError && isProduction ? 'Terjadi kesalahan server' : message || 'Terjadi kesalahan server',
      },
    };
    if (!isServerError && err.details) body.error.details = err.details;
    // Stack hanya untuk error server di development; 4xx tetap { error: { message } }.
    if (exposeStack && !isProduction && isServerError) body.error.stack = err.stack;

    res.status(status).json(body);
  };

export const errorHandler = createErrorHandler({
  isProduction: env.isProduction,
  exposeStack: env.nodeEnv === 'development',
});
