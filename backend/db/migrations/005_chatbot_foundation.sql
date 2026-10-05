-- T11: fondasi chatbot Tanya SUSI. Memakai ulang kb_entries & ask_logs (keputusan desain #4),
-- menambah sesi & pesan chat. Tabel escalations dibuat di T13 bersama alurnya.

-- ===== kb_entries: metadata untuk retrieval FULLTEXT & filter audiens =====
ALTER TABLE kb_entries
  ADD COLUMN title    VARCHAR(200) DEFAULT NULL AFTER id,
  ADD COLUMN category VARCHAR(50) DEFAULT NULL AFTER title,
  ADD COLUMN audience ENUM('all','public','requester','talent','liaison') NOT NULL DEFAULT 'all' AFTER reply,
  ADD COLUMN status   ENUM('active','draft','archived') NOT NULL DEFAULT 'active' AFTER audience,
  -- Rujukan dokumen asal isi (PRD/Proposal/wawancara/eskalasi); entri tanpa sumber berstatus draft (T12).
  ADD COLUMN source   VARCHAR(255) DEFAULT NULL AFTER status;

-- is_active digantikan status (satu sumber kebenaran).
UPDATE kb_entries SET status = IF(is_active = 1, 'active', 'archived');
ALTER TABLE kb_entries DROP COLUMN is_active;

ALTER TABLE kb_entries ADD KEY idx_kb_status_audience (status, audience);
ALTER TABLE kb_entries ADD FULLTEXT KEY ft_kb_entries (title, keywords, reply);

-- ===== Sesi & pesan chat =====
-- id = UUID acak dari server; sesi anonim (user_id NULL) hanya bisa dibuka dengan id-nya.
CREATE TABLE chat_sessions (
  id             CHAR(36) NOT NULL,
  user_id        BIGINT UNSIGNED DEFAULT NULL,
  role           ENUM('public','requester','talent','liaison','admin') NOT NULL DEFAULT 'public',
  started_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_sessions_user (user_id, last_active_at),
  CONSTRAINT fk_chat_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id CHAR(36) NOT NULL,
  role       ENUM('user','assistant','agent') NOT NULL,
  content    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_messages_session (session_id, id),
  CONSTRAINT fk_chat_message_session FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== ask_logs: satu baris per jawaban asisten, untuk biaya, kualitas, dan umpan balik =====
ALTER TABLE ask_logs
  ADD COLUMN session_id     CHAR(36) DEFAULT NULL AFTER user_id,
  ADD COLUMN message_id     BIGINT UNSIGNED DEFAULT NULL AFTER session_id,
  ADD COLUMN intent         VARCHAR(30) DEFAULT NULL AFTER matched,
  ADD COLUMN kb_entry_id    INT UNSIGNED DEFAULT NULL AFTER intent,
  ADD COLUMN model          VARCHAR(100) DEFAULT NULL AFTER kb_entry_id,
  ADD COLUMN prompt_version VARCHAR(20) DEFAULT NULL AFTER model,
  ADD COLUMN tokens_in      INT UNSIGNED DEFAULT NULL AFTER prompt_version,
  ADD COLUMN tokens_out     INT UNSIGNED DEFAULT NULL AFTER tokens_in,
  ADD COLUMN latency_ms     INT UNSIGNED DEFAULT NULL AFTER tokens_out,
  -- Nama galat bila LLM dicoba tetapi gagal (mis. LLMTimeout) lalu jatuh ke KB; NULL = berhasil / tidak dicoba.
  ADD COLUMN llm_error      VARCHAR(40) DEFAULT NULL AFTER latency_ms,
  ADD COLUMN cost_usd       DECIMAL(12,8) DEFAULT NULL AFTER llm_error,
  ADD COLUMN cache_hit      TINYINT(1) NOT NULL DEFAULT 0 AFTER cost_usd,
  ADD COLUMN escalated      TINYINT(1) NOT NULL DEFAULT 0 AFTER cache_hit,
  -- 1 = membantu (👍), -1 = tidak membantu (👎), NULL = belum dinilai.
  ADD COLUMN feedback       TINYINT DEFAULT NULL AFTER escalated,
  ADD KEY idx_ask_session (session_id),
  ADD KEY idx_ask_message (message_id),
  ADD KEY idx_ask_created (created_at),
  ADD CONSTRAINT fk_ask_session FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ask_message FOREIGN KEY (message_id) REFERENCES chat_messages (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ask_kb FOREIGN KEY (kb_entry_id) REFERENCES kb_entries (id) ON DELETE SET NULL;
