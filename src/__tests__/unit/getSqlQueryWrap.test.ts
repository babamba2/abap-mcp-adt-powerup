// Wiring of the freestyle line wrap in handleGetSqlQuery: only the freestyle
// request gets the wrapped text; the result and the legacy TABLE_READ fallback
// keep the original statement (callers match result files by exact SQL text).
const getSqlQuery = jest.fn();
jest.mock('../../lib/clients', () => ({
  createAdtClient: () => ({ getUtils: () => ({ getSqlQuery }) }),
}));
const legacyTableRead = jest.fn();
jest.mock('../../lib/legacyTableRead', () => ({
  ...jest.requireActual('../../lib/legacyTableRead'),
  legacyTableRead: (...a: unknown[]) => legacyTableRead(...a),
}));

import { handleGetSqlQuery } from '../../handlers/system/readonly/handleGetSqlQuery';

const names = Array.from(
  { length: 40 },
  (_, i) => `'ZMMT${String(i).padStart(5, '0')}'`,
).join(',');
const SQL = `SELECT TABNAME, FIELDNAME, POSITION, KEYFLAG, ROLLNAME FROM DD03L WHERE AS4LOCAL = 'A' AND TABNAME IN (${names})`;
const ctx = { connection: {} as any, logger: undefined } as any;

const XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<dataPreview:tableData xmlns:dataPreview="http://www.sap.com/adt/dataPreview">' +
  '<dataPreview:totalRows>1</dataPreview:totalRows>' +
  '<dataPreview:columns><dataPreview:metadata dataPreview:name="TABNAME" dataPreview:type="C" dataPreview:description="Table" dataPreview:length="30"/>' +
  '<dataPreview:dataSet><dataPreview:data>ZMMT00000</dataPreview:data></dataPreview:dataSet></dataPreview:columns>' +
  '</dataPreview:tableData>';

beforeEach(() => {
  getSqlQuery.mockReset();
  legacyTableRead.mockReset();
});

describe('handleGetSqlQuery line wrap wiring', () => {
  it('sends wrapped text to freestyle and returns the original statement', async () => {
    getSqlQuery.mockResolvedValue({ status: 200, data: XML });
    const res: any = await handleGetSqlQuery(ctx, {
      sql_query: SQL,
      row_number: 10,
    });
    expect(SQL.length).toBeGreaterThan(255);
    const sent = getSqlQuery.mock.calls[0][0].sql_query as string;
    expect(sent).not.toBe(SQL);
    for (const line of sent.split('\n'))
      expect(line.length).toBeLessThanOrEqual(255);
    expect(res.isError).toBe(false);
    expect(JSON.parse(res.content[0].text).sql_query).toBe(SQL);
  });

  it('gives the legacy fallback the original statement', async () => {
    getSqlQuery.mockRejectedValue(
      new Error('Freestyle SQL is not supported on this SAP system (legacy)'),
    );
    legacyTableRead.mockResolvedValue({
      sql_query: SQL,
      columns: [],
      rows: [],
      total_rows: 0,
    });
    await handleGetSqlQuery(ctx, { sql_query: SQL, row_number: 10 });
    expect(legacyTableRead).toHaveBeenCalledTimes(1);
    expect(legacyTableRead.mock.calls[0][1].sqlQuery).toBe(SQL);
  });
});
