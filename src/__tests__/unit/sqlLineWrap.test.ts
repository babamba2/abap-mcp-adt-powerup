import { SQL_MAX_LINE, wrapSqlLines } from '../../lib/sqlLineWrap';

const names = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `'ZMMT${String(i).padStart(5, '0')}'`,
  ).join(',');
const longSql = `SELECT TABNAME, FIELDNAME, POSITION, KEYFLAG, ROLLNAME FROM DD03L WHERE AS4LOCAL = 'A' AND TABNAME IN (${names(200)})`;

/** literals in order, so wrapping can be checked not to touch them */
const literals = (s: string) => s.match(/'(?:[^']|'')*'/g) ?? [];
const flat = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/ ?, ?/g, ',').trim();

describe('wrapSqlLines', () => {
  it('leaves a short statement unchanged', () => {
    const sql = "SELECT AREA FROM TLIBT WHERE AREA IN ('ZMMFG_ETC')";
    expect(wrapSqlLines(sql)).toBe(sql);
  });

  it('keeps every line within the limit for a 200-name IN list', () => {
    const out = wrapSqlLines(longSql);
    expect(longSql.length).toBeGreaterThan(255);
    for (const line of out.split('\n'))
      expect(line.length).toBeLessThanOrEqual(SQL_MAX_LINE);
  });

  it('never splits or changes a literal and keeps the statement text', () => {
    const out = wrapSqlLines(longSql);
    expect(literals(out)).toEqual(literals(longSql));
    expect(flat(out)).toBe(flat(longSql));
  });

  it('does not break at spaces or commas inside a literal', () => {
    const lit = `'${'A, B '.repeat(30)}'`; // 150 chars of spaces and commas
    const sql = `SELECT X FROM T WHERE ${'C = ' + lit + ' AND '}D IN (${names(40)})`;
    const out = wrapSqlLines(sql, 180);
    expect(out).toContain(lit);
  });

  it('handles escaped quotes inside a literal', () => {
    const sql = `SELECT X FROM T WHERE C = 'it''s, a test' AND D IN (${names(60)})`;
    const out = wrapSqlLines(sql);
    expect(out).toContain("'it''s, a test'");
    for (const line of out.split('\n'))
      expect(line.length).toBeLessThanOrEqual(SQL_MAX_LINE);
  });

  it('keeps an over-long literal whole on its own line', () => {
    const lit = `'${'X'.repeat(260)}'`;
    const out = wrapSqlLines(`SELECT A FROM T WHERE B = ${lit} AND C = 'D'`);
    expect(out.split('\n').some((l) => l.includes(lit))).toBe(true);
  });

  it('never puts a * in column 1 (ABAP comment line)', () => {
    // pad < 193: "SELECT " + pad stays a breakable chunk within the limit
    for (let pad = 140; pad < 193; pad++) {
      const sql = `SELECT ${'A'.repeat(pad)} , COUNT( * ) AS N FROM T WHERE B IN (${names(20)}) GROUP BY C`;
      const out = wrapSqlLines(sql);
      for (const line of out.split('\n')) {
        expect(line.startsWith('*')).toBe(false);
        expect(line.length).toBeLessThanOrEqual(SQL_MAX_LINE);
      }
      expect(flat(out)).toBe(flat(sql));
    }
  });

  it('indents every continuation line by one space', () => {
    const lines = wrapSqlLines(longSql).split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].startsWith(' ')).toBe(false);
    for (const l of lines.slice(1)) expect(l).toMatch(/^ \S/);
  });

  it('protects backtick literals, including a quote or doubled backtick inside', () => {
    const bt = "`it's, a ``b`` c d e`";
    const sql = `SELECT X FROM T WHERE C = ${bt} AND D IN (${names(60)})`;
    const out = wrapSqlLines(sql);
    expect(out).toContain(bt);
    expect(literals(out.replace(bt, ''))).toEqual(
      literals(sql.replace(bt, '')),
    );
    for (const line of out.split('\n'))
      expect(line.length).toBeLessThanOrEqual(SQL_MAX_LINE);
  });

  it('leaves a line with a " end-of-line comment unchanged', () => {
    const sql = `SELECT X FROM T WHERE D IN (${names(60)}) " trailing, comment text`;
    expect(wrapSqlLines(sql)).toBe(sql);
  });

  it('returns a long line without break points unchanged', () => {
    const sql = 'X'.repeat(300);
    expect(wrapSqlLines(sql)).toBe(sql);
  });

  it('handles empty input, CRLF and a trailing separator', () => {
    expect(wrapSqlLines('')).toBe('');
    expect(wrapSqlLines('SELECT A\r\nFROM T')).toBe('SELECT A\nFROM T');
    const out = wrapSqlLines(`${longSql} , `);
    expect(out.endsWith('\n')).toBe(false);
    for (const line of out.split('\n')) expect(line.trim()).not.toBe('');
  });

  it('keeps existing short lines as they are', () => {
    const sql = 'SELECT A\nFROM T\nWHERE B = 1';
    expect(wrapSqlLines(sql)).toBe(sql);
  });
});
