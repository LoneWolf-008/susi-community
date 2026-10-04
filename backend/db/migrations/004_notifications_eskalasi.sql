-- T3.5: tipe notifikasi baru untuk eskalasi chatbot ke AgenSUSI (dipakai T13).
ALTER TABLE notifications
  MODIFY COLUMN type ENUM('talenta','verifikasi','diskusi','sistem','moderasi','sengketa','kunjungan','intake','eskalasi') NOT NULL;
