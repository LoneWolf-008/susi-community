-- R3: persetujuan personalisasi Tanya SUSI. Bila 0, chatbot tidak membaca profil, keahlian, atau
-- rekomendasi pengguna dan menjawab secara umum (selaras dengan toggle privasi T15).
ALTER TABLE user_settings
  ADD COLUMN allows_ai_personalization TINYINT(1) NOT NULL DEFAULT 1 AFTER allows_chat_history_storage;
