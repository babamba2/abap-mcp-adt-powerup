import {
  checkTables,
  extractTablesFromSql,
} from '../../lib/policy/tableBlocklist';

describe('table blocklist — every name of a FROM clause counts', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const cases: [string, string[]][] = [
    ['SELECT * FROM AGR_1251, USR02 WHERE x = 1', ['AGR_1251', 'USR02']],
    [
      'SELECT * FROM AGR_1251 AS a, USR02 AS u WHERE a~x = u~y',
      ['AGR_1251', 'USR02'],
    ],
    ['SELECT * FROM AGR_1251 a, /ABC/T1 b', ['AGR_1251', '/ABC/T1']],
    [
      'SELECT * FROM AGR_1251 INNER JOIN AGR_AGRS ON AGR_1251~AGR_NAME = AGR_AGRS~AGR_NAME , USR02',
      ['AGR_1251', 'AGR_AGRS', 'USR02'],
    ],
    ['SELECT * FROM ( AGR_1251 ), USR02', ['AGR_1251', 'USR02']],
    ['select * from agr_1251,usr02', ['AGR_1251', 'USR02']],
  ];

  it.each(cases)('%s', (sql, expected) => {
    const got = extractTablesFromSql(sql);
    expect(got[0]).toBe(expected[0]);
    expect([...got].sort()).toEqual([...expected].sort());
  });

  it('keeps the first FROM name first and stops at WHERE / sub-query ends', () => {
    expect(
      extractTablesFromSql(
        "SELECT a, b FROM T000 WHERE mandt IN ( SELECT mandt FROM T001 WHERE x IN ( 'A', 'B' ) ) ORDER BY a, b",
      ),
    ).toEqual(['T000', 'T001']);
    expect(
      extractTablesFromSql('SELECT FROM TADIR FIELDS obj_name, devclass'),
    ).toEqual(['TADIR']);
  });

  it('a comma-joined blocklisted table is no longer hidden behind an allowed one', () => {
    process.env.MCP_BLOCKLIST_PROFILE = 'minimal';
    process.env.MCP_ALLOW_TABLE = 'AGR_1251,AGR_AGRS';
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    try {
      const hits = checkTables(
        extractTablesFromSql('SELECT * FROM AGR_1251 AS a, USR02 AS u'),
      );
      expect(hits.map((h) => h.table)).toEqual(['USR02']);
    } finally {
      spy.mockRestore();
    }
  });
});
