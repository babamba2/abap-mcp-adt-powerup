import {
  isLegacyUnsupported,
  LEGACY_READABLE_TABLES,
  legacyTableRead,
  parseSimpleSelect,
} from '../../lib/legacyTableRead';
import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/rfcBackend', () => ({ callDispatch: jest.fn() }));
const dispatch = callDispatch as jest.Mock;
const rowsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Z${i}` }));

describe('legacy table read (BASIS < 7.50 fallback)', () => {
  it('recognises the client library refusal', () => {
    expect(
      isLegacyUnsupported(
        new Error(
          'SQL query is not supported on this SAP system (legacy, BASIS < 7.50). The required endpoint /sap/bc/adt/datapreview/freestyle was not found',
        ),
      ),
    ).toBe(true);
    expect(isLegacyUnsupported(new Error('HTTP 500'))).toBe(false);
  });

  it('parses a single-table SELECT with a WHERE condition', () => {
    expect(
      parseSimpleSelect(
        "SELECT ARBGB, MSGNR, TEXT FROM T100 WHERE SPRSL = 'E' AND ARBGB = 'ZSD04' AND MSGNR IN ('015', '016')",
      ),
    ).toEqual({
      table: 'T100',
      fields: ['ARBGB', 'MSGNR', 'TEXT'],
      where: "SPRSL = 'E' AND ARBGB = 'ZSD04' AND MSGNR IN ('015', '016')",
    });
    expect(
      parseSimpleSelect(
        "SELECT VALID, BOOLCLASS, GBOPCREATE FROM GB93 WHERE (VALID LIKE 'Z%' OR VALID LIKE 'Y%') AND GBOPCREATE <> 'SAP'",
      ),
    ).toMatchObject({
      table: 'GB93',
      where: "(VALID LIKE 'Z%' OR VALID LIKE 'Y%') AND GBOPCREATE <> 'SAP'",
    });
  });

  it('handles *, aliases, ORDER BY and no WHERE', () => {
    expect(parseSimpleSelect('SELECT * FROM modattr')).toEqual({
      table: 'MODATTR',
      fields: [],
      where: '',
    });
    expect(
      parseSimpleSelect(
        "SELECT a~NAME, a~MEMBER FROM MODACT AS a WHERE a~MEMBER = 'V45A0001' ORDER BY a~NAME",
      ),
    ).toEqual({
      table: 'MODACT',
      fields: ['NAME', 'MEMBER'],
      where: "MEMBER = 'V45A0001'",
    });
  });

  it('refuses joins, aggregates and sub-selects', () => {
    expect(
      parseSimpleSelect(
        'SELECT a~NAME FROM MODACT AS a INNER JOIN MODATTR AS b ON a~NAME = b~NAME',
      ),
    ).toBeNull();
    expect(parseSimpleSelect('SELECT COUNT(*) FROM T100')).toBeNull();
    expect(
      parseSimpleSelect(
        "SELECT NAME FROM MODACT WHERE NAME IN ( SELECT NAME FROM MODATTR WHERE STATUS = 'A' )",
      ),
    ).toBeNull();
  });

  it('allows only the customizing tables sc4sap needs', () => {
    expect([...LEGACY_READABLE_TABLES]).toEqual([
      'MODACT',
      'MODATTR',
      'MODSAP',
      'GB31',
      'GB92',
      'GB93',
      'T001D',
      'T001Q',
      'TBE24',
      'TBE34',
      'TPS34',
      'TFRM',
      'TFRMT',
      'T100',
      'TSTC',
      'TSTCP',
      'DD03L',
      'DD04L',
    ]);
  });

  it('leaves the table check to the dispatcher and explains its refusal', async () => {
    dispatch.mockResolvedValueOnce({ result: { rows: [{ BSART: 'NB' }] } });
    const ok = await legacyTableRead({} as any, { table: 't161', maxRows: 10 });
    expect(dispatch.mock.calls[0][2].table_name).toBe('T161');
    expect(ok.rows).toEqual([{ BSART: 'NB' }]);

    dispatch.mockRejectedValueOnce(
      new Error('TABLE_READ: table EKKO is not allowed'),
    );
    await expect(
      legacyTableRead({} as any, { table: 'EKKO', maxRows: 10 }),
    ).rejects.toThrow(/EKKO is not allowed — .*delivery class C, G, E, S, W/);
    expect(dispatch.mock.calls[0][2].all_tables).toBeUndefined();
    dispatch.mockClear();
  });

  it('names customer tables in the refusal and passes a personal-data refusal through unchanged', async () => {
    dispatch.mockRejectedValueOnce(
      new Error('TABLE_READ: table EKKO is not allowed'),
    );
    await expect(
      legacyTableRead({} as any, { table: 'EKKO', maxRows: 10 }),
    ).rejects.toThrow(
      /customer tables \(Z\*, Y\*, own namespaces\) of any class with your SE16 authority; SAP business tables and personal-data customer tables stay closed/,
    );

    // A customer table read goes to the dispatcher like any other (it decides).
    dispatch.mockResolvedValueOnce({ result: { rows: [{ TOKEN: 'A' }] } });
    const ok = await legacyTableRead({} as any, {
      table: 'zmcp_biz_log',
      maxRows: 1,
    });
    expect(dispatch.mock.calls[1][2].table_name).toBe('ZMCP_BIZ_LOG');
    expect(dispatch.mock.calls[1][2].all_tables).toBeUndefined();
    expect(ok.rows).toEqual([{ TOKEN: 'A' }]);

    const personal =
      'TABLE_READ: table ZHR_PAY holds HR / payroll data (personal data) and is not readable';
    dispatch.mockRejectedValueOnce(new Error(personal));
    await expect(
      legacyTableRead({} as any, { table: 'ZHR_PAY', maxRows: 1 }),
    ).rejects.toThrow(personal);
    dispatch.mockClear();
  });

  it('asks the dispatcher for all tables when the blocklist profile is off', async () => {
    const saved = process.env.MCP_BLOCKLIST_PROFILE;
    process.env.MCP_BLOCKLIST_PROFILE = 'off';
    try {
      dispatch.mockResolvedValueOnce({ result: { rows: [{ BELNR: '1' }] } });
      await legacyTableRead({} as any, { table: 'bkpf', maxRows: 1 });
      expect(dispatch.mock.calls[0][2].all_tables).toBe('X');

      dispatch.mockRejectedValueOnce(
        new Error('TABLE_READ: table BKPF is not allowed'),
      );
      await expect(
        legacyTableRead({} as any, { table: 'BKPF', maxRows: 1 }),
      ).rejects.toThrow(/predates the all_tables flag/);

      dispatch.mockRejectedValueOnce(
        new Error('TABLE_READ: table USR02 is not allowed'),
      );
      await expect(
        legacyTableRead({} as any, { table: 'USR02', maxRows: 1 }),
      ).rejects.toThrow(/stay closed on every blocklist profile/);
    } finally {
      if (saved === undefined) delete process.env.MCP_BLOCKLIST_PROFILE;
      else process.env.MCP_BLOCKLIST_PROFILE = saved;
      dispatch.mockClear();
    }
  });

  it('reports truncated only when more rows exist than requested', async () => {
    const read = (maxRows: number) =>
      legacyTableRead({} as any, {
        table: 'MODATTR',
        fields: ['NAME'],
        maxRows,
      });

    dispatch.mockResolvedValueOnce({ result: { rows: rowsOf(3) } });
    const exact = await read(3);
    expect(dispatch.mock.calls[0][2].max_rows).toBe(4);
    expect(exact.rows).toHaveLength(3);
    expect(exact.truncated).toBeUndefined();

    dispatch.mockResolvedValueOnce({ result: { rows: rowsOf(4) } });
    const more = await read(3);
    expect(more.rows).toHaveLength(3);
    expect(more.truncated).toBe(true);

    dispatch.mockResolvedValueOnce({ result: { rows: rowsOf(5000) } });
    expect((await read(5000)).truncated).toBe(true);
  });
});
