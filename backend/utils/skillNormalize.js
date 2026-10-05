// Normalisasi nama keahlian (R1). Talenta bisa mengetik keahlian bebas, sehingga "ReactJS", "react",
// dan "React.js" dulu tersimpan sebagai tiga keahlian berbeda dan merusak pencocokan rekomendasi.
//
// Kunci pembanding = huruf kecil tanpa spasi, titik, strip, garis bawah, garis miring, dan "&".
// Rumus yang sama dipakai kolom generated `skills.name_key` (migrasi 010) yang dijaga UNIQUE, dan peta
// alias di bawah disalin ke migrasi 010 untuk menggabungkan duplikat lama: ubah keduanya bersamaan.

export const SKILL_ALIASES = Object.freeze({
  react: 'React', reactjs: 'React',
  javascript: 'JavaScript', js: 'JavaScript', ecmascript: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript',
  nodejs: 'Node.js', node: 'Node.js',
  vue: 'Vue.js', vuejs: 'Vue.js',
  nextjs: 'Next.js',
  html: 'HTML & CSS', css: 'HTML & CSS', htmlcss: 'HTML & CSS', html5: 'HTML & CSS', css3: 'HTML & CSS',
  tailwind: 'Tailwind CSS', tailwindcss: 'Tailwind CSS',
  php: 'PHP', laravel: 'Laravel',
  mysql: 'MySQL', postgresql: 'PostgreSQL', postgres: 'PostgreSQL', mongodb: 'MongoDB', mongo: 'MongoDB',
  python: 'Python', flutter: 'Flutter', kotlin: 'Kotlin',
  wordpress: 'WordPress', wp: 'WordPress',
  excel: 'Excel', msexcel: 'Excel', microsoftexcel: 'Excel',
  googlesheets: 'Google Sheets', googlesheet: 'Google Sheets', gsheets: 'Google Sheets', gsheet: 'Google Sheets',
  googleforms: 'Google Forms', googleform: 'Google Forms', gforms: 'Google Forms', gform: 'Google Forms',
  lookerstudio: 'Looker Studio', googledatastudio: 'Looker Studio', datastudio: 'Looker Studio',
  dataentry: 'Data Entry', inputdata: 'Data Entry',
  figma: 'Figma', canva: 'Canva',
  desainposter: 'Desain Poster', posterdesign: 'Desain Poster',
  uiux: 'UI/UX', uidesign: 'UI/UX', uxdesign: 'UI/UX',
});

/** Kunci pembanding: "React.js" → "reactjs", "HTML & CSS" → "htmlcss". */
export const skillKey = (name) => String(name ?? '').normalize('NFKC').toLowerCase().replace(/[\s.\-_/&]+/g, '');

/**
 * Nama baku untuk disimpan/ditampilkan: alias dikenal → nama resminya, selain itu spasi dirapikan.
 * "  reactjs " → "React", "google   sheet" → "Google Sheets", "Pemasaran Digital" → "Pemasaran Digital".
 */
export function normalizeSkill(name) {
  const clean = String(name ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '');
  if (!clean) return '';
  return SKILL_ALIASES[skillKey(clean)] ?? clean;
}

/**
 * Id keahlian untuk nama bebas: dipakai bila kuncinya sudah ada (mis. "reactjs" → baris "React"),
 * selain itu dibuat dengan nama baku. `conn` harus koneksi/pool mysql2.
 */
export async function findOrCreateSkill(conn, name) {
  const canonical = normalizeSkill(name);
  if (!canonical) return null;
  const key = skillKey(canonical);
  const [found] = await conn.query(`SELECT id FROM skills WHERE name_key = ? LIMIT 1`, [key]);
  if (found[0]) return found[0].id;
  await conn.query(`INSERT IGNORE INTO skills (name) VALUES (?)`, [canonical]);
  const [[row]] = await conn.query(`SELECT id FROM skills WHERE name_key = ? LIMIT 1`, [key]);
  return row.id;
}
