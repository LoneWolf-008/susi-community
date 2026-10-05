import { pool } from '../config/db.js';
import { success, fail } from '../utils/response.js';
import { invalidateRecommendations } from '../services/recommendation/index.js';

export const getMySettings = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM user_settings WHERE user_id = ?`,
      [req.user.id]
    );
    if (!rows[0]) {
      await pool.query(`INSERT INTO user_settings (user_id) VALUES (?)`, [req.user.id]);
      const [fresh] = await pool.query(`SELECT * FROM user_settings WHERE user_id = ?`, [req.user.id]);
      return success(res, fresh[0]);
    }
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
};

export const updateMySettings = async (req, res, next) => {
  try {
    const allowed = [
      'notif_email', 'notif_whatsapp', 'notif_talenta', 'notif_diskusi', 'show_location',
      'allows_ai_chat', 'allows_chat_history_storage', 'allows_ai_personalization', 'show_in_recommendations',
    ];
    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key] ? 1 : 0);
      }
    }

    if (fields.length === 0) {
      return fail(res, 'Tidak ada pengaturan yang diubah', 400);
    }

    values.push(req.user.id);
    await pool.query(
      `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );
    // Talenta keluar/masuk daftar rekomendasi: hasil yang tersimpan milik pemilik kebutuhan mana pun usang.
    if (req.body.show_in_recommendations !== undefined) invalidateRecommendations();

    const [rows] = await pool.query(`SELECT * FROM user_settings WHERE user_id = ?`, [req.user.id]);
    return success(res, rows[0], 'Pengaturan diperbarui');
  } catch (err) {
    next(err);
  }
};