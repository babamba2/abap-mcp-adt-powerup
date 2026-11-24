/**
 * `mask` on the row-reading tools: the shared rule vectors (same file in the sc4sap
 * plugin, generated from its pt-lib.mjs), the HMAC tokens under the server-side key, the
 * key file, and the three handlers. ADT / dispatcher calls are mocked; names and values
 * are invented. The key here is a fixed test-only key in a temp home.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('../../lib/rfcBackend', () => ({
  callDispatch: jest.fn(),
  callDdicTablRead: jest.fn(),
}));
jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/profile', () => ({ getActiveAlias: jest.fn() }));
jest.mock('../../lib/policy/tableBlocklist', () => ({
  ...jest.requireActual('../../lib/policy/tableBlocklist'),
  activeProfile: () => 'standard',
  checkTables: () => [],
  evaluateHits: () => ({ kind: 'allow' }),
}));

import { handleGetSqlQuery } from '../../handlers/system/readonly/handleGetSqlQuery';
import { handleGetRemoteTableContents } from '../../handlers/table/readonly/handleGetRemoteTableContents';
import { handleGetTableContents } from '../../handlers/table/readonly/handleGetTableContents';
import { createAdtClient } from '../../lib/clients';
import { loadMaskSecret, maskSecretPath } from '../../lib/policy/maskSecret';
import {
  CLEAR_DATATYPES,
  CLEAR_DDIC,
  ddicFromTableData,
  isClearField,
  isPersonalField,
  isRefusedTable,
  MASK_VERSION,
  maskRows,
  maskSpecFrom,
  maskToken,
  PERSONAL_DDIC_PATTERNS,
  PERSONAL_DOMAIN,
  PERSONAL_DTEL,
  PERSONAL_EXACT,
  PERSONAL_NAME_PATTERNS,
  parseStrictSelect,
  tablesInSql,
} from '../../lib/policy/personalMask';
import { getActiveAlias } from '../../lib/profile';
import { callDdicTablRead, callDispatch } from '../../lib/rfcBackend';

const V = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'mask-vectors.json'),
    'utf8',
  ),
);
const SALT = V.salt as string;
const KEY_HEX = 'a'.repeat(32) + 'b'.repeat(32); // test-only key
const KEY = Buffer.from(KEY_HEX, 'hex');
const ctx = { connection: {} as any, logger: undefined } as any;
const body = (r: any) => JSON.parse(r.content[0].text);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mask-home-'));
const envHome = process.env.SC4SAP_HOME_DIR;
beforeAll(() => {
  process.env.SC4SAP_HOME_DIR = home;
});
afterAll(() => {
  process.env.SC4SAP_HOME_DIR = envHome;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('shared rule vectors (pt-lib parity)', () => {
  it('has the same personal lists, refused tables and SELECT grammar', () => {
    expect([...PERSONAL_EXACT].sort()).toEqual(V.lists.exact);
    expect([...PERSONAL_DTEL].sort()).toEqual(V.lists.dtel);
    expect([...PERSONAL_DOMAIN].sort()).toEqual(V.lists.domain);
    for (const c of V.refused_tables)
      expect(isRefusedTable(c.table)).toBe(c.refused);
    for (const c of V.tables_in_sql)
      expect(tablesInSql(c.sql)).toEqual(c.tables);
    for (const c of V.strict_select) {
      const r = parseStrictSelect(c.sql);
      expect(r.ok).toBe(c.ok);
      if (r.ok && c.ok) {
        expect(r.table).toBe(c.table);
        expect([...r.columns]).toEqual(c.columns);
        expect(r.star).toBe(c.star);
      }
    }
  });

  it('masks the same columns', () => {
    const sel = parseStrictSelect(V.mask_rows_select.sql);
    if (!sel.ok) throw new Error('vector SELECT must parse');
    expect(
      maskRows(V.mask_rows_select.rows, SALT, V.mask_rows_select.extra, {
        ddic: V.ddic,
        columns: sel.columns,
        star: sel.star,
        table: 'KNA1',
        secret: KEY,
      }).masked,
    ).toEqual(V.mask_rows_select.expected_masked);
    expect(
      maskRows(V.mask_rows_plain.rows, SALT, [], {
        ddic: V.ddic,
        table: 'KNA1',
        secret: KEY,
      }).masked,
    ).toEqual(V.mask_rows_plain.expected_masked);
  });

  it('decides personal by name, data element and domain', () => {
    expect(isPersonalField('NAME1')).toBe(true);
    expect(
      isPersonalField('ZZX', [], { rollname: 'AD_SMTPADR', domname: '' }),
    ).toBe(true);
    expect(
      isPersonalField('ZZX', [], { rollname: 'ZZ', domname: 'AD_TLNMBR' }),
    ).toBe(true);
    expect(isPersonalField('ZZX', ['zzx'])).toBe(true);
    expect(
      isPersonalField('MENGE', [], { rollname: 'BSTMG', domname: 'MENG13' }),
    ).toBe(false);
  });

  it('has the same name and data element / domain patterns', () => {
    expect(PERSONAL_NAME_PATTERNS.map((re) => re.source)).toEqual(
      V.patterns.name,
    );
    expect(PERSONAL_DDIC_PATTERNS.map((re) => re.source)).toEqual(
      V.patterns.ddic,
    );
  });

  // pinned: real columns of SCUSTOM, KNA1, LFA1, ADRC, BUT000, ADR6, ADR2, KNVK, SBOOK (data elements from S/4 DDIC)
  it.each(Object.keys(V.pinned_tables))(
    'pinned %s: names, phones, e-mail, address, birth and IDs masked; keys clear',
    (table) => {
      const fields = V.pinned_tables[table] as Record<
        string,
        { rollname: string; domname: string; personal: boolean }
      >;
      const ddic = Object.fromEntries(
        Object.entries(fields).map(([f, d]) => [
          f,
          { rollname: d.rollname, domname: d.domname },
        ]),
      );
      const row: Record<string, string> = Object.fromEntries(
        Object.keys(fields).map((f, i) => [f, `v${i}-${f.toLowerCase()}`]),
      );
      row.ZZ_UNKNOWN = 'not in the DDIC';
      const r = maskRows([row], SALT, [], { ddic, table, secret: KEY });
      const expected = [
        ...Object.keys(fields).filter((f) => fields[f].personal),
        'ZZ_UNKNOWN',
      ].sort();
      expect(r.masked).toEqual(expected);
      for (const [f, d] of Object.entries(fields)) {
        if (d.personal) expect(r.rows[0][f]).not.toBe(row[f]);
        else expect(r.rows[0][f]).toBe(row[f]);
      }
      const leaked = JSON.stringify(r.rows);
      for (const f of expected) expect(leaked).not.toContain(row[f]);
    },
  );

  it('catches renamed / custom fields by data element and domain shape', () => {
    const dd = (rollname: string, domname = '') => ({ rollname, domname });
    expect(isPersonalField('ZZCUST', [], dd('S_CUSTNAME'))).toBe(true);
    expect(isPersonalField('ZZTEL', [], dd('AD_TLNMBR9'))).toBe(true);
    expect(isPersonalField('ZZFAX', [], dd('ZZ_X', 'AD_FXNMBR2'))).toBe(true);
    expect(isPersonalField('ZZMAIL', [], dd('ZZ_X', 'ZZ_EMAIL_ADDR'))).toBe(
      true,
    );
    expect(isPersonalField('ZZNM', [], dd('BU_NAMEP_X'))).toBe(true);
    expect(isPersonalField('ZZTAX', [], dd('STCD9'))).toBe(true);
    expect(isPersonalField('ZZ_PHONE_2', [], dd('CHAR30'))).toBe(true);
    expect(isPersonalField('ZZ_CONTACT_EMAIL', [], dd('CHAR241'))).toBe(true);
    expect(isPersonalField('ZZQTY', [], dd('MENGE_D', 'MENG13'))).toBe(false);
    expect(isPersonalField('NAMEFORMAT', [], dd('AD_FORMAT'))).toBe(false);
    expect(isPersonalField('CITY_CODE', [], dd('AD_CITYNUM'))).toBe(false);
    // not personal by shape, but not on the clear list either → still masked
    expect(isClearField('NAMEFORMAT', [], dd('AD_FORMAT'))).toBe(false);
    expect(isClearField('CITY_CODE', [], dd('AD_CITYNUM'))).toBe(false);
  });

  it('keeps a field clear only on the allow-list (data element, domain or data type) and never over a personal shape', () => {
    const dd = (rollname: string, domname = '', datatype = '') => ({
      rollname,
      domname,
      datatype,
    });
    expect([...CLEAR_DDIC].sort()).toEqual(V.lists.clear_ddic);
    expect([...CLEAR_DATATYPES].sort()).toEqual(V.lists.clear_datatypes);
    expect(isClearField('KUNNR', [], dd('KUNNR'))).toBe(true);
    expect(isClearField('ZZBETRAG', [], dd('', '', 'CURR'))).toBe(true);
    expect(isClearField('ZZFLAG', [], dd('ZZ_FLAG', 'XFELD'))).toBe(true);
    // dates: only document / posting / validity data elements; a generic DATUM stays masked
    expect(isClearField('BUDAT', [], dd('BUDAT', 'DATUM'))).toBe(true);
    expect(isClearField('ZZDATE', [], dd('DATUM', 'DATUM'))).toBe(false);
    expect(isClearField('ZDOB', [], dd('ERDAT'))).toBe(false);
    expect(isClearField('ZGEBDAT', [], dd('BUDAT'))).toBe(false);
    expect(maskToken('19800512', 'ZTAB', 'ZGEBDAT', SALT, KEY)).toBe(
      '19000101',
    );
    expect(maskToken('1980-05-12', 'ZTAB', 'ZDOB', SALT, KEY)).toBe(
      '1900-01-01',
    );
    // an unlisted data element (the 4.14.0 gap: S_CUSTNAME / S_PHONENO were simply unknown)
    expect(isClearField('ZZINFO', [], dd('ZZ_NEW_DTEL', 'CHAR30'))).toBe(false);
    expect(isClearField('ZZTEXT', [], dd('', '', 'CHAR'))).toBe(false);
    expect(isClearField('KUNNR', [], null)).toBe(false);
    // a personal shape wins over the clear list
    expect(isClearField('TELEPHONE', [], dd('MANDT'))).toBe(false);
    expect(isClearField('ZZ_CONTACT_NAME', [], dd('KUNNR'))).toBe(false);
    expect(isClearField('ZZX', [], dd('KUNNR', 'AD_SMTPADR'))).toBe(false);
    expect(isClearField('KUNNR', ['kunnr'], dd('KUNNR'))).toBe(false);
    const r = maskRows(
      [{ KUNNR: '7', ZZINFO: 'Kim Minsu', AMOUNT: '10.00', NOTE: 'call 010' }],
      SALT,
      [],
      {
        ddic: {
          KUNNR: dd('KUNNR'),
          ZZINFO: dd('ZZ_NEW_DTEL', 'CHAR30'),
          AMOUNT: dd('', '', 'CURR'),
          NOTE: dd('', '', 'CHAR'),
        },
        table: 'ZTAB',
        secret: KEY,
      },
    );
    expect(r.masked).toEqual(['NOTE', 'ZZINFO']);
    expect(r.rows[0].KUNNR).toBe('7');
    expect(r.rows[0].AMOUNT).toBe('10.00');
    expect(JSON.stringify(r.rows)).not.toContain('Kim Minsu');
  });

  it('catches custom personal field names without any DDIC (name probe)', () => {
    for (const n of V.name_probe.personal)
      expect([n, isPersonalField(n)]).toEqual([n, true]);
    for (const n of V.name_probe.not_personal)
      expect([n, isPersonalField(n)]).toEqual([n, false]);
  });

  it('answers with the v2 rule-set version', () => {
    expect(MASK_VERSION).toBe('hmac-v2');
  });
});

describe('HMAC tokens under the server-side key', () => {
  const tok = (
    v: string,
    field = 'NAME1',
    table = 'KNA1',
    salt = SALT,
    key = KEY,
  ) => maskToken(v, table, field, salt, key);

  it('is deterministic within a run and keeps the value shape', () => {
    expect(tok('Hong Gildong')).toBe(tok('Hong Gildong'));
    expect(tok('Hong Gildong')).toMatch(/^M[0-9A-F]{11}$/);
    expect(tok('0212345678', 'TELF1')).toMatch(/^\d{10}$/);
    expect(tok('AB')).toHaveLength(2);
    expect(tok('19800101', 'GBDAT')).toBe('19000101');
    expect(tok('  ')).toBe('  ');
  });

  it('cannot be recomputed from the salt alone (no sha(salt|value) dictionary)', () => {
    for (const v of ['Hong Gildong', '0212345678', '00012345']) {
      const field = /^\d+$/.test(v) ? 'PERNR' : 'NAME1';
      const plain = sha(`${SALT}|${v}`);
      const t = tok(v, field);
      expect(t).not.toBe(`M${plain.toUpperCase()}`.slice(0, t.length));
      expect(t).not.toBe(
        [...v]
          .map((_, i) =>
            String(Number.parseInt(plain[i % plain.length], 16) % 10),
          )
          .join(''),
      );
    }
    const other = Buffer.from('c'.repeat(64), 'hex');
    expect(tok('Hong Gildong', 'NAME1', 'KNA1', SALT, other)).not.toBe(
      tok('Hong Gildong'),
    );
  });

  it('is namespaced by run salt, table and field', () => {
    expect(tok('Kim', 'NAME1', 'KNA1', SALT)).not.toBe(
      tok('Kim', 'NAME1', 'KNA1', 'f'.repeat(32)),
    );
    expect(tok('Kim', 'NAME1', 'KNA1')).not.toBe(tok('Kim', 'NAME1', 'LFA1'));
    expect(tok('Kim', 'NAME1', 'KNA1')).not.toBe(tok('Kim', 'NAME2', 'KNA1'));
  });

  it('gives an alias the token of its source field', () => {
    const sel = parseStrictSelect('SELECT kunnr, name1 AS n FROM kna1');
    if (!sel.ok) throw new Error('parse');
    const out = maskRows([{ KUNNR: '1', N: 'Kim' }], SALT, [], {
      ddic: V.ddic,
      columns: sel.columns,
      star: false,
      table: 'KNA1',
      secret: KEY,
    });
    expect(out.rows[0].N).toBe(tok('Kim', 'NAME1', 'KNA1'));
  });
});

describe('the key file', () => {
  it('is created once per profile (64 hex, mode 600 where the OS has modes) and reused', () => {
    (getActiveAlias as jest.Mock).mockReturnValue('DEV-1');
    const file = maskSecretPath();
    expect(file).toBe(path.join(home, 'profiles', 'DEV-1', 'mask.key'));
    const a = loadMaskSecret();
    expect(a).toHaveLength(32);
    expect(fs.readFileSync(file, 'utf8').trim()).toMatch(/^[0-9a-f]{64}$/);
    if (process.platform !== 'win32')
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(loadMaskSecret().equals(a)).toBe(true);
    fs.writeFileSync(file, 'not a key');
    expect(() => loadMaskSecret()).toThrow(/not a 64-hex key/);
    (getActiveAlias as jest.Mock).mockReturnValue(undefined);
  });
});

describe('mask argument and DDIC parsing', () => {
  it('checks the mask spec', () => {
    expect(maskSpecFrom(undefined)).toBeNull();
    expect(maskSpecFrom({ salt: SALT, extra_fields: ['zzx'] })).toEqual({
      salt: SALT,
      extraFields: ['ZZX'],
    });
    for (const bad of [
      {},
      { salt: 'xyz' },
      { salt: SALT, extra_fields: 'A' },
      { salt: SALT, extra_fields: ['A;B'] },
      [],
    ])
      expect(typeof maskSpecFrom(bad)).toBe('string');
  });

  it('reads both GetTable shapes', () => {
    expect(
      ddicFromTableData(
        JSON.stringify({
          fields: [
            {
              FIELDNAME: 'NAME1',
              ROLLNAME: 'NAME1_GP',
              DOMNAME: 'NAME',
              DATATYPE: 'CHAR',
            },
          ],
        }),
      ),
    ).toEqual({
      NAME1: { rollname: 'NAME1_GP', domname: 'NAME', datatype: 'CHAR' },
    });
    // S/4 source: built-in types give the data type, no data element
    expect(
      ddicFromTableData(
        'define table zx {\n key mandt : mandt not null;\n amount : abap.curr(15,2);\n note : abap.char(40);\n}',
      ),
    ).toEqual({
      MANDT: { rollname: 'MANDT', domname: '' },
      AMOUNT: { rollname: '', domname: '', datatype: 'CURR' },
      NOTE: { rollname: '', domname: '', datatype: 'CHAR' },
    });
    expect(
      Object.keys(
        ddicFromTableData(
          'define table ekpo {\n key ebeln : ebeln not null;\n menge : bstmg;\n include zx;\n}',
        ) ?? {},
      ),
    ).toEqual(['EBELN', 'MENGE']);
    expect(ddicFromTableData('nothing')).toBeNull();
  });
});

describe('handlers with mask', () => {
  const ddicRead = callDdicTablRead as jest.Mock;
  const dispatch = callDispatch as jest.Mock;
  const client = createAdtClient as jest.Mock;
  const KNA1 = {
    fields: [
      { FIELDNAME: 'KUNNR', ROLLNAME: 'KUNNR', DOMNAME: 'KUNNR' },
      { FIELDNAME: 'NAME1', ROLLNAME: 'NAME1_GP', DOMNAME: 'NAME' },
      { FIELDNAME: 'LAND1', ROLLNAME: 'LAND1_GP', DOMNAME: 'LAND1' },
    ],
  };
  const env = process.env.SAP_VERSION;
  const keyFile = path.join(home, 'mask.key');
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SAP_VERSION = 'ECC';
    fs.writeFileSync(keyFile, `${KEY_HEX}\n`);
  });
  afterAll(() => {
    process.env.SAP_VERSION = env;
  });
  const leaks = (b: any) =>
    JSON.stringify(b).match(/Hong Gildong|x y z|aaaaaaaa|bbbbbbbb/);

  it('GetRemoteTableContents: masked rows, metadata only, no salt hash, no fingerprints, no key', async () => {
    ddicRead.mockResolvedValue({ subrc: 0, message: '', result: KNA1 });
    dispatch.mockResolvedValue({
      result: {
        table: 'KNA1',
        fields: [{ name: 'KUNNR' }, { name: 'NAME1' }],
        rows: [
          {
            KUNNR: '0000001',
            NAME1: 'Hong Gildong',
            LAND1: 'KR',
            ZZNEW: 'x y z',
          },
        ],
        count: 1,
        raw_lines: ['0000001|Hong Gildong|KR'],
      },
    });
    const r = await handleGetRemoteTableContents(ctx, {
      table_name: 'kna1',
      destination: 'QAS100',
      mask: { salt: SALT },
    });
    expect(r.isError).toBe(false);
    const b = body(r);
    expect(Object.keys(b).sort()).toEqual([
      'count',
      'fields',
      'masking',
      'rows',
      'table',
    ]);
    expect(Object.keys(b.masking).sort()).toEqual([
      'ddic_fields',
      'default_deny',
      'masked_columns',
      'version',
    ]);
    expect(b.masking).toMatchObject({
      version: MASK_VERSION,
      masked_columns: ['NAME1', 'ZZNEW'],
    });
    expect(b.rows[0]).toMatchObject({
      KUNNR: '0000001',
      LAND1: 'KR',
      NAME1: maskToken('Hong Gildong', 'KNA1', 'NAME1', SALT, KEY),
    });
    expect(leaks(b)).toBeNull();
  });

  it('remote table unknown on DEV (e.g. a Z table only in QA): every column masked', async () => {
    ddicRead.mockResolvedValue({ subrc: 4, message: 'not found', result: {} });
    dispatch.mockResolvedValue({
      result: {
        table: 'ZQA_ONLY',
        rows: [{ ZKEY: '0001', ZTEXT: 'Hong Gildong' }],
        count: 1,
      },
    });
    const r = await handleGetRemoteTableContents(ctx, {
      table_name: 'ZQA_ONLY',
      destination: 'QAS100',
      mask: { salt: SALT },
    });
    expect(r.isError).toBe(false);
    const b = body(r);
    expect(leaks(b.rows)).toBeNull();
    expect(b.rows[0].ZKEY).not.toBe('0001');
    expect(b.masking).toMatchObject({
      masked_columns: ['ZKEY', 'ZTEXT'],
      ddic_fields: 0,
    });
  });

  it('no rows when the key file is unusable', async () => {
    fs.writeFileSync(keyFile, 'broken');
    const r = await handleGetRemoteTableContents(ctx, {
      table_name: 'KNA1',
      destination: 'QAS100',
      mask: { salt: SALT },
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toMatch(/broken/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('local reads return no rows at all when the DDIC cannot be read', async () => {
    ddicRead.mockResolvedValue({ subrc: 4, message: 'not found', result: {} });
    const r = await handleGetTableContents(ctx, {
      table_name: 'ZNONE',
      mask: { salt: SALT },
    });
    expect(r.isError).toBe(true);
    expect(client).not.toHaveBeenCalled();
  });

  it('refuses personal / credential tables before reading', async () => {
    const r = await handleGetRemoteTableContents(ctx, {
      table_name: 'ADR6',
      destination: 'QAS100',
      mask: { salt: SALT },
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/personal \/ credential table ADR6/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('GetSqlQuery: strict grammar and output file refused before any SAP call', async () => {
    for (const sql of [
      'SELECT kunnr, land1 FROM kna1 UNION SELECT kunnr, name1 FROM kna1',
      'SELECT kunnr, concat( name1, land1 ) AS full FROM kna1',
      'SELECT a~kunnr FROM kna1 AS a INNER JOIN usr02 AS b ON b~bname = a~ernam',
    ]) {
      const r = await handleGetSqlQuery(ctx, {
        sql_query: sql,
        mask: { salt: SALT },
      });
      expect(r.isError).toBe(true);
    }
    const f = await handleGetSqlQuery(ctx, {
      sql_query: 'SELECT kunnr FROM kna1',
      output: 'file',
      mask: { salt: SALT },
    });
    expect(f.isError).toBe(true);
    expect(client).not.toHaveBeenCalled();
    expect(ddicRead).not.toHaveBeenCalled();
  });

  const xml = (cols: [string, string][]) =>
    '<?xml version="1.0"?><dataPreview:tableData xmlns:dataPreview="http://www.sap.com/adt/dataPreview">' +
    '<dataPreview:totalRows>1</dataPreview:totalRows>' +
    cols
      .map(
        ([n, v]) =>
          `<dataPreview:columns><dataPreview:metadata dataPreview:name="${n}" dataPreview:type="C"/><dataPreview:dataSet><dataPreview:data>${v}</dataPreview:data></dataPreview:dataSet></dataPreview:columns>`,
      )
      .join('') +
    '</dataPreview:tableData>';

  it('GetSqlQuery: alias masked with its source field token; the query text is not echoed', async () => {
    ddicRead.mockResolvedValue({ subrc: 0, message: '', result: KNA1 });
    client.mockReturnValue({
      getUtils: () => ({
        getSqlQuery: jest.fn().mockResolvedValue({
          status: 200,
          data: xml([
            ['KUNNR', '0000001'],
            ['N', 'Hong Gildong'],
          ]),
        }),
      }),
    });
    const r = await handleGetSqlQuery(ctx, {
      sql_query:
        "SELECT kunnr, name1 AS n FROM kna1 WHERE name1 = 'Hong Gildong'",
      mask: { salt: SALT },
    });
    expect(r.isError).toBe(false);
    const b = body(r);
    expect(leaks(b)).toBeNull();
    expect(b.sql_query).toBeUndefined();
    expect(b.masking.masked_columns).toEqual(['N']);
    expect(b.rows[0].N).toBe(
      maskToken('Hong Gildong', 'KNA1', 'NAME1', SALT, KEY),
    );
  });

  it('GetTableContents masks default-deny; without mask nothing changes', async () => {
    ddicRead.mockResolvedValue({ subrc: 0, message: '', result: KNA1 });
    client.mockReturnValue({
      getUtils: () => ({
        getTableContents: jest.fn().mockResolvedValue({
          status: 200,
          data: xml([
            ['KUNNR', '0000001'],
            ['NAME1', 'Hong Gildong'],
          ]),
        }),
      }),
    });
    const masked = await handleGetTableContents(ctx, {
      table_name: 'KNA1',
      mask: { salt: SALT },
    });
    expect(masked.isError).toBe(false);
    expect(masked.content[0].text).not.toMatch(/Hong Gildong/);
    expect(body(masked).masking.masked_columns).toEqual(['NAME1']);
    const plain = await handleGetTableContents(ctx, { table_name: 'KNA1' });
    expect(plain.content[0].text).toMatch(/Hong Gildong/);
    expect(body(plain).masking).toBeUndefined();
  });
});
