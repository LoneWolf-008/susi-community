-- U1: gabung komunitas khusus talenta dengan persetujuan pengurus, dan masa pajang topik mading.

-- Keanggotaan: permintaan gabung talenta berstatus PENDING sampai diputuskan pengurus komunitas
-- (atau liaison pembuat/admin bila komunitas belum punya pengurus berakun). Baris lama tetap ACTIVE.
ALTER TABLE community_members
  ADD COLUMN status     ENUM('PENDING','ACTIVE','REJECTED') NOT NULL DEFAULT 'ACTIVE' AFTER role_in,
  ADD COLUMN message    VARCHAR(300) DEFAULT NULL AFTER status,
  ADD COLUMN decided_by BIGINT UNSIGNED DEFAULT NULL AFTER message,
  ADD COLUMN decided_at DATETIME DEFAULT NULL AFTER decided_by,
  ADD KEY idx_cm_status (community_id, status),
  ADD CONSTRAINT fk_cm_decider FOREIGN KEY (decided_by) REFERENCES users (id) ON DELETE SET NULL;

-- Notifikasi permintaan gabung & keputusannya.
ALTER TABLE notifications
  MODIFY COLUMN type ENUM('talenta','verifikasi','diskusi','sistem','moderasi','sengketa','kunjungan','intake','eskalasi','komunitas') NOT NULL;

-- Masa pajang topik: NULL = tanpa batas (topik lama); daftar mading hanya menampilkan yang belum lewat.
ALTER TABLE discussion_topics
  ADD COLUMN expires_at DATETIME DEFAULT NULL AFTER created_at,
  ADD KEY idx_topic_expires (expires_at);
