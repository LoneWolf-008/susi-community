-- =====================================================================
-- SUSI Community — skema baseline
--
-- Diturunkan dari dump phpMyAdmin `susi_community.sql` (MariaDB 10.4) dengan
-- pembersihan: tanpa DEFINER, tanpa tabel stand-in view (`v_*`), ENGINE dan
-- charset eksplisit di setiap tabel, tanpa header/footer phpMyAdmin.
-- Kompatibel dengan MySQL 8.0 dan MariaDB 10.4+.
--
-- Berkas ini HANYA dijalankan pada database kosong lewat `npm run db:init`.
-- Perubahan skema berikutnya WAJIB lewat file baru di db/migrations/.
--
-- Catatan rekonstruksi: dump menghilangkan CHECK tingkat tabel pada
-- `moderation_items` dan `project_deliveries` (keduanya tercetak tanpa ENGINE).
-- Dua CHECK di bawah (chk_mod_reject_reason, chk_pd_content) disusun ulang
-- dari aturan yang sudah ditegakkan controller.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Pengguna & autentikasi
-- ---------------------------------------------------------------------

CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('requester','talent','liaison','admin') NOT NULL,
  status        ENUM('AKTIF','DITANGGUHKAN') NOT NULL DEFAULT 'AKTIF',
  phone         VARCHAR(30) DEFAULT NULL,
  bio           TEXT DEFAULT NULL,
  extra_info    VARCHAR(150) DEFAULT NULL,
  avatar_url    VARCHAR(255) DEFAULT NULL,
  last_login_at DATETIME DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  user_agent  VARCHAR(255) DEFAULT NULL,
  ip_address  VARCHAR(45) DEFAULT NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME DEFAULT NULL,
  replaced_by BIGINT UNSIGNED DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_hash (token_hash),
  KEY idx_rt_user (user_id, revoked_at),
  KEY idx_rt_expires (expires_at),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE oauth_accounts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  provider     VARCHAR(30) NOT NULL,
  provider_uid VARCHAR(150) NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth (provider, provider_uid),
  KEY fk_oa_user (user_id),
  CONSTRAINT fk_oa_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_settings (
  user_id        BIGINT UNSIGNED NOT NULL,
  notif_email    TINYINT(1) NOT NULL DEFAULT 1,
  notif_whatsapp TINYINT(1) NOT NULL DEFAULT 0,
  notif_talenta  TINYINT(1) NOT NULL DEFAULT 1,
  notif_diskusi  TINYINT(1) NOT NULL DEFAULT 1,
  show_location  TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE talent_profiles (
  user_id           BIGINT UNSIGNED NOT NULL,
  reputation_points INT UNSIGNED NOT NULL DEFAULT 0,
  level             ENUM('TALENTA_MUDA','TALENTA_TERPERCAYA','TALENTA_AHLI') NOT NULL DEFAULT 'TALENTA_MUDA',
  next_level_target INT UNSIGNED NOT NULL DEFAULT 20,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE liaison_profiles (
  user_id             BIGINT UNSIGNED NOT NULL,
  target_visits_month SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  target_intake_month SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_lp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE skills (
  id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_skill_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE talent_skills (
  talent_id BIGINT UNSIGNED NOT NULL,
  skill_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (talent_id, skill_id),
  KEY fk_ts_skill (skill_id),
  CONSTRAINT fk_ts_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE,
  CONSTRAINT fk_ts_user FOREIGN KEY (talent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Komunitas
-- Sektor dihitung dari titik pusat Kota Bandung (lng 107.6191, lat -6.9175).
-- ---------------------------------------------------------------------

CREATE TABLE communities (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(150) NOT NULL,
  type           ENUM('KELUARGA','PEMUDA','HOBI','UMKM','PKK','RT/RW','KARANG TARUNA','LAINNYA') NOT NULL DEFAULT 'LAINNYA',
  description    TEXT DEFAULT NULL,
  leader_name    VARCHAR(120) DEFAULT NULL,
  leader_role    VARCHAR(80) DEFAULT NULL,
  members_count  INT UNSIGNED NOT NULL DEFAULT 0,
  established_at VARCHAR(20) DEFAULT NULL,
  whatsapp       VARCHAR(30) DEFAULT NULL,
  address        VARCHAR(255) DEFAULT NULL,
  lat            DECIMAL(9,6) DEFAULT NULL,
  lng            DECIMAL(9,6) DEFAULT NULL,
  sector         VARCHAR(20) GENERATED ALWAYS AS (
                   CASE WHEN lat IS NULL OR lng IS NULL THEN NULL
                   ELSE CONCAT(IF(lng < 107.6191, 'BARAT', 'TIMUR'), '–', IF(lat > -6.9175, 'UTARA', 'SELATAN'))
                   END) STORED,
  source         ENUM('MANDIRI','AGENSUSI') NOT NULL DEFAULT 'MANDIRI',
  created_by     BIGINT UNSIGNED DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comm_sector (sector),
  KEY idx_comm_creator (created_by),
  CONSTRAINT fk_comm_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_members (
  community_id BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  role_in      ENUM('PENGURUS','ANGGOTA') NOT NULL DEFAULT 'PENGURUS',
  joined_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (community_id, user_id),
  KEY fk_cm_user (user_id),
  CONSTRAINT fk_cm_comm FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Kebutuhan, lamaran, proyek
-- ---------------------------------------------------------------------

CREATE TABLE needs (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  community_id      BIGINT UNSIGNED DEFAULT NULL,
  requester_id      BIGINT UNSIGNED DEFAULT NULL,
  created_by        BIGINT UNSIGNED DEFAULT NULL,
  title             VARCHAR(200) NOT NULL,
  category          ENUM('PENCATATAN','WEBSITE','APLIKASI','LAINNYA') NOT NULL DEFAULT 'LAINNYA',
  summary           VARCHAR(300) DEFAULT NULL,
  description       TEXT NOT NULL,
  address           VARCHAR(255) DEFAULT NULL,
  lat               DECIMAL(9,6) DEFAULT NULL,
  lng               DECIMAL(9,6) DEFAULT NULL,
  sector            VARCHAR(20) GENERATED ALWAYS AS (
                      CASE WHEN lat IS NULL OR lng IS NULL THEN NULL
                      ELSE CONCAT(IF(lng < 107.6191, 'BARAT', 'TIMUR'), '–', IF(lat > -6.9175, 'UTARA', 'SELATAN'))
                      END) STORED,
  source            ENUM('MANDIRI','AGENSUSI') NOT NULL DEFAULT 'MANDIRI',
  moderation_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reject_reason     ENUM('SPAM','DUPLIKAT','SALAH KATEGORI','TIDAK LAYAK') DEFAULT NULL,
  risk_level        ENUM('RENDAH','SEDANG','TINGGI') NOT NULL DEFAULT 'RENDAH',
  status            ENUM('OPEN','IN_PROGRESS','COMPLETED','CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_needs_catalog (moderation_status, status, category),
  KEY idx_needs_requester (requester_id),
  KEY idx_needs_comm (community_id),
  KEY idx_needs_sector (sector),
  KEY fk_needs_creator (created_by),
  CONSTRAINT fk_needs_comm FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_needs_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_needs_requester FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE need_skills (
  need_id  BIGINT UNSIGNED NOT NULL,
  skill_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (need_id, skill_id),
  KEY fk_ns_skill (skill_id),
  CONSTRAINT fk_ns_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE CASCADE,
  CONSTRAINT fk_ns_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE applications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  need_id    BIGINT UNSIGNED NOT NULL,
  talent_id  BIGINT UNSIGNED NOT NULL,
  message    TEXT DEFAULT NULL,
  status     ENUM('MENUNGGU','DITERIMA','DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app (need_id, talent_id),
  KEY idx_app_talent (talent_id, status),
  CONSTRAINT fk_app_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE CASCADE,
  CONSTRAINT fk_app_talent FOREIGN KEY (talent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE projects (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  need_id                BIGINT UNSIGNED NOT NULL,
  community_id           BIGINT UNSIGNED DEFAULT NULL,
  requester_id           BIGINT UNSIGNED DEFAULT NULL,
  talent_id              BIGINT UNSIGNED NOT NULL,
  application_id         BIGINT UNSIGNED DEFAULT NULL,
  scope                  TEXT NOT NULL,
  done_definition        TEXT DEFAULT NULL,
  deadline               DATE DEFAULT NULL,
  status                 ENUM('AGREEMENT','IN_PROGRESS','AWAITING_VERIFICATION','REVISION','COMPLETED','DISPUTED','CANCELLED') NOT NULL DEFAULT 'AGREEMENT',
  progress_pct           TINYINT UNSIGNED NOT NULL DEFAULT 0,
  agreed_by_talent_at    DATETIME DEFAULT NULL,
  agreed_by_community_at DATETIME DEFAULT NULL,
  started_at             DATETIME DEFAULT NULL,
  talent_marked_done_at  DATETIME DEFAULT NULL,
  community_verified_at  DATETIME DEFAULT NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_need (need_id),
  KEY idx_proj_talent (talent_id, status),
  KEY idx_proj_requester (requester_id),
  KEY fk_proj_comm (community_id),
  KEY fk_proj_app (application_id),
  CONSTRAINT fk_proj_app FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE SET NULL,
  CONSTRAINT fk_proj_comm FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_proj_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE CASCADE,
  CONSTRAINT fk_proj_requester FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_proj_talent FOREIGN KEY (talent_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_deliveries (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id   BIGINT UNSIGNED NOT NULL,
  round_no     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  file_name    VARCHAR(255) DEFAULT NULL,
  file_path    VARCHAR(500) DEFAULT NULL,
  file_size    BIGINT UNSIGNED DEFAULT NULL,
  link_url     VARCHAR(500) DEFAULT NULL,
  delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_round (project_id, round_no),
  CONSTRAINT fk_pd_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  -- Rekonstruksi: setiap pengiriman harus berisi berkas atau tautan.
  CONSTRAINT chk_pd_content CHECK (file_path IS NOT NULL OR link_url IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  actor_id   BIGINT UNSIGNED DEFAULT NULL,
  event_type VARCHAR(40) NOT NULL,
  label      VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pe_project (project_id, created_at),
  KEY fk_pe_actor (actor_id),
  CONSTRAINT fk_pe_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_pe_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_revisions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id   BIGINT UNSIGNED NOT NULL,
  delivery_id  BIGINT UNSIGNED DEFAULT NULL,
  note         TEXT NOT NULL,
  requested_by BIGINT UNSIGNED DEFAULT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_pr_project (project_id),
  KEY fk_pr_delivery (delivery_id),
  KEY fk_pr_user (requested_by),
  CONSTRAINT fk_pr_delivery FOREIGN KEY (delivery_id) REFERENCES project_deliveries (id) ON DELETE SET NULL,
  CONSTRAINT fk_pr_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_user FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Reputasi & testimoni
-- ---------------------------------------------------------------------

CREATE TABLE reputation_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  talent_id  BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  delta      SMALLINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rep_project (project_id),
  KEY idx_rep_talent (talent_id),
  CONSTRAINT fk_re_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_re_talent FOREIGN KEY (talent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE testimonials (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id        BIGINT UNSIGNED NOT NULL,
  from_user_id      BIGINT UNSIGNED NOT NULL,
  to_user_id        BIGINT UNSIGNED NOT NULL,
  text              TEXT NOT NULL,
  is_public         TINYINT(1) NOT NULL DEFAULT 1,
  moderation_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'APPROVED',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_testi (project_id, from_user_id),
  KEY idx_testi_to (to_user_id),
  KEY fk_t_from (from_user_id),
  CONSTRAINT fk_t_from FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_t_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_t_to FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sengketa
-- ---------------------------------------------------------------------

CREATE TABLE disputes (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id          BIGINT UNSIGNED NOT NULL,
  status              ENUM('MEDIASI','ESKALASI','SELESAI') NOT NULL DEFAULT 'MEDIASI',
  summary             TEXT NOT NULL,
  statement_community TEXT DEFAULT NULL,
  statement_talent    TEXT DEFAULT NULL,
  decision            ENUM('MARK_COMPLETE','EXTEND_7_DAYS') DEFAULT NULL,
  decided_by          BIGINT UNSIGNED DEFAULT NULL,
  decided_at          DATETIME DEFAULT NULL,
  opened_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_disp_status (status),
  KEY fk_disp_project (project_id),
  KEY fk_disp_admin (decided_by),
  CONSTRAINT fk_disp_admin FOREIGN KEY (decided_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_disp_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dispute_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispute_id BIGINT UNSIGNED NOT NULL,
  label      VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_de_dispute (dispute_id, created_at),
  CONSTRAINT fk_de_dispute FOREIGN KEY (dispute_id) REFERENCES disputes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Moderasi & administrasi
-- ---------------------------------------------------------------------

CREATE TABLE moderation_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_type          ENUM('KEBUTUHAN','TALENTA','TESTIMONI','PENGADUAN') NOT NULL,
  ref_id             BIGINT UNSIGNED NOT NULL,
  title              VARCHAR(200) NOT NULL,
  submitted_by       BIGINT UNSIGNED DEFAULT NULL,
  source             ENUM('MANDIRI','AGENSUSI') NOT NULL DEFAULT 'MANDIRI',
  risk_level         ENUM('RENDAH','SEDANG','TINGGI') NOT NULL DEFAULT 'RENDAH',
  checklist_layak    TINYINT(1) NOT NULL DEFAULT 0,
  checklist_kategori TINYINT(1) NOT NULL DEFAULT 0,
  decision           ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reject_reason      ENUM('SPAM','DUPLIKAT','SALAH KATEGORI','TIDAK LAYAK') DEFAULT NULL,
  reviewed_by        BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at        DATETIME DEFAULT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mod_queue (decision, item_type),
  KEY idx_mod_ref (item_type, ref_id),
  KEY fk_mod_submitter (submitted_by),
  KEY fk_mod_reviewer (reviewed_by),
  CONSTRAINT fk_mod_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_mod_submitter FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL,
  -- Rekonstruksi: penolakan wajib menyertakan alasan.
  CONSTRAINT chk_mod_reject_reason CHECK (decision <> 'REJECTED' OR reject_reason IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_messages (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id   BIGINT UNSIGNED NOT NULL,
  target_type ENUM('USER','DISPUTE','LIAISON') NOT NULL,
  target_id   BIGINT UNSIGNED NOT NULL,
  body        TEXT NOT NULL,
  sent_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_am_target (target_type, target_id),
  KEY fk_am_sender (sender_id),
  CONSTRAINT fk_am_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id   BIGINT UNSIGNED DEFAULT NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(40) NOT NULL,
  entity_id  BIGINT UNSIGNED DEFAULT NULL,
  title      VARCHAR(200) DEFAULT NULL,
  subtitle   VARCHAR(255) DEFAULT NULL,
  -- LONGTEXT + json_valid (bukan tipe JSON) agar MySQL dan MariaDB
  -- sama-sama mengembalikan string ke driver.
  meta       LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(meta)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_entity (entity, entity_id),
  KEY fk_audit_actor (actor_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  type       ENUM('talenta','verifikasi','diskusi','sistem','moderasi','sengketa','kunjungan','intake') NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(255) DEFAULT NULL,
  ref_type   VARCHAR(40) DEFAULT NULL,
  ref_id     BIGINT UNSIGNED DEFAULT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Liaison (AgenSUSI)
-- ---------------------------------------------------------------------

CREATE TABLE liaison_visits (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  liaison_id     BIGINT UNSIGNED NOT NULL,
  community_id   BIGINT UNSIGNED DEFAULT NULL,
  community_name VARCHAR(150) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME DEFAULT NULL,
  address        VARCHAR(255) DEFAULT NULL,
  lat            DECIMAL(9,6) DEFAULT NULL,
  lng            DECIMAL(9,6) DEFAULT NULL,
  sector         VARCHAR(20) GENERATED ALWAYS AS (
                   CASE WHEN lat IS NULL OR lng IS NULL THEN NULL
                   ELSE CONCAT(IF(lng < 107.6191, 'BARAT', 'TIMUR'), '–', IF(lat > -6.9175, 'UTARA', 'SELATAN'))
                   END) STORED,
  status         ENUM('DIRENCANAKAN','BERLANGSUNG','TERDATA') NOT NULL DEFAULT 'DIRENCANAKAN',
  note           TEXT DEFAULT NULL,
  contact_person VARCHAR(120) DEFAULT NULL,
  need_id        BIGINT UNSIGNED DEFAULT NULL,
  started_at     DATETIME DEFAULT NULL,
  finished_at    DATETIME DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_visit_liaison_date (liaison_id, scheduled_date),
  KEY idx_visit_status (status),
  KEY fk_lv_comm (community_id),
  KEY fk_lv_need (need_id),
  CONSTRAINT fk_lv_comm FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_lv_liaison FOREIGN KEY (liaison_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_lv_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Mading (diskusi)
-- ---------------------------------------------------------------------

CREATE TABLE discussion_topics (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id    BIGINT UNSIGNED NOT NULL,
  community_id BIGINT UNSIGNED DEFAULT NULL,
  category     ENUM('DISKUSI','TANYA','INFO') NOT NULL DEFAULT 'DISKUSI',
  text         TEXT NOT NULL,
  pos_x        SMALLINT NOT NULL DEFAULT 100,
  pos_y        SMALLINT NOT NULL DEFAULT 100,
  rotation     TINYINT NOT NULL DEFAULT 0,
  color        CHAR(7) NOT NULL DEFAULT '#fdfcf7',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_topic_created (created_at),
  KEY fk_topic_author (author_id),
  KEY fk_topic_comm (community_id),
  CONSTRAINT fk_topic_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_topic_comm FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discussion_replies (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  topic_id     BIGINT UNSIGNED NOT NULL,
  author_id    BIGINT UNSIGNED NOT NULL,
  community_id BIGINT UNSIGNED DEFAULT NULL,
  text         TEXT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reply_topic (topic_id, created_at),
  KEY fk_reply_author (author_id),
  KEY fk_reply_comm (community_id),
  CONSTRAINT fk_reply_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_comm FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_reply_topic FOREIGN KEY (topic_id) REFERENCES discussion_topics (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tanya SUSI (chatbot) & statistik
-- ---------------------------------------------------------------------

CREATE TABLE kb_entries (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  keywords   VARCHAR(500) NOT NULL,
  reply      TEXT NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ask_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED DEFAULT NULL,
  question   VARCHAR(500) NOT NULL,
  matched    TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ask_unmatched (matched, created_at),
  KEY fk_ask_user (user_id),
  CONSTRAINT fk_ask_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_stats (
  stat_date DATE NOT NULL,
  visits    INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW v_need_catalog AS
SELECT n.id, n.title, n.category, n.summary, n.description, n.address,
       n.lat, n.lng, n.sector, n.created_at,
       c.name AS community_name, c.leader_name, c.members_count,
       (SELECT COUNT(*) FROM applications a WHERE a.need_id = n.id) AS applicants
FROM needs n
LEFT JOIN communities c ON c.id = n.community_id
WHERE n.moderation_status = 'APPROVED' AND n.status = 'OPEN';

CREATE OR REPLACE VIEW v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM projects WHERE status = 'COMPLETED') AS projects_completed,
  (SELECT COUNT(*) FROM projects WHERE status IN ('IN_PROGRESS','AWAITING_VERIFICATION','REVISION')) AS projects_running,
  (SELECT COUNT(*) FROM users WHERE role = 'talent' AND deleted_at IS NULL) AS talents_total,
  (SELECT COUNT(*) FROM communities) AS communities_total,
  (SELECT COUNT(*) FROM users WHERE status = 'AKTIF' AND deleted_at IS NULL) AS users_active,
  (SELECT COUNT(*) FROM needs WHERE moderation_status = 'APPROVED' AND status = 'OPEN') AS needs_queue,
  (SELECT COUNT(*) FROM moderation_items WHERE decision = 'PENDING') AS moderation_pending,
  (SELECT COUNT(*) FROM disputes WHERE status <> 'SELESAI') AS disputes_open;

CREATE OR REPLACE VIEW v_top_talents AS
SELECT u.id, u.name, tp.reputation_points, tp.level,
       (SELECT COUNT(*) FROM projects p WHERE p.talent_id = u.id AND p.status = 'COMPLETED') AS projects_completed
FROM users u
JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.deleted_at IS NULL AND u.status = 'AKTIF'
ORDER BY tp.reputation_points DESC;

-- ---------------------------------------------------------------------
-- Stored procedure (dipertahankan dari dump; dijadwalkan dihapus lewat
-- migrasi di T2 setelah logika verifikasi pindah ke services/projectService.js)
-- ---------------------------------------------------------------------

DELIMITER $$

CREATE PROCEDURE sp_verify_project (
  IN p_project_id  BIGINT UNSIGNED,
  IN p_actor_id    BIGINT UNSIGNED,
  IN p_testimonial TEXT
)
BEGIN
  DECLARE v_status ENUM('AGREEMENT','IN_PROGRESS','AWAITING_VERIFICATION','REVISION','COMPLETED','DISPUTED','CANCELLED');
  DECLARE v_talent BIGINT UNSIGNED;
  DECLARE v_need   BIGINT UNSIGNED;
  DECLARE v_req    BIGINT UNSIGNED;
  DECLARE v_points INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status, talent_id, need_id, requester_id
    INTO v_status, v_talent, v_need, v_req
  FROM projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF v_status <> 'AWAITING_VERIFICATION' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Proyek belum ditandai selesai oleh talenta';
  END IF;

  UPDATE projects
  SET status = 'COMPLETED', progress_pct = 100, community_verified_at = NOW()
  WHERE id = p_project_id;

  UPDATE needs SET status = 'COMPLETED' WHERE id = v_need;

  -- unique(project_id) menjamin poin tidak dobel
  INSERT INTO reputation_events (talent_id, project_id, delta)
  VALUES (v_talent, p_project_id, 1);

  UPDATE talent_profiles
  SET reputation_points = reputation_points + 1
  WHERE user_id = v_talent;

  SELECT reputation_points INTO v_points
  FROM talent_profiles
  WHERE user_id = v_talent;

  UPDATE talent_profiles
  SET level = CASE
                WHEN v_points < 20 THEN 'TALENTA_MUDA'
                WHEN v_points < 50 THEN 'TALENTA_TERPERCAYA'
                ELSE 'TALENTA_AHLI'
              END,
      next_level_target = CASE
                WHEN v_points < 20 THEN 20
                WHEN v_points < 50 THEN 50
                ELSE v_points
              END
  WHERE user_id = v_talent;

  IF p_testimonial IS NOT NULL AND CHAR_LENGTH(TRIM(p_testimonial)) > 0 THEN
    INSERT INTO testimonials (project_id, from_user_id, to_user_id, text)
    VALUES (p_project_id, p_actor_id, v_talent, TRIM(p_testimonial));
  END IF;

  INSERT INTO project_events (project_id, actor_id, event_type, label)
  VALUES (p_project_id, p_actor_id, 'VERIFIED', 'Komunitas telah memverifikasi');

  INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
  VALUES (v_talent, 'verifikasi', 'Proyek diverifikasi, reputasi +1',
          'Komunitas mengonfirmasi proyek Anda', 'project', p_project_id);

  COMMIT;
END$$

DELIMITER ;
