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
    ]);
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
