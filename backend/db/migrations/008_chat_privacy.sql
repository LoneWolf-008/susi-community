-- T15: kontrol privasi Tanya SUSI per pengguna dan dukungan retensi riwayat chat.
--  allows_ai_chat = 0              → pesan tidak pernah dikirim ke penyedia LLM; jawaban dari KB/aturan saja,
--                                    ringkasan eskalasi dibuat tanpa LLM.
--  allows_chat_history_storage = 0 → isi pesan & pertanyaan tidak disimpan (chat_messages berisi penanda,
--                                    ask_logs.question kosong); metadata biaya/kualitas tetap tercatat.
ALTER TABLE user_settings
  ADD COLUMN allows_ai_chat              TINYINT(1) NOT NULL DEFAULT 1 AFTER show_location,
  ADD COLUMN allows_chat_history_storage TINYINT(1) NOT NULL DEFAULT 1 AFTER allows_ai_chat;

-- Job retensi (services/chatbot/retention.js) menghapus/menganonimkan berdasarkan umur.
ALTER TABLE chat_messages ADD KEY idx_chat_messages_created (created_at);
ALTER TABLE chat_sessions ADD KEY idx_chat_sessions_active (last_active_at);
