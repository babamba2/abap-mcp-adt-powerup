/**
 * The blocklist's aggregate exemption (GetSqlQuery): counts over non-personal fields only
 * (no SUM / MIN / MAX / AVG), no personal field in the projection or the WHERE clause, and
 * never for "deny" tables or credential / security / HR tables — only "ask" business tables.
 */
import {
  aggregateExempt,
  isAggregateOnly,
} from '../../lib/policy/tableBlocklist';

describe('isAggregateOnly (shape)', () => {
  it.each([
    'SELECT COUNT(*) FROM VBAK',
    'SELECT COUNT( * ) AS n FROM VBAK',
    "SELECT COUNT(*) FROM VBAK WHERE VKORG = '1000'",
    "SELECT COUNT(*) FROM VBAK WHERE VKORG = '1000' AND AUART IN ('OR','ZOR')",
    'SELECT COUNT(DISTINCT KUNNR) FROM VBAK',
    "SELECT COUNT(*) FROM VBAK WHERE ERDAT BETWEEN '20260101' AND '20261231'",
    // a literal that spells a personal field name is data, not a field
    "SELECT COUNT(*) FROM VBAK WHERE VKORG = 'NAME1'",
  ])('accepts %s', (sql) => {
    expect(isAggregateOnly(sql)).toBe(true);
  });

  it.each([
    // values, not counts
    'SELECT MAX(STCD1) FROM KNA1',
    'SELECT MIN(NAME1) FROM KNA1',
    'SELECT MAX(VBELN) FROM VBAK',
    'SELECT AVG(NETWR) FROM VBAK',
    'SELECT SUM(NETWR) FROM VBAK',
    "SELECT SUM(BET01) FROM PA0008 WHERE BEGDA = '20260101' AND TRFGR = 'A1'",
    // personal field in the projection
    'SELECT COUNT(DISTINCT STCD1) FROM KNA1',
    // existence probes on a personal field
    "SELECT COUNT(*) FROM KNA1 WHERE NAME1 = 'Hong Gildong'",
    "SELECT COUNT(*) FROM KNA1 WHERE LAND1 = 'KR' AND STCD1 LIKE '880%'",
    "SELECT COUNT(*) FROM KNA1 AS a WHERE a~SMTP_ADDR = 'x@y.z'",
    "SELECT COUNT(*) FROM PA0002 WHERE GBDAT = '19800101'",
    "SELECT COUNT(*) FROM BKPF WHERE USNAM = 'ALICE'",
    // shapes that surface rows or keys
    'SELECT COUNT(*), LAND1 FROM KNA1',
    'SELECT LAND1, COUNT(*) FROM KNA1 GROUP BY LAND1',
    'SELECT COUNT(*) FROM KNA1 UNION SELECT COUNT(*) FROM LFA1',
    'SELECT COUNT(*) FROM KNA1 INNER JOIN KNB1 ON KNB1~KUNNR = KNA1~KUNNR',
    'SELECT COUNT(*) FROM KNA1 WHERE KUNNR IN ( SELECT KUNNR FROM KNVV )',
    'SELECT * FROM KNA1',
    'SELECT KUNNR FROM KNA1',
  ])('refuses %s', (sql) => {
    expect(isAggregateOnly(sql)).toBe(false);
  });
});

describe('aggregateExempt (shape + tables)', () => {
  const prev = process.env.MCP_BLOCKLIST_PROFILE;
  beforeAll(() => {
    process.env.MCP_BLOCKLIST_PROFILE = 'standard';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.MCP_BLOCKLIST_PROFILE;
    else process.env.MCP_BLOCKLIST_PROFILE = prev;
  });

  it('skips the blocklist only for counts on "ask" business tables', () => {
    expect(
      aggregateExempt("SELECT COUNT(*) FROM VBAK WHERE VKORG = '1000'", [
        'VBAK',
      ]),
    ).toBe(true);
    expect(
      aggregateExempt('SELECT COUNT(DISTINCT EBELN) FROM EKKO', ['EKKO']),
    ).toBe(true);
  });

  // verifier-3's M4 probes
  it.each([
    [
      "SELECT COUNT(*) FROM usr02 WHERE trdat = '20261117' AND pwdsaltedhash LIKE '{x-issha, 1024}A%'",
      ['USR02'],
    ],
    ["SELECT COUNT(*) FROM usr02 WHERE bcode = 'ABC'", ['USR02']],
    [
      "SELECT SUM(bet01) FROM pa0008 WHERE begda = '20260101' AND trfgr = 'A1'",
      ['PA0008'],
    ],
    ['SELECT COUNT(*) FROM rsectab', ['RSECTAB']],
    // other credential / security / HR tables, and "deny" business master data
    ['SELECT COUNT(*) FROM rfcdes', ['RFCDES']],
    ['SELECT COUNT(*) FROM rsecactb', ['RSECACTB']],
    ['SELECT COUNT(*) FROM ssf_pse_d', ['SSF_PSE_D']],
    ['SELECT COUNT(*) FROM hrp1000', ['HRP1000']],
    ['SELECT COUNT(*) FROM agr_users', ['AGR_USERS']],
    ["SELECT COUNT(*) FROM kna1 WHERE land1 = 'KR'", ['KNA1']],
    ['SELECT COUNT(*) FROM bnka', ['BNKA']],
  ])('never exempts %s', (sql, tables) => {
    expect(aggregateExempt(sql, tables)).toBe(false);
  });
});
