-- T2.2: logika verifikasi pindah ke services/projectService.js (completeProject).
-- Procedure lama tidak memeriksa kepemilikan (p_actor_id) dan membuka transaksi
-- sendiri, sehingga dihapus agar tidak ada dua sumber kebenaran.
DROP PROCEDURE IF EXISTS sp_verify_project;
