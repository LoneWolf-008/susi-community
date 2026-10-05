-- U6: Ruang AgenSUSI. Selama tiket terbuka, percakapan dialihkan ke AgenSUSI (AI dijeda), pengguna
-- bisa membatalkan dan kembali ke AI, AgenSUSI bisa mengembalikan percakapan ke AI, dan pengguna
-- menilai bantuan setelah selesai. Status pengguna (`handoff`) diturunkan dari kolom-kolom ini.
ALTER TABLE escalations
  -- cancelled = pengguna kembali ke asisten AI sebelum tiket diselesaikan.
  MODIFY COLUMN status ENUM('pending','assigned','resolved','closed','cancelled') NOT NULL DEFAULT 'pending',
  -- Pesan pertama bagian AgenSUSI (konfirmasi tiket). Pesan sebelumnya = bagian AI di transkrip.
  ADD COLUMN handoff_message_id BIGINT UNSIGNED DEFAULT NULL AFTER kb_entry_id,
  -- 1 = diselesaikan lewat "Kembalikan ke AI", bukan dijawab tuntas oleh AgenSUSI.
  ADD COLUMN handed_back TINYINT(1) NOT NULL DEFAULT 0 AFTER resolution,
  -- Id pesan terakhir yang sudah dilihat pengguna / AgenSUSI (lencana belum dibaca).
  ADD COLUMN user_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER handoff_message_id,
  ADD COLUMN agent_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER user_read_id,
  -- Penilaian pengguna 1–5 setelah selesai (opsional).
  ADD COLUMN rating TINYINT UNSIGNED DEFAULT NULL AFTER agent_read_id,
  -- Pengguna sudah menutup bagian AgenSUSI (menilai, melewati penilaian, atau bertanya lagi ke AI).
  ADD COLUMN user_done_at DATETIME DEFAULT NULL AFTER resolved_at;

-- Tiket lama: bagian AgenSUSI dimulai dari pesan pertama sejak tiket dibuat; semuanya dianggap
-- sudah dibaca dan sudah ditutup pengguna agar tidak memunculkan lencana atau penilaian lama.
UPDATE escalations e
SET e.handoff_message_id = (
      SELECT MIN(m.id) FROM chat_messages m WHERE m.session_id = e.session_id AND m.created_at >= e.created_at
    ),
    e.user_read_id = COALESCE((SELECT MAX(m.id) FROM chat_messages m WHERE m.session_id = e.session_id), 0),
    e.agent_read_id = COALESCE((SELECT MAX(m.id) FROM chat_messages m WHERE m.session_id = e.session_id), 0),
    e.user_done_at = IF(e.status IN ('resolved', 'closed'), COALESCE(e.resolved_at, NOW()), NULL);
