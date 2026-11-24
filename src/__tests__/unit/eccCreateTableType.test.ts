/**
 * Unit tests for CreateTableType / DeleteTableType:
 * ECC branch (DD40V + DD42V through ZMCP_ADT_DDIC_TTYP) and the ADT branch.
 * SAP calls are mocked; object names are invented.
 */

import { callDdicActivate, callDdicTtyp } from '../../lib/rfcBackend';

jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/rfcBackend', () => {
  const actual = jest.requireActual('../../lib/rfcBackend');
  return { ...actual, callDdicTtyp: jest.fn(), callDdicActivate: jest.fn() };
});

import {
  buildEccTableTypePayload,
  handleCreateTableType,
} from '../../handlers/table_type/high/handleCreateTableType';
import { handleDeleteTableType } from '../../handlers/table_type/high/handleDeleteTableType';
import { createAdtClient } from '../../lib/clients';

const mockTtyp = callDdicTtyp as jest.Mock;
const mockActivate = callDdicActivate as jest.Mock;
const mockCreate = createAdtClient as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  jest.clearAllMocks();
});

const base = {
  table_type_name: 'ytest_tt01',
  description: 'Test table type',
  package_name: '$TMP',
  row_type: 'ytest_s01',
};

describe('buildEccTableTypePayload', () => {
  it('defaults to a standard table with the standard key', () => {
    const p = buildEccTableTypePayload(base);
    expect(p.dd40v).toMatchObject({
      TYPENAME: 'YTEST_TT01',
      ROWTYPE: 'YTEST_S01',
      ROWKIND: 'S',
      ACCESSMODE: 'T',
      KEYDEF: 'D',
      KEYKIND: 'N',
      DDTEXT: 'Test table type',
    });
    expect(p.dd42v).toEqual([]);
  });

  it('writes key components for a sorted unique table', () => {
    const p = buildEccTableTypePayload({
      ...base,
      access_type: 'sorted',
      key_definition: 'key_components',
      key_kind: 'unique',
      key_components: ['vbeln', 'posnr'],
    });
    expect(p.dd40v).toMatchObject({
      ACCESSMODE: 'S',
      KEYDEF: 'K',
      KEYKIND: 'U',
      KEYFDCOUNT: '0002',
    });
    expect(p.dd42v).toEqual([
      { TYPENAME: 'YTEST_TT01', KEYFDPOS: '0001', KEYFIELD: 'VBELN' },
      { TYPENAME: 'YTEST_TT01', KEYFDPOS: '0002', KEYFIELD: 'POSNR' },
    ]);
  });

  it('maps a data element row type and defaults hashed to unique', () => {
    const p = buildEccTableTypePayload({
      ...base,
      row_type: 'matnr',
      row_kind: 'data_element',
      access_type: 'hashed',
      key_definition: 'row_type',
    });
    expect(p.dd40v).toMatchObject({
      ROWKIND: 'E',
      ACCESSMODE: 'H',
      KEYDEF: 'T',
      KEYKIND: 'U',
    });
  });

  it('rejects inconsistent key settings', () => {
    expect(() =>
      buildEccTableTypePayload({
        ...base,
        access_type: 'hashed',
        key_kind: 'non_unique',
      }),
    ).toThrow(/unique/);
    expect(() =>
      buildEccTableTypePayload({ ...base, key_definition: 'key_components' }),
    ).toThrow(/needs key_components/);
    expect(() =>
      buildEccTableTypePayload({ ...base, key_components: ['VBELN'] }),
    ).toThrow(/only used with/);
    expect(() =>
      buildEccTableTypePayload({
        ...base,
        row_kind: 'data_element',
        key_definition: 'key_components',
        key_components: ['X'],
      }),
    ).toThrow(/structured row type/);
    expect(() =>
      buildEccTableTypePayload({ ...base, row_kind: 'bad' as any }),
    ).toThrow(/row_kind/);
  });
});

describe('handleCreateTableType', () => {
  it('ECC: writes through ZMCP_ADT_DDIC_TTYP and activates TTYP', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTtyp.mockResolvedValue({ subrc: 0, message: '', result: {} });
    mockActivate.mockResolvedValue({ subrc: 0, message: '', result: {} });
    const res = await handleCreateTableType(ctx, base as any);
    const body = JSON.parse(res.content[0].text);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTtyp).toHaveBeenCalledWith(
      ctx.connection,
      'CREATE',
      expect.objectContaining({ name: 'YTEST_TT01', devclass: '$TMP' }),
    );
    expect(
      JSON.parse(mockTtyp.mock.calls[0][2].payload_json).dd40v.ROWTYPE,
    ).toBe('YTEST_S01');
    expect(mockActivate).toHaveBeenCalledWith(
      ctx.connection,
      'TTYP',
      'YTEST_TT01',
    );
    expect(body).toMatchObject({
      success: true,
      status: 'active',
      path: 'ecc-odata-rfc',
    });
  });

  it('requires a transport for transportable packages', async () => {
    process.env.SAP_VERSION = 'ECC';
    await expect(
      handleCreateTableType(ctx, { ...base, package_name: 'YPKG' } as any),
    ).rejects.toThrow(/transport_request/);
    expect(mockTtyp).not.toHaveBeenCalled();
  });

  it('S/4: creates and updates through the ADT client', async () => {
    process.env.SAP_VERSION = 'S4';
    const create = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    mockCreate.mockReturnValue({ getTableType: () => ({ create, update }) });
    const res = await handleCreateTableType(ctx, {
      ...base,
      access_type: 'sorted',
    } as any);
    expect(JSON.parse(res.content[0].text).success).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tableTypeName: 'YTEST_TT01',
        rowTypeName: 'YTEST_S01',
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'sorted',
        primaryKeyDefinition: 'standard',
      }),
      { activateOnUpdate: true },
    );
    expect(mockTtyp).not.toHaveBeenCalled();
  });

  it('S/4: rejects key components (not on the ADT path)', async () => {
    process.env.SAP_VERSION = 'S4';
    await expect(
      handleCreateTableType(ctx, {
        ...base,
        key_definition: 'key_components',
        key_components: ['VBELN'],
      } as any),
    ).rejects.toThrow(/not supported on the ADT path/);
  });
});

describe('handleDeleteTableType', () => {
  it('ECC: deletes through ZMCP_ADT_DDIC_TTYP', async () => {
    process.env.SAP_VERSION = 'ECC';
    mockTtyp.mockResolvedValue({ subrc: 0, message: '', result: {} });
    const res: any = await handleDeleteTableType(ctx, {
      table_type_name: 'ytest_tt01',
    });
    expect(mockTtyp).toHaveBeenCalledWith(ctx.connection, 'DELETE', {
      name: 'YTEST_TT01',
      transport: undefined,
    });
    expect(JSON.parse(res.content[0].text).path).toBe('ecc-odata-rfc');
  });

  it('S/4: deletes through the ADT client', async () => {
    process.env.SAP_VERSION = 'S4';
    const del = jest.fn().mockResolvedValue({});
    mockCreate.mockReturnValue({ getTableType: () => ({ delete: del }) });
    await handleDeleteTableType(ctx, {
      table_type_name: 'YTEST_TT01',
      transport_request: 'K1',
    });
    expect(del).toHaveBeenCalledWith({
      tableTypeName: 'YTEST_TT01',
      transportRequest: 'K1',
    });
  });
});
