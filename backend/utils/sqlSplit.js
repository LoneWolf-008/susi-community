// Memecah berkas SQL menjadi pernyataan tunggal agar bisa dijalankan satu per satu
// lewat mysql2 (tanpa multipleStatements) dengan pesan error yang menunjuk pernyataan.
//
// Mendukung direktif DELIMITER gaya klien `mysql` (untuk stored procedure), string
// '...' "..." `...` (escape backslash dan kutip ganda), serta komentar -- # /* */.

const DELIMITER_RE = /^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*\r?$/i;

const isLineCommentStart = (sql, i) => {
  if (sql[i] === '#') return true;
  // MySQL mewajibkan spasi/kontrol setelah "--"
  return sql[i] === '-' && sql[i + 1] === '-' && (i + 2 >= sql.length || /\s/.test(sql[i + 2]));
};

/**
 * @param {string} sql
 * @returns {string[]} pernyataan tanpa delimiter penutup; komentar dibuang
 */
export function splitSqlStatements(sql) {
  const statements = [];
  const len = sql.length;
  let delimiter = ';';
  let current = '';
  let atLineStart = true;
  let i = 0;

  const flush = () => {
    const stmt = current.trim();
    if (stmt) statements.push(stmt);
    current = '';
  };

  while (i < len) {
    if (atLineStart) {
      atLineStart = false;
      const lineEnd = sql.indexOf('\n', i);
      const line = sql.slice(i, lineEnd === -1 ? len : lineEnd);
      const match = DELIMITER_RE.exec(line);
      if (match) {
        flush();
        delimiter = match[1];
        i = lineEnd === -1 ? len : lineEnd + 1;
        atLineStart = true;
        continue;
      }
    }

    const ch = sql[i];

    if (isLineCommentStart(sql, i)) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? len : end; // newline diproses di iterasi berikut
      continue;
    }

    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) throw new Error('Komentar blok /* tidak ditutup');
      current += ' ';
      i = end + 2;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '\\' && ch !== '`') {
          j += 2;
          continue;
        }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      if (j >= len) throw new Error(`String ${ch} tidak ditutup`);
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (sql.startsWith(delimiter, i)) {
      flush();
      i += delimiter.length;
      continue;
    }

    if (ch === '\n') atLineStart = true;
    current += ch;
    i += 1;
  }

  flush();
  return statements;
}
