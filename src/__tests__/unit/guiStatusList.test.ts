/**
 * GetGuiStatusList / CreateGuiStatus (ECC path).
 *
 * On BASIS 7.40 a CUA written through the dispatcher (CUA_WRITE) does not
 * show up as PROG/PC nodes in /sap/bc/adt/repository/objectstructure, so the
 * list falls back to the CUA_FETCH STA rows. Payloads are trimmed real shapes
 * with invented names.
 */

import { handleCreateGuiStatus } from '../../handlers/gui_status/high/handleCreateGuiStatus';
import {
  handleGetGuiStatusList,
  parseStatusesFromStructure,
  statusesFromCua,
} from '../../handlers/gui_status/readonly/handleGetGuiStatusList';
import { createAdtClient } from '../../lib/clients';
import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/rfcBackend', () => ({ callDispatch: jest.fn() }));
jest.mock('../../lib/utils', () => {
  const actual = jest.requireActual('../../lib/utils');
  return {
    ...actual,
    isCloudConnection: () => false,
    makeAdtRequestWithTimeout: jest.fn(),
  };
});

const PE = 'xmlns:projectexplorer="http://www.sap.com/adt/projectexplorer"';
// Program without PROG/PC nodes (CUA written by the dispatcher).
const STRUCT_NO_PC = `<?xml version="1.0" encoding="utf-8"?><projectexplorer:objectstructure ${PE}><projectexplorer:node nodeid="000002" parentid="000001" isfolder="true" description="Fields" objecttype="PROG/PD"/><projectexplorer:node nodeid="000003" parentid="000002" isfolder="false" description="OK_CODE" objecttype="PROG/PD" objectname="ZTEST_PROG01"/></projectexplorer:objectstructure>`;
// Program with a GUI Status folder + two statuses.
const STRUCT_PC = `<?xml version="1.0" encoding="utf-8"?><projectexplorer:objectstructure ${PE}><projectexplorer:node nodeid="000022" parentid="000001" isfolder="true" description="GUI Status" objecttype="PROG/PC"/><projectexplorer:node nodeid="000023" parentid="000022" isfolder="false" description="CTX_MENU_1" objecttype="PROG/PC" objectname="ZTEST_PROG02"/><projectexplorer:node nodeid="000026" parentid="000022" isfolder="false" description="SCREEN_100" objecttype="PROG/PC" objectname="ZTEST_PROG02"/></projectexplorer:objectstructure>`;

const CUA = {
  ADM: { PFKCODE: '0001' },
  STA: [
    {
      CODE: 'STATUS_0100',
      MODAL: 'D',
      PFKCODE: '0001',
      INT_NOTE: 'Main status',
    },
    { CODE: 'POPUP_0200', MODAL: 'P', INT_NOTE: '' },
  ],
  TIT: [{ CODE: 'STATUS_0100', TEXT: 'Title' }],
};

const ctx = { connection: {} as any, logger: undefined } as any;

function mockStructure(xml: string | Error) {
  (createAdtClient as jest.Mock).mockReturnValue({
    getUtils: () => ({
      getObjectStructure: async () => {
        if (xml instanceof Error) throw xml;
        return { data: xml };
      },
    }),
  });
}

const body = (r: any) => JSON.parse(r.content[0].text);

beforeEach(() => {
  (callDispatch as jest.Mock).mockReset();
});

describe('GetGuiStatusList parsing', () => {
  it('reads PROG/PC leaf nodes and skips the folder', () => {
    expect(parseStatusesFromStructure(STRUCT_PC)).toEqual([
      { status_name: 'CTX_MENU_1' },
      { status_name: 'SCREEN_100' },
    ]);
    expect(parseStatusesFromStructure(STRUCT_NO_PC)).toEqual([]);
  });

  it('derives entries from CUA_FETCH STA rows', () => {
    expect(statusesFromCua(CUA)).toEqual([
      {
        status_name: 'STATUS_0100',
        description: 'Main status',
        status_type: 'D',
      },
      { status_name: 'POPUP_0200', status_type: 'P' },
    ]);
    expect(statusesFromCua({})).toEqual([]);
  });
});

