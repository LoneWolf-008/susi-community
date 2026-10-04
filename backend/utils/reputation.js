// Satu-satunya tempat ambang level reputasi talenta.
// Poin = jumlah reputation_events.delta (+1 per proyek terverifikasi).

export const LEVEL_THRESHOLDS = Object.freeze({
  TALENTA_TERPERCAYA: 20,
  TALENTA_AHLI: 50,
});

/**
 * @param {number} points
 * @returns {{ level: 'TALENTA_MUDA'|'TALENTA_TERPERCAYA'|'TALENTA_AHLI', next_level_target: number }}
 */
export function computeLevel(points) {
  if (points < LEVEL_THRESHOLDS.TALENTA_TERPERCAYA) {
    return { level: 'TALENTA_MUDA', next_level_target: LEVEL_THRESHOLDS.TALENTA_TERPERCAYA };
  }
  if (points < LEVEL_THRESHOLDS.TALENTA_AHLI) {
    return { level: 'TALENTA_TERPERCAYA', next_level_target: LEVEL_THRESHOLDS.TALENTA_AHLI };
  }
  // Level tertinggi: target = poin saat ini (perilaku lama sp_verify_project).
  return { level: 'TALENTA_AHLI', next_level_target: points };
}

/**
 * Menyamakan talent_profiles dengan isi reputation_events untuk talenta tertentu.
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number[]} talentIds
 */
export async function recomputeReputation(conn, talentIds) {
  for (const talentId of talentIds) {
    const [[{ points }]] = await conn.query(
      `SELECT COALESCE(SUM(delta), 0) AS points FROM reputation_events WHERE talent_id = ?`,
      [talentId],
    );
    const total = Math.max(0, Number(points));
    const { level, next_level_target } = computeLevel(total);
    await conn.query(
      `UPDATE talent_profiles SET reputation_points = ?, level = ?, next_level_target = ?
       WHERE user_id = ?`,
      [total, level, next_level_target, talentId],
    );
  }
}
