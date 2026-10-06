import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { success, created, fail } from '../utils/response.js';
import {
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  findValidRefreshToken,
  rotateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

const REFRESH_COOKIE = 'susi_refresh_token';
const SELF_REGISTER_ROLES = ['requester', 'talent'];

// SameSite & Secure dari COOKIE_SAMESITE (config/env.js); atribut yang sama dipakai saat menghapus
// agar peramban mau menimpa cookie SameSite=None.
const cookieOptions = () => ({ httpOnly: true, secure: env.cookie.secure, sameSite: env.cookie.sameSite, path: '/' });

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
};

const buildUserPayload = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  phone: u.phone,
  bio: u.bio,
  extra_info: u.extra_info,
  avatar_url: u.avatar_url,
});

export const register = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { email, password, role, name, extra_info } = req.body;

    if (![email, password, role, name].every((v) => typeof v === 'string' && v.trim())) {
      await conn.rollback();
      return fail(res, 'Email, password, role, dan nama wajib diisi', 400);
    }

    // Pendaftaran mandiri hanya untuk komunitas dan talenta; akun liaison dibuat admin
    // lewat POST /api/admin/liaisons.
    if (!SELF_REGISTER_ROLES.includes(role)) {
      await conn.rollback();
      return fail(res, 'Peran tidak valid. Pilih komunitas (requester) atau talenta.', 400);
    }

    if (password.length < 10) {
      await conn.rollback();
      return fail(res, 'Password minimal 10 karakter', 400);
    }

    const [existing] = await conn.query(
      `SELECT id FROM users WHERE email = ?`,
      [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return fail(res, 'Email sudah terdaftar', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await conn.query(
      `INSERT INTO users (name, email, password_hash, role, extra_info)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role, extra_info || null]
    );

    const userId = result.insertId;

    // Buat profil tambahan sesuai role
    if (role === 'talent') {
      await conn.query(
        `INSERT INTO talent_profiles (user_id) VALUES (?)`,
        [userId]
      );
    }

    // Default user settings
    await conn.query(
      `INSERT INTO user_settings (user_id) VALUES (?)`,
      [userId]
    );

    const [users] = await conn.query(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );

    await conn.commit();

    const user = users[0];
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    await saveRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    setRefreshCookie(res, refreshToken);

    await conn.query(
      `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
      [user.id]
    );

    return created(res, {
      user: buildUserPayload(user),
      accessToken,
    }, 'Registrasi berhasil');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return fail(res, 'Email dan password wajib diisi', 400);
    }

    const [users] = await pool.query(
      `SELECT * FROM users WHERE email = ? AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return fail(res, 'Email atau password salah', 401);
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return fail(res, 'Email atau password salah', 401);
    }

    if (user.status !== 'AKTIF') {
      return fail(res, 'Akun Anda ditangguhkan', 403);
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    await saveRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    setRefreshCookie(res, refreshToken);

    await pool.query(
      `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
      [user.id]
    );

    return success(res, {
      user: buildUserPayload(user),
      accessToken,
    }, 'Login berhasil');
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      await revokeRefreshToken(token);
    }
    clearRefreshCookie(res);
    return success(res, null, 'Logout berhasil');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) {
      return fail(res, 'Refresh token tidak ditemukan', 401);
    }

    const stored = await findValidRefreshToken(token);
    if (!stored) {
      clearRefreshCookie(res);
      return fail(res, 'Refresh token tidak valid atau sudah kedaluwarsa', 401);
    }

    const decoded = verifyRefreshToken(token);

    // Kolom sama dengan payload login, agar profil lengkap tetap ada setelah reload.
    const [users] = await pool.query(
      `SELECT id, name, email, role, status, phone, bio, extra_info, avatar_url
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [decoded.userId]
    );

    if (!users[0] || users[0].status !== 'AKTIF') {
      clearRefreshCookie(res);
      return fail(res, 'User tidak valid', 401);
    }

    const user = users[0];
    const newRefreshToken = await rotateRefreshToken(
      token,
      user.id,
      req.headers['user-agent'],
      req.ip
    );
    const newAccessToken = signAccessToken({ userId: user.id, role: user.role });

    setRefreshCookie(res, newRefreshToken);

    return success(res, {
      user: buildUserPayload(user),
      accessToken: newAccessToken,
    });
  } catch (err) {
    clearRefreshCookie(res);
    return fail(res, 'Refresh token tidak valid', 401);
  }
};

export const me = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`,
      [req.user.id]
    );
    if (!users[0]) {
      return fail(res, 'User tidak ditemukan', 404);
    }
    return success(res, { user: buildUserPayload(users[0]) });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const { name, phone, bio, extra_info, avatar_url } = req.body;
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
    if (extra_info !== undefined) { fields.push('extra_info = ?'); values.push(extra_info); }
    if (avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(avatar_url); }

    if (fields.length === 0) {
      return fail(res, 'Tidak ada data yang diubah', 400);
    }

    values.push(req.user.id);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const [users] = await pool.query(
      `SELECT * FROM users WHERE id = ?`,
      [req.user.id]
    );

    return success(res, { user: buildUserPayload(users[0]) }, 'Profil diperbarui');
  } catch (err) {
    next(err);
  }
};