/**
 * Unit tests for the ECC branch of CreateTable:
 * DD02V (TRANSP) + DD03P + DD09L through ZMCP_ADT_DDIC_TABL.
 * SAP calls are mocked; object names are invented.
 */

import { callDdicActivate, callDdicTabl } from '../../lib/rfcBackend';

jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/rfcBackend', () => {
  const actual = jest.requireActual('../../lib/rfcBackend');
  return {
    ...actual,
    callDdicTabl: jest.fn(),
    callDdicActivate: jest.fn(),
  };
});

import { handleCreateTable } from '../../handlers/table/high/handleCreateTable';
import { buildEccTablePayload } from '../../handlers/table/high/handleCreateTableEcc';
import { createAdtClient } from '../../lib/clients';

const mockTabl = callDdicTabl as jest.Mock;
const mockActivate = callDdicActivate as jest.Mock;
const mockCreate = createAdtClient as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  jest.clearAllMocks();
});

const baseArgs = {
  table_name: 'ytest_t01',
  description: 'Test table',
  package_name: 'YTEST_PKG',
  transport_request: 'DEVK900001',
  fields: [
    { name: 'mandt', key: true, data_element: 'MANDT' },
    { name: 'docno', key: true, data_element: 'VBELN_VA' },
    { name: 'qty', data_element: 'KWMENG', reference_field: 'UNIT' },
    { name: 'unit', data_element: 'VRKME' },
    { name: 'ldate', data_type: 'DATS' },
  ],
  includes: [{ name: 'ytest_s_audit' }],
};

describe('buildEccTablePayload', () => {
  it('builds header, fields, include row and technical settings', () => {
    const p = buildEccTablePayload(baseArgs, 'YTEST_T01');
    expect(p.dd02v).toMatchObject({
      TABNAME: 'YTEST_T01',
      TABCLASS: 'TRANSP',
      CONTFLAG: 'A',
      CLIDEP: 'X',
      DDTEXT: 'Test table',
    });
    expect(p.dd09l).toMatchObject({
      TABART: 'APPL1',
      TABKAT: '0',
      BUFALLOW: 'N',
    });
    expect(p.dd03p).toHaveLength(6);
    expect(p.dd03p[0]).toMatchObject({
      FIELDNAME: 'MANDT',
      KEYFLAG: 'X',
      NOTNULL: 'X',
      ROLLNAME: 'MANDT',
      COMPTYPE: 'E',
      POSITION: '0001',
    });
    expect(p.dd03p[2]).toMatchObject({
      REFTABLE: 'YTEST_T01',
      REFFIELD: 'UNIT',
    });
    expect(p.dd03p[2].KEYFLAG).toBeUndefined();
    expect(p.dd03p[4]).toMatchObject({ DATATYPE: 'DATS', LENG: '000008' });
    expect(p.dd03p[5]).toMatchObject({
      FIELDNAME: '.INCLUDE',
      PRECFIELD: 'YTEST_S_AUDIT',
      COMPTYPE: 'S',
      DATATYPE: 'STRU',
      POSITION: '0006',
    });
  });

  it('defaults the enhancement category to 4 with includes and 1 without', () => {
    expect(buildEccTablePayload(baseArgs, 'YTEST_T01').dd02v.EXCLASS).toBe('4');
    expect(
      buildEccTablePayload({ ...baseArgs, includes: [] }, 'YTEST_T01').dd02v
        .EXCLASS,
    ).toBe('1');
    expect(
      buildEccTablePayload(
        { ...baseArgs, enhancement_category: '3' },
        'YTEST_T01',
      ).dd02v.EXCLASS,
    ).toBe('3');
    expect(() =>
      buildEccTablePayload(
        { ...baseArgs, enhancement_category: '9' },
        'YTEST_T01',
      ),
    ).toThrow(/enhancement_category/);
  });

  it('uses the given delivery class, data class and size category', () => {
    const p = buildEccTablePayload(
      {
        ...baseArgs,
        delivery_class: 'c',
        data_class: 'appl2',
        size_category: '3',
      },
      'YTEST_T01',
    );
    expect(p.dd02v.CONTFLAG).toBe('C');
    expect(p.dd09l).toMatchObject({ TABART: 'APPL2', TABKAT: '3' });
  });

  it('rejects a missing field list', () => {
    expect(() =>
      buildEccTablePayload({ ...baseArgs, fields: [] }, 'YTEST_T01'),
    ).toThrow(/needs "fields"/);
  });

  it('rejects a table whose first field is not a key', () => {
    expect(() =>
      buildEccTablePayload(
        { ...baseArgs, fields: [{ name: 'A', data_element: 'MATNR' }] },
        'YTEST_T01',
      ),
    ).toThrow(/first field must be a key/);
  });

  it('rejects a key field after a non-key field', () => {
    expect(() =>
      buildEccTablePayload(
        {
          ...baseArgs,
          fields: [
            { name: 'MANDT', key: true, data_element: 'MANDT' },
            { name: 'A', data_element: 'MATNR' },
            { name: 'B', key: true, data_element: 'WERKS_D' },
          ],
        },
        'YTEST_T01',
      ),
    ).toThrow(/must come before all non-key/);
  });

  it('rejects a reference field that is not in the table', () => {
    expect(() =>
      buildEccTablePayload(
        {
          ...baseArgs,
          fields: [
            { name: 'MANDT', key: true, data_element: 'MANDT' },
            { name: 'QTY', data_element: 'KWMENG', reference_field: 'NOPE' },
          ],
        },
        'YTEST_T01',
      ),
    ).toThrow(/not a field of YTEST_T01/);
  });

  it('rejects field names longer than 16 characters and duplicates', () => {
    const long = { name: 'ABCDEFGHIJKLMNOPQ', data_element: 'MATNR' };
    expect(() =>
      buildEccTablePayload(
        {
          ...baseArgs,
          fields: [{ name: 'MANDT', key: true, data_element: 'MANDT' }, long],
        },
        'YTEST_T01',
      ),
    ).toThrow(/max 16/);
    const dup = { name: 'mandt', data_element: 'MANDT' };
    expect(() =>
      buildEccTablePayload(
        {
          ...baseArgs,
          fields: [{ name: 'MANDT', key: true, data_element: 'MANDT' }, dup],
        },
        'YTEST_T01',
      ),
    ).toThrow(/Duplicate/);
  });

  it('needs a length for data types without a fixed length', () => {
    expect(() =>
      buildEccTablePayload(
        {
          ...baseArgs,
          fields: [
            { name: 'MANDT', key: true, data_element: 'MANDT' },
            { name: 'TXT', data_type: 'CHAR' },
          ],
        },
        'YTEST_T01',
      ),
    ).toThrow(/needs a length/);
  });
});

describe('handleCreateTable on ECC', () => {
  it('writes through ZMCP_ADT_DDIC_TABL and activates, without ADT', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockResolvedValue({ subrc: 0, message: '', result: {} });
    mockActivate.mockResolvedValue({ subrc: 0, message: '', result: {} });

    const res = await handleCreateTable(ctx, baseArgs as any);
    const body = JSON.parse(res.content[0].text);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTabl).toHaveBeenCalledWith(
      ctx.connection,
      'CREATE',
      expect.objectContaining({
        name: 'YTEST_T01',
        devclass: 'YTEST_PKG',
        transport: 'DEVK900001',
      }),
    );
    const sent = JSON.parse(mockTabl.mock.calls[0][2].payload_json);
    expect(sent.dd09l.TABART).toBe('APPL1');
    expect(mockActivate).toHaveBeenCalledWith(
      ctx.connection,
      'TABL',
      'YTEST_T01',
    );
    expect(body).toMatchObject({
      success: true,
      status: 'active',
      path: 'ecc-odata-rfc',
    });
  });

  it('reports activation warnings (rc=4) in the message', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockResolvedValue({ subrc: 0, message: '', result: {} });
    mockActivate.mockResolvedValue({
      subrc: 4,
      message: 'warnings',
      result: {},
    });

    const res = await handleCreateTable(ctx, baseArgs as any);
    const body = JSON.parse(res.content[0].text);
    expect(body.message).toMatch(/activation rc=4/);
  });

  it('skips activation when activate=false', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockResolvedValue({ subrc: 0, message: '', result: {} });

    const res = await handleCreateTable(ctx, {
      ...baseArgs,
      activate: false,
    } as any);
    const body = JSON.parse(res.content[0].text);
    expect(mockActivate).not.toHaveBeenCalled();
    expect(body.status).toBe('inactive');
  });

  it('still requires a transport for non-$TMP packages', async () => {
    process.env.SAP_VERSION = 'ECC';
    await expect(
      handleCreateTable(ctx, {
        ...baseArgs,
        transport_request: undefined,
      } as any),
    ).rejects.toThrow(/pass transport_request/);
    expect(mockTabl).not.toHaveBeenCalled();
    mockTabl.mockResolvedValue({ subrc: 0, message: '', result: {} });
    mockActivate.mockResolvedValue({ subrc: 0, message: '', result: {} });
    await handleCreateTable(ctx, {
      ...baseArgs,
      package_name: '$TMP',
      transport_request: undefined,
    } as any);
    expect(mockTabl).toHaveBeenCalledTimes(1);
  });
});
