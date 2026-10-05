-- T12: isi KB bersumber dokumen (backend/db/seeds/kb.json).
-- slug = kunci stabil entri seed, agar seed tetap idempoten walau judul/isi entri diubah admin.
ALTER TABLE kb_entries
  ADD COLUMN slug VARCHAR(80) DEFAULT NULL AFTER id,
  ADD UNIQUE KEY uq_kb_slug (slug);

-- Aturan isi KB: entri tanpa sumber berstatus draft (tidak dipakai chatbot) sampai ditinjau admin.
-- Yang terkena hanya entri lama hasil pindahan KB frontend (T1); entri baru dari kb.json bersumber.
UPDATE kb_entries SET status = 'draft' WHERE source IS NULL AND status = 'active';
