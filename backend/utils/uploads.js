// Aturan berkas hasil kerja (deliveries), dipakai route unggah, submitDelivery, dan unduh.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Ekstensi → mimetype yang diterima. Browser di Windows sering melaporkan arsip
// sebagai application/octet-stream, jadi itu hanya diterima untuk zip/rar.
export const ALLOWED_UPLOADS = Object.freeze({
  '.zip': ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'application/octet-stream'],
  '.rar': ['application/vnd.rar', 'application/x-rar-compressed', 'application/x-rar', 'application/octet-stream'],
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.txt': ['text/plain'],
  '.mp4': ['video/mp4'],
  '.mov': ['video/quicktime'],
});

export const DELIVERY_URL_PREFIX = '/uploads/deliveries/';
// Hanya nama yang dihasilkan generateDeliveryFilename() (tidak bisa merujuk path lain).
export const DELIVERY_FILENAME_RE = /^delivery-\d{13}-\d{1,10}\.(zip|rar|pdf|png|jpe?g|docx?|txt|mp4|mov)$/i;

export function isAllowedUpload(originalname, mimetype) {
  const ext = path.extname(String(originalname || '')).toLowerCase();
  const mimes = ALLOWED_UPLOADS[ext];
  return Boolean(mimes) && mimes.includes(String(mimetype || '').toLowerCase());
}

export function generateDeliveryFilename(originalname) {
  const ext = path.extname(String(originalname || '')).toLowerCase();
  return `delivery-${Date.now()}-${crypto.randomInt(1_000_000_000)}${ext}`;
}

export const deliveryFilePath = (filename) => `${DELIVERY_URL_PREFIX}${filename}`;

/** @returns {string|null} nama berkas bila file_path berformat sah, selain itu null */
export function parseDeliveryFilePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.startsWith(DELIVERY_URL_PREFIX)) return null;
  const filename = filePath.slice(DELIVERY_URL_PREFIX.length);
  return DELIVERY_FILENAME_RE.test(filename) ? filename : null;
}

export const deliveryAbsolutePath = (filename) => path.join(env.deliveriesDir, path.basename(filename));

export async function removeDeliveryFile(filename) {
  try {
    await fs.unlink(deliveryAbsolutePath(filename));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
