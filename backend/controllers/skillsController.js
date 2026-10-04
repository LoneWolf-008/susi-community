import { pool } from '../config/db.js';
import { success } from '../utils/response.js';

// Data referensi kecil untuk pilihan keahlian di form (kebutuhan & profil talenta).
// Tidak dipaginasi; dibatasi 200 baris sebagai pengaman.
const MAX_SKILLS = 200;

export const listSkills = async (req, res, next) => {
  try {
    const { search } = req.query;
    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE name LIKE ?';
      params.push(`%${search}%`);
    }
    const [rows] = await pool.query(
      `SELECT id, name FROM skills ${where} ORDER BY name ASC LIMIT ?`,
      [...params, MAX_SKILLS]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};
