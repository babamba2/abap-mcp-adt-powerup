/**
 * Unit tests for the BASIS 7.31 fallbacks: GetWhereUsed through
 * ZMCP_ADT_DISPATCH, DDIC readers over SOAP RFC.
 * SAP calls are mocked; object names are invented.
 */

import { createAdtClient } from '../../lib/clients';
import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/getObjectsListCache', () => ({
  objectsListCache: { setCache: jest.fn() },
}));
jest.mock('../../lib/rfcBackend', () => {
  const actual = jest.requireActual('../../lib/rfcBackend');
  return { ...actual, callDispatch: jest.fn() };
});

import {
  handleGetWhereUsed,
  needsDispatchWhereUsed,
} from '../../handlers/system/readonly/handleGetWhereUsed';

const mockCreate = createAdtClient as jest.Mock;
const mockDispatch = callDispatch as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  jest.clearAllMocks();
});

describe('GetWhereUsed on BASIS 7.31', () => {
  it('needs the dispatch path only below 7.40', () => {
    process.env.ABAP_RELEASE = '731';
    expect(needsDispatchWhereUsed()).toBe(true);
    process.env.ABAP_RELEASE = '740';
    expect(needsDispatchWhereUsed()).toBe(false);
  });

  it('maps WHERE_USED dispatch rows and skips ADT', async () => {
    process.env.ABAP_RELEASE = '731';
    mockCreate.mockReturnValue({ getUtils: () => ({}) });
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: '2 referencing object(s)',
      result: {
        references: [
          {
            name: 'ZDEMO_REPORT',
            type: 'PROG/P',
            include: 'ZDEMO_REPORT_F01',
            package_name: 'ZDEMO',
          },
          { name: 'ZDEMO_TAB', type: 'TABL/DT', usage: 'DDIC field type' },
        ],
        count: 2,
      },
    });

    const res: any = await handleGetWhereUsed(ctx, {
      object_name: 'zdemo_dtel',
      object_type: 'dataelement',
    });

    expect(res.isError).toBe(false);
    expect(mockDispatch).toHaveBeenCalledWith(ctx.connection, 'WHERE_USED', {
      object_name: 'zdemo_dtel',
      object_type: 'dataelement',
    });
    const json = res.content[0].json;
    expect(json.object_name).toBe('ZDEMO_DTEL');
    expect(json.total_references).toBe(2);
    expect(json.references).toEqual([
      expect.objectContaining({
        name: 'ZDEMO_REPORT',
        type: 'PROG/P',
        package_name: 'ZDEMO',
        usage_information: 'include ZDEMO_REPORT_F01',
      }),
      expect.objectContaining({
        name: 'ZDEMO_TAB',
        type: 'TABL/DT',
        usage_information: 'DDIC field type',
      }),
    ]);
  });

  it('still applies customer_only to dispatch rows', async () => {
    process.env.ABAP_RELEASE = '731';
    mockCreate.mockReturnValue({ getUtils: () => ({}) });
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: '',
      result: {
        references: [
          { name: 'ZDEMO_REPORT', type: 'PROG/P', package_name: 'ZDEMO' },
          { name: 'SAPLSTANDARD', type: 'FUGR/F', package_name: 'SBASE' },
        ],
      },
    });

    const res: any = await handleGetWhereUsed(ctx, {
      object_name: 'ZDEMO_CLASS',
      object_type: 'class',
      customer_only: true,
    } as any);

    expect(res.content[0].json.references.map((r: any) => r.name)).toEqual([
      'ZDEMO_REPORT',
    ]);
  });
});

describe('DDIC readers over SOAP RFC', () => {
  it('routes the readers to the soap backend', async () => {
    process.env.SAP_RFC_BACKEND = 'soap';
    const { callDdicTablRead } = jest.requireActual('../../lib/rfcBackend');
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({
        data: `<?xml version="1.0"?><soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"><soap-env:Body><n0:ZMCP_ADT_DDIC_TABL_READ.Response xmlns:n0="urn:sap-com:document:sap:rfc:functions"><EV_MESSAGE>ok</EV_MESSAGE><EV_RESULT>{"name":"ZDEMO_TAB","kind":"TABL"}</EV_RESULT><EV_SUBRC>0</EV_SUBRC></n0:ZMCP_ADT_DDIC_TABL_READ.Response></soap-env:Body></soap-env:Envelope>`,
      }),
    } as any;
    const out = await callDdicTablRead(connection, { name: 'ZDEMO_TAB' });
    expect(out).toEqual({
      subrc: 0,
      message: 'ok',
      result: { name: 'ZDEMO_TAB', kind: 'TABL' },
    });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/sap/bc/soap/rfc'),
      }),
    );
  });

  it('decodes numeric character references in EV_RESULT', async () => {
    process.env.SAP_RFC_BACKEND = 'soap';
    const { callDdicTablRead } = jest.requireActual('../../lib/rfcBackend');
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({
        data: `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><urn:ZMCP_ADT_DDIC_TABL_READ.Response xmlns:urn="urn:sap-com:document:sap:rfc:functions"><EV_MESSAGE>ok</EV_MESSAGE><EV_RESULT>{&#34;name&#34;:&#34;ZDEMO_TAB&#34;,&#34;text&#34;:&#34;A &amp; B&#34;}</EV_RESULT><EV_SUBRC>0</EV_SUBRC></urn:ZMCP_ADT_DDIC_TABL_READ.Response></SOAP-ENV:Body></SOAP-ENV:Envelope>`,
      }),
    } as any;
    const out = await callDdicTablRead(connection, { name: 'ZDEMO_TAB' });
    expect(out.result).toEqual({ name: 'ZDEMO_TAB', text: 'A & B' });
  });

  it('keeps writers OData-only', () => {
    process.env.SAP_RFC_BACKEND = 'soap';
    const { callDdicTabl } = jest.requireActual('../../lib/rfcBackend');
    expect(() => callDdicTabl({} as any, {} as any)).toThrow(
      /requires SAP_RFC_BACKEND=odata/,
    );
  });
});
