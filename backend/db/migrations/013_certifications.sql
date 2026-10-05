-- U5: sertifikasi talenta. Talenta dengan proyek COMPLETED ≥ CERT_MIN_PROJECTS mengajukan per bidang
-- dengan proyek bukti miliknya; admin atau AgenSUSI memutus. Satu pengajuan PENDING per talenta dijaga
-- di kode (baris users dikunci FOR UPDATE): kolom generated + UNIQUE tidak bisa dipakai karena talent_id
-- memakai FK ON DELETE CASCADE (lihat catatan migrasi 007). Pengajuan juga tercatat di moderation_items
-- (item_type 'TALENTA', ref_id = id pengajuan) agar tampil di antrean moderasi admin.
CREATE TABLE certification_requests (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  talent_id   BIGINT UNSIGNED NOT NULL,
  -- Kode bidang (services/certification.js: FOCUS_AREAS).
  focus_area  VARCHAR(30) NOT NULL,
  pitch       TEXT NOT NULL,
  status      ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewer_id BIGINT UNSIGNED DEFAULT NULL,
  review_note VARCHAR(1000) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cert_req_talent (talent_id, status),
  KEY idx_cert_req_queue (status, created_at),
  CONSTRAINT fk_cert_req_talent FOREIGN KEY (talent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_req_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proyek bukti: proyek COMPLETED milik talenta yang mengajukan (dicek di kode).
CREATE TABLE certification_request_projects (
  request_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (request_id, project_id),
  KEY fk_cert_proj_project (project_id),
  CONSTRAINT fk_cert_proj_request FOREIGN KEY (request_id) REFERENCES certification_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_proj_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sertifikat yang terbit saat pengajuan disetujui. `code` acak (bukan berurutan) untuk tautan publik
-- /verifikasi/:code dan /sertifikat/:code. Dicabut = revoked_at terisi (data tetap ada untuk verifikasi).
CREATE TABLE certificates (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  talent_id     BIGINT UNSIGNED NOT NULL,
  request_id    BIGINT UNSIGNED NOT NULL,
  code          VARCHAR(20) NOT NULL,
  focus_area    VARCHAR(30) NOT NULL,
  -- Jumlah proyek bukti saat terbit (tampil di sertifikat & halaman verifikasi).
  project_count SMALLINT UNSIGNED NOT NULL,
  issued_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at    DATETIME DEFAULT NULL,
  revoked_by    BIGINT UNSIGNED DEFAULT NULL,
  revoke_reason VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cert_code (code),
  UNIQUE KEY uq_cert_request (request_id),
  KEY idx_cert_talent (talent_id, revoked_at),
  CONSTRAINT fk_cert_talent FOREIGN KEY (talent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_request FOREIGN KEY (request_id) REFERENCES certification_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_revoker FOREIGN KEY (revoked_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
