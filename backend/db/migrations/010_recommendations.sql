-- R1: mesin rekomendasi — normalisasi keahlian, undangan melamar, dan pilihan tampil di rekomendasi.

-- ===== 1) Gabungkan keahlian duplikat =====
-- Kunci = huruf kecil tanpa spasi/titik/strip/garis bawah/garis miring/"&" (skillKey di
-- utils/skillNormalize.js). Alias di bawah salinan SKILL_ALIASES: ubah keduanya bersamaan.
CREATE TEMPORARY TABLE tmp_skill_alias (
  alias_key VARCHAR(60) NOT NULL PRIMARY KEY,
  canonical VARCHAR(60) NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_skill_alias (alias_key, canonical) VALUES
  ('react', 'React'),
  ('reactjs', 'React'),
  ('javascript', 'JavaScript'),
  ('js', 'JavaScript'),
  ('ecmascript', 'JavaScript'),
  ('typescript', 'TypeScript'),
  ('ts', 'TypeScript'),
  ('nodejs', 'Node.js'),
  ('node', 'Node.js'),
  ('vue', 'Vue.js'),
  ('vuejs', 'Vue.js'),
  ('nextjs', 'Next.js'),
  ('html', 'HTML & CSS'),
  ('css', 'HTML & CSS'),
  ('htmlcss', 'HTML & CSS'),
  ('html5', 'HTML & CSS'),
  ('css3', 'HTML & CSS'),
  ('tailwind', 'Tailwind CSS'),
  ('tailwindcss', 'Tailwind CSS'),
  ('php', 'PHP'),
  ('laravel', 'Laravel'),
  ('mysql', 'MySQL'),
  ('postgresql', 'PostgreSQL'),
  ('postgres', 'PostgreSQL'),
  ('mongodb', 'MongoDB'),
  ('mongo', 'MongoDB'),
  ('python', 'Python'),
  ('flutter', 'Flutter'),
  ('kotlin', 'Kotlin'),
  ('wordpress', 'WordPress'),
  ('wp', 'WordPress'),
  ('excel', 'Excel'),
  ('msexcel', 'Excel'),
  ('microsoftexcel', 'Excel'),
  ('googlesheets', 'Google Sheets'),
  ('googlesheet', 'Google Sheets'),
  ('gsheets', 'Google Sheets'),
  ('gsheet', 'Google Sheets'),
  ('googleforms', 'Google Forms'),
  ('googleform', 'Google Forms'),
  ('gforms', 'Google Forms'),
  ('gform', 'Google Forms'),
  ('lookerstudio', 'Looker Studio'),
  ('googledatastudio', 'Looker Studio'),
  ('datastudio', 'Looker Studio'),
  ('dataentry', 'Data Entry'),
  ('inputdata', 'Data Entry'),
  ('figma', 'Figma'),
  ('canva', 'Canva'),
  ('desainposter', 'Desain Poster'),
  ('posterdesign', 'Desain Poster'),
  ('uiux', 'UI/UX'),
  ('uidesign', 'UI/UX'),
  ('uxdesign', 'UI/UX');

-- Nama baku & kunci baku tiap keahlian.
CREATE TEMPORARY TABLE tmp_skill_map (
  id        INT UNSIGNED NOT NULL PRIMARY KEY,
  canonical VARCHAR(60) NOT NULL,
  ckey      VARCHAR(60) NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_skill_map (id, canonical, ckey)
  SELECT s.id, COALESCE(a.canonical, TRIM(s.name)),
         LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(a.canonical, s.name), ' ', ''), '.', ''), '-', ''), '_', ''), '/', ''), '&', ''))
  FROM skills s
  LEFT JOIN tmp_skill_alias a
    ON a.alias_key = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.name, ' ', ''), '.', ''), '-', ''), '_', ''), '/', ''), '&', ''));

-- Pemenang tiap kunci baku: id terkecil (keahlian paling lama), dengan nama bakunya.
CREATE TEMPORARY TABLE tmp_skill_keep (
  ckey      VARCHAR(60) NOT NULL PRIMARY KEY,
  keep_id   INT UNSIGNED NOT NULL,
  canonical VARCHAR(60) DEFAULT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_skill_keep (ckey, keep_id) SELECT ckey, MIN(id) FROM tmp_skill_map GROUP BY ckey;
UPDATE tmp_skill_keep k JOIN tmp_skill_map m ON m.id = k.keep_id SET k.canonical = m.canonical;

-- Pindahkan relasi ke pemenang, lalu hapus duplikat (baris relasi lamanya ikut terhapus lewat CASCADE).
INSERT IGNORE INTO talent_skills (talent_id, skill_id)
  SELECT ts.talent_id, k.keep_id
  FROM talent_skills ts JOIN tmp_skill_map m ON m.id = ts.skill_id JOIN tmp_skill_keep k ON k.ckey = m.ckey
  WHERE ts.skill_id <> k.keep_id;

INSERT IGNORE INTO need_skills (need_id, skill_id)
  SELECT ns.need_id, k.keep_id
  FROM need_skills ns JOIN tmp_skill_map m ON m.id = ns.skill_id JOIN tmp_skill_keep k ON k.ckey = m.ckey
  WHERE ns.skill_id <> k.keep_id;

DELETE s FROM skills s
  JOIN tmp_skill_map m ON m.id = s.id
  JOIN tmp_skill_keep k ON k.ckey = m.ckey
  WHERE s.id <> k.keep_id;

UPDATE skills s JOIN tmp_skill_keep k ON k.keep_id = s.id
  SET s.name = k.canonical
  WHERE BINARY s.name <> BINARY k.canonical;

DROP TEMPORARY TABLE tmp_skill_keep;
DROP TEMPORARY TABLE tmp_skill_map;
DROP TEMPORARY TABLE tmp_skill_alias;

-- Kunci baku dijaga UNIQUE agar "React.js" dan "ReactJS" tidak bisa tersimpan berdua lagi.
ALTER TABLE skills
  ADD COLUMN name_key VARCHAR(60) GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, ' ', ''), '.', ''), '-', ''), '_', ''), '/', ''), '&', ''))
  ) STORED,
  ADD UNIQUE KEY uq_skill_key (name_key);

-- ===== 2) Undangan melamar =====
-- Pemilik kebutuhan mengundang talenta yang bersedia tampil di rekomendasi; talenta tetap memutuskan
-- sendiri dengan melamar (undangan menjadi ACCEPTED saat ia melamar). Maksimal 5 per kebutuhan (kode).
CREATE TABLE need_invites (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  need_id    BIGINT UNSIGNED NOT NULL,
  talent_id  BIGINT UNSIGNED NOT NULL,
  invited_by BIGINT UNSIGNED DEFAULT NULL,
  status     ENUM('SENT','ACCEPTED') NOT NULL DEFAULT 'SENT',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invite (need_id, talent_id),
  KEY idx_invite_talent (talent_id, status),
  CONSTRAINT fk_invite_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE CASCADE,
  CONSTRAINT fk_invite_talent FOREIGN KEY (talent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_invite_by FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 3) Pilihan talenta tampil di rekomendasi untuk pemilik kebutuhan (bawaan ya) =====
ALTER TABLE user_settings
  ADD COLUMN show_in_recommendations TINYINT(1) NOT NULL DEFAULT 1 AFTER allows_chat_history_storage;
