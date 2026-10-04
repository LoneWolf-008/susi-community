import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { splitSqlStatements } from '../../utils/sqlSplit.js';
import { BACKEND_DIR } from '../../config/env.js';

describe('splitSqlStatements', () => {
  it('memecah per titik koma dan membuang komentar', () => {
    const sql = `-- komentar; tidak dihitung\nSELECT 1;\n# komentar hash;\nSELECT 2; /* blok; */ SELECT 3;`;
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1', 'SELECT 2', 'SELECT 3']);
  });

  it('tidak memecah titik koma di dalam string dan identifier', () => {
    const sql = `SELECT 'a;b', "c;d", \`e;f\`; SELECT 'it''s; ok'; SELECT 'x\\';y';`;
    expect(splitSqlStatements(sql)).toEqual([
      `SELECT 'a;b', "c;d", \`e;f\``,
      `SELECT 'it''s; ok'`,
      `SELECT 'x\\';y'`,
    ]);
  });

  it('mendukung DELIMITER untuk stored procedure', () => {
    const sql = 'DELIMITER $$\nCREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END$$\nDELIMITER ;\nSELECT 3;';
    expect(splitSqlStatements(sql)).toEqual(['CREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END', 'SELECT 3']);
  });

  it('melempar error untuk string yang tidak ditutup', () => {
    expect(() => splitSqlStatements("SELECT 'abc;")).toThrow(/tidak ditutup/);
  });

  it('memecah db/schema.sql menjadi pernyataan utuh (procedure tetap satu)', () => {
    const sql = fs.readFileSync(path.join(BACKEND_DIR, 'db', 'schema.sql'), 'utf8');
    const statements = splitSqlStatements(sql);
    expect(statements.filter((s) => s.startsWith('CREATE TABLE'))).toHaveLength(31);
    const procedures = statements.filter((s) => s.startsWith('CREATE PROCEDURE'));
    expect(procedures).toHaveLength(1);
    expect(procedures[0].trimEnd().endsWith('END')).toBe(true);
  });
});
