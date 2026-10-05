-- T13: eskalasi percakapan Tanya SUSI ke AgenSUSI (liaison).
-- Satu tiket terbuka (pending/assigned) per sesi dijaga di kode dengan mengunci baris sesi
-- (SELECT … FOR UPDATE). Kolom generated + UNIQUE seperti migrasi 003 tidak bisa dipakai di sini:
-- MySQL melarang FK ON DELETE CASCADE pada kolom dasar kolom generated.
CREATE TABLE escalations (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id       CHAR(36) NOT NULL,
  user_id          BIGINT UNSIGNED DEFAULT NULL,
  -- Kontak dari pengguna agar bisa dihubungi balik (wajib untuk anonim). Hanya untuk liaison/admin;
  -- tidak pernah dikirim ke LLM.
  contact          VARCHAR(150) DEFAULT NULL,
  -- Sinyal pemicu dipisah koma (mis. explicit_request,complaint) dan total skornya.
  reason           VARCHAR(120) NOT NULL,
  score            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  priority         ENUM('normal','high') NOT NULL DEFAULT 'normal',
  summary          TEXT NOT NULL,
  summary_source   ENUM('llm','rule') NOT NULL DEFAULT 'rule',
  summary_model    VARCHAR(100) DEFAULT NULL,
  -- Biaya ringkasan LLM; ikut dihitung ke anggaran harian chatbot.
  summary_cost_usd DECIMAL(12,8) DEFAULT NULL,
  status           ENUM('pending','assigned','resolved','closed') NOT NULL DEFAULT 'pending',
  assigned_to      BIGINT UNSIGNED DEFAULT NULL,
  resolution       TEXT DEFAULT NULL,
  -- Draft KB yang dibuat dari penyelesaian (ditinjau admin sebelum aktif).
  kb_entry_id      INT UNSIGNED DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_at      DATETIME DEFAULT NULL,
  resolved_at      DATETIME DEFAULT NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_esc_status (status, created_at),
  KEY idx_esc_session (session_id, status),
  KEY idx_esc_assignee (assigned_to, status),
  CONSTRAINT fk_esc_session FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_esc_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_esc_assignee FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_esc_kb FOREIGN KEY (kb_entry_id) REFERENCES kb_entries (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
