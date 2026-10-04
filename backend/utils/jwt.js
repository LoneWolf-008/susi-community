import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

// Tanpa fallback: env.js sudah menghentikan proses bila secret kosong.
const ACCESS_SECRET = env.jwt.accessSecret;
const REFRESH_SECRET = env.jwt.refreshSecret;
const ACCESS_EXPIRES = env.jwt.accessExpires;
const REFRESH_EXPIRES = env.jwt.refreshExpires;

export const signAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
};

export const signRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const saveRefreshToken = async (userId, token, userAgent, ipAddress) => {
  const tokenHash = hashToken(token);
  const decoded = verifyRefreshToken(token);
  const expiresAt = new Date(decoded.exp * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, userAgent, ipAddress, expiresAt]
  );
};

export const revokeRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?`,
    [tokenHash]
  );
};

export const revokeAllUserTokens = async (userId) => {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );
};

export const findValidRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  const [rows] = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
};

export const rotateRefreshToken = async (oldToken, userId, userAgent, ipAddress) => {
  // Revoke token lama
  const oldHash = hashToken(oldToken);
  const [oldRows] = await pool.query(
    `SELECT id FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
    [oldHash]
  );
  const oldId = oldRows[0]?.id;

  await revokeRefreshToken(oldToken);

  // Buat token baru
  const newToken = signRefreshToken({ userId });
  const newHash = hashToken(newToken);
  const decoded = verifyRefreshToken(newToken);
  const expiresAt = new Date(decoded.exp * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at, replaced_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, newHash, userAgent, ipAddress, expiresAt, oldId]
  );

  return newToken;
};