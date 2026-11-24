/**
 * Unit tests for the ECC fallback of CreateStructure:
 * DD02V (TABCLASS INTTAB) + DD03P through ZMCP_ADT_DDIC_TABL.
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

import {
  buildEccStructurePayload,
  handleCreateStructure,
} from '../../handlers/structure/high/handleCreateStructure';
import { handleDeleteStructure } from '../../handlers/structure/high/handleDeleteStructure';
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
  structure_name: 'ytest_s01',
  description: 'Test structure',
  package_name: '$TMP',
  fields: [
    { name: 'bukrs', data_element: 'BUKRS' },
    { name: 'line_count', data_type: 'INT4' },
    {
      name: 'amount',
      data_element: 'DMSOL',
      reference_field: 'HWAER',
    },
    { name: 'hwaer', data_element: 'HWAER' },
  ],
};

describe('buildEccStructurePayload', () => {
  it('builds an INTTAB header and one DD03P row per field', () => {
    const { dd02v, dd03p } = buildEccStructurePayload(
      baseArgs as any,
      'YTEST_S01',
    );
    expect(dd02v).toMatchObject({
      TABNAME: 'YTEST_S01',
      TABCLASS: 'INTTAB',
      DDTEXT: 'Test structure',
      EXCLASS: '1',
    });
    expect(dd03p).toHaveLength(4);
    expect(dd03p[0]).toMatchObject({
      FIELDNAME: 'BUKRS',
      POSITION: '0001',
      ROLLNAME: 'BUKRS',
      COMPTYPE: 'E',
    });
    expect(dd03p[1]).toMatchObject({
      FIELDNAME: 'LINE_COUNT',
      DATATYPE: 'INT4',
      LENG: '000010',
      DECIMALS: '000000',
    });
    expect(dd03p[1].ROLLNAME).toBeUndefined();
    expect(dd03p[2]).toMatchObject({
      REFTABLE: 'YTEST_S01',
      REFFIELD: 'HWAER',
    });
  });

  it('types components by structure and table type', () => {
    const { dd03p } = buildEccStructurePayload(
      {
        ...baseArgs,
        fields: [
          { name: 'addr', structure_ref: 'ysub_s' },
          { name: 'lines', table_ref: 'ysub_t' },
        ],
      } as any,
      'YTEST_S01',
    );
    expect(dd03p[0]).toMatchObject({ ROLLNAME: 'YSUB_S', COMPTYPE: 'S' });
    expect(dd03p[1]).toMatchObject({ ROLLNAME: 'YSUB_T', COMPTYPE: 'L' });
  });

  it('appends includes as .INCLUDE rows and sets enhancement category 4', () => {
    const p = buildEccStructurePayload(
      { ...baseArgs, includes: [{ name: 'yinc' }] } as any,
      'YTEST_S01',
    );
    const last = p.dd03p[p.dd03p.length - 1];
    expect(last).toMatchObject({
      FIELDNAME: '.INCLUDE',
      PRECFIELD: 'YINC',
      COMPTYPE: 'S',
      DATATYPE: 'STRU',
      POSITION: String(p.dd03p.length).padStart(4, '0'),
    });
    expect(p.dd02v.EXCLASS).toBe('4');
  });

  it('defaults the enhancement category to 1 for flat structures, 4 with structure_ref', () => {
    expect(
      buildEccStructurePayload(baseArgs as any, 'YTEST_S01').dd02v.EXCLASS,
    ).toBe('1');
    const nested = {
      ...baseArgs,
      fields: [{ name: 'SUB', structure_ref: 'YSUB_S' }],
    };
    expect(
      buildEccStructurePayload(nested as any, 'YTEST_S01').dd02v.EXCLASS,
    ).toBe('4');
    expect(
      buildEccStructurePayload(
        { ...nested, enhancement_category: '3' } as any,
        'YTEST_S01',
      ).dd02v.EXCLASS,
    ).toBe('3');
    expect(() =>
      buildEccStructurePayload(
        { ...baseArgs, enhancement_category: 'x' } as any,
        'YTEST_S01',
      ),
    ).toThrow(/enhancement_category/);
  });

  it('rejects include suffixes, domains and lengthless CHAR', () => {
    expect(() =>
      buildEccStructurePayload(
        { ...baseArgs, includes: [{ name: 'YINC', suffix: '_X' }] } as any,
        'YTEST_S01',
      ),
    ).toThrow(/suffix/);
    expect(() =>
      buildEccStructurePayload(
        { ...baseArgs, fields: [{ name: 'f1', domain: 'CHAR10' }] } as any,
        'YTEST_S01',
      ),
    ).toThrow(/domain/);
    expect(() =>
      buildEccStructurePayload(
        { ...baseArgs, fields: [{ name: 'f1', data_type: 'CHAR' }] } as any,
        'YTEST_S01',
      ),
    ).toThrow(/needs a length/);
  });
});

describe('CreateStructure on ECC', () => {
  it('writes through DdicTabl and activates as TABL', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockResolvedValue({ subrc: 0, message: 'staged', result: {} });
    mockActivate.mockResolvedValue({ subrc: 4, message: 'warn', result: {} });

    const res = await handleCreateStructure(ctx, baseArgs as any);
    const body = JSON.parse(res.content[0].text);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTabl).toHaveBeenCalledWith(
      ctx.connection,
      'CREATE',
      expect.objectContaining({ name: 'YTEST_S01', devclass: '$TMP' }),
    );
    const payload = JSON.parse(mockTabl.mock.calls[0][2].payload_json);
    expect(payload.dd02v.TABCLASS).toBe('INTTAB');
    expect(mockActivate).toHaveBeenCalledWith(
      ctx.connection,
      'TABL',
      'YTEST_S01',
    );
    expect(body).toMatchObject({
      success: true,
      path: 'ecc-odata-rfc',
      activation_rc: 4,
    });
  });

  it('skips activation when activate=false', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockResolvedValue({ subrc: 0, message: 'staged', result: {} });

    await handleCreateStructure(ctx, { ...baseArgs, activate: false } as any);
    expect(mockActivate).not.toHaveBeenCalled();
  });
});

describe('handleDeleteStructure on ECC', () => {
  it('deletes through ZMCP_ADT_DDIC_TABL without ADT', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockResolvedValue({ subrc: 0, message: '', result: {} });
    const res: any = await handleDeleteStructure(ctx, {
      structure_name: 'ytest_s01',
    });
    const body = JSON.parse(res.content[0].text);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTabl).toHaveBeenCalledWith(ctx.connection, 'DELETE', {
      name: 'YTEST_S01',
      transport: undefined,
    });
    expect(body).toMatchObject({ success: true, path: 'ecc-odata-rfc' });
  });

  it('returns an error result when the FM fails', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTabl.mockRejectedValue(new Error('boom'));
    const res: any = await handleDeleteStructure(ctx, {
      structure_name: 'YTEST_S01',
    });
    expect(res.isError).toBe(true);
  });
});
