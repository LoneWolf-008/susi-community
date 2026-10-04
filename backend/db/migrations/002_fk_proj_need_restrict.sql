-- T2.4: menghapus kebutuhan tidak boleh lagi menghapus berantai proyek,
-- pengiriman, dan reputation_events. Kebutuhan ditutup lunak (status CLOSED);
-- FK menjadi pengaman terakhir bila ada DELETE langsung.
ALTER TABLE projects DROP FOREIGN KEY fk_proj_need;

ALTER TABLE projects
  ADD CONSTRAINT fk_proj_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE RESTRICT;
