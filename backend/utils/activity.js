// Pencatat notifikasi, event proyek, dan audit log. Semua menerima `conn` agar ikut
// transaksi pemanggil (pool juga bisa dipakai untuk penulisan di luar transaksi).

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} conn
 * @param {{ userId: number|null, type: string, title: string, body?: string|null, refType?: string|null, refId?: number|null }} n
 */
// Tipe notifikasi yang bisa dimatikan pengguna lewat PATCH /settings (kolom user_settings).
const PREFERENCE_BY_TYPE = Object.freeze({ talenta: 'notif_talenta', diskusi: 'notif_diskusi' });

export async function notify(conn, { userId, type, title, body = null, refType = null, refId = null }) {
  if (!userId) return;
  const preference = PREFERENCE_BY_TYPE[type];
  if (preference) {
    // Nama kolom berasal dari peta tetap di atas, bukan dari input.
    const [[settings]] = await conn.query(`SELECT ${preference} AS enabled FROM user_settings WHERE user_id = ?`, [userId]);
    if (settings && !settings.enabled) return;
  }
  await conn.query(
    `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, body ? String(body).slice(0, 255) : null, refType, refId],
  );
}

export async function addProjectEvent(conn, { projectId, actorId, eventType, label }) {
  await conn.query(
    `INSERT INTO project_events (project_id, actor_id, event_type, label) VALUES (?, ?, ?, ?)`,
    [projectId, actorId ?? null, eventType, String(label).slice(0, 255)],
  );
}

export async function audit(conn, { actorId, action, entity, entityId = null, title = null, meta = null }) {
  await conn.query(
    `INSERT INTO audit_logs (actor_id, action, entity, entity_id, title, meta) VALUES (?, ?, ?, ?, ?, ?)`,
    [actorId ?? null, action, entity, entityId, title ? String(title).slice(0, 200) : null,
      meta === null ? null : JSON.stringify(meta)],
  );
}