describe('handleGetGuiStatusList', () => {
  it('uses the ADT structure when it lists statuses (no dispatcher call)', async () => {
    mockStructure(STRUCT_PC);
    const r = body(
      await handleGetGuiStatusList(ctx, { program_name: 'ztest_prog02' }),
    );
    expect(r.total_statuses).toBe(2);
    expect(r.source).toBe('adt_object_structure');
    expect(callDispatch).not.toHaveBeenCalled();
  });

  it('falls back to CUA_FETCH when the ADT structure has no PROG/PC nodes', async () => {
    mockStructure(STRUCT_NO_PC);
    (callDispatch as jest.Mock).mockResolvedValue({ result: CUA });
    const r = body(
      await handleGetGuiStatusList(ctx, { program_name: 'ZTEST_PROG01' }),
    );
    expect(callDispatch).toHaveBeenCalledWith(expect.anything(), 'CUA_FETCH', {
      program: 'ZTEST_PROG01',
    });
    expect(r.source).toBe('cua_fetch');
    expect(r.total_statuses).toBe(2);
    expect(r.statuses[0].status_name).toBe('STATUS_0100');
  });

  it('falls back to CUA_FETCH when the structure call fails (non-404)', async () => {
    const err: any = new Error('boom');
    err.response = { status: 500 };
    mockStructure(err);
    (callDispatch as jest.Mock).mockResolvedValue({ result: CUA });
    const r = body(
      await handleGetGuiStatusList(ctx, { program_name: 'ZTEST_PROG01' }),
    );
    expect(r.source).toBe('cua_fetch');
  });

  it('returns an empty list with a note when there is no dispatcher', async () => {
    mockStructure(STRUCT_NO_PC);
    (callDispatch as jest.Mock).mockRejectedValue(
      new Error('dispatcher not installed'),
    );
    const r = body(
      await handleGetGuiStatusList(ctx, { program_name: 'ZTEST_PROG01' }),
    );
    expect(r.total_statuses).toBe(0);
    expect(r.notes[0]).toMatch(/CUA_FETCH fallback unavailable/);
  });

  it('keeps the not-found error for a 404 from ADT', async () => {
    const err: any = new Error('404');
    err.response = { status: 404 };
    mockStructure(err);
    const r: any = await handleGetGuiStatusList(ctx, { program_name: 'ZNOPE' });
    expect(r.isError).toBe(true);
    expect(callDispatch).not.toHaveBeenCalled();
  });
});

describe('handleCreateGuiStatus MODAL', () => {
  async function created(status_type?: string) {
    (callDispatch as jest.Mock).mockImplementation(
      async (_c: any, action: string) =>
        action === 'CUA_FETCH' ? { result: { STA: [] } } : { result: {} },
    );
    const r = body(
      await handleCreateGuiStatus(ctx, {
        program_name: 'ZTEST_PROG01',
        status_name: 'STATUS_0100',
        description: 'Main status',
        ...(status_type ? { status_type } : {}),
      }),
    );
    const write = (callDispatch as jest.Mock).mock.calls.find(
      (c) => c[1] === 'CUA_WRITE',
    );
    const cua = JSON.parse(write[2].cua_data);
    return { r, row: cua.STA[0] };
  }

  it.each([
    [undefined, 'D', 'N'],
    ['N', 'D', 'N'],
    ['P', 'P', 'P'],
    ['C', 'C', 'C'],
  ])('status_type %s -> MODAL %s', async (input, modal, echoed) => {
    const { r, row } = await created(input);
    expect(row.MODAL).toBe(modal);
    expect(row.INT_NOTE).toBe('Main status');
    expect(r.status_type).toBe(echoed);
    expect(r.modal).toBe(modal);
  });
});
