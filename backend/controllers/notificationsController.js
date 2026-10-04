import { pool } from '../config/db.js';
import { success, fail } from '../utils/response.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const { limit = 20, unread_only } = req.query;
    let where = `WHERE user_id = ?`;
    const params = [req.user.id];

    if (unread_only === 'true') {
      where += ` AND is_read = 0`;
    }

    const [rows] = await pool.query(
      `SELECT * FROM notifications ${where}
       ORDER BY created_at DESC LIMIT ?`,
      [...params, +limit]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const [[{ count }]] = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    return success(res, { count });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    return success(res, null, 'Notifikasi ditandai dibaca');
  } catch (err) {
    next(err);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    return success(res, null, 'Semua notifikasi ditandai dibaca');
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    return success(res, null, 'Notifikasi dihapus');
  } catch (err) {
    next(err);
  }
};