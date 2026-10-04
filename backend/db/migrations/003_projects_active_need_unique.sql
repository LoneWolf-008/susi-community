-- T3.2: satu kebutuhan boleh punya proyek baru setelah proyek sebelumnya CANCELLED
-- (talenta mundur → kebutuhan kembali TERBUKA). Unik hanya untuk proyek yang tidak dibatalkan.
--
-- KEY biasa ditambah DULU karena FK fk_proj_need membutuhkan indeks pada need_id
-- setelah uq_project_need dihapus. Kolom generated ini bergantung pada need_id, yang
-- hanya diizinkan karena 002 sudah mengubah fk_proj_need menjadi RESTRICT.
ALTER TABLE projects ADD KEY idx_proj_need (need_id);

ALTER TABLE projects DROP INDEX uq_project_need;

ALTER TABLE projects
  ADD COLUMN active_need_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (IF(status = 'CANCELLED', NULL, need_id)) STORED,
  ADD UNIQUE KEY uq_project_active_need (active_need_id);
