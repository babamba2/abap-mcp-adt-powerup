/**
 * Unit tests for src/lib/ncoRfc.ts — NCo backend transport (no SAP, no NCo):
 * FunctionImport → FM mapping, FM_PROXY wrapping, env → logon params.
 */

import { rfcConnectionTypeFromEnv } from '../../lib/connectionType';
import {
  __setNcoClientFactory,
  isNcoBackend,
  ncoFunctionImport,
  ncoParamsFromEnv,
} from '../../lib/ncoRfc';
import { findRemovedTransport } from '../../lib/removedTransports';

type Call = { fm: string; params: Record<string, unknown> };

function fakeClient(reply: (c: Call) => Record<string, any>) {
  const calls: Call[] = [];
  let opened = 0;
  __setNcoClientFactory(() => ({
    alive: true,
    open: async () => {
      opened++;
    },
    close: async () => undefined,
    call: async (fm, params = {}) => {
      calls.push({ fm, params });
      return reply({ fm, params });
    },
  }));
  return { calls, opened: () => opened };
}

const ENV = {
  SAP_URL: 'http://saphost.example:8010',
  SAP_CLIENT: '300',
  SAP_USERNAME: 'DEVUSER',
  SAP_PASSWORD: 'secret',
};

describe('ncoRfc', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env = { ...saved, ...ENV, SAP_RFC_BACKEND: 'nco' };
  });
  afterAll(() => {
    process.env = saved;
    __setNcoClientFactory(null);
  });

  it('isNcoBackend reads SAP_RFC_BACKEND', () => {
    expect(isNcoBackend({ SAP_RFC_BACKEND: ' NCO ' })).toBe(true);
    expect(isNcoBackend({ SAP_RFC_BACKEND: 'odata' })).toBe(false);
    expect(isNcoBackend({})).toBe(false);
  });

  it('derives ashost / sysnr from SAP_URL (80XX → XX)', () => {
    expect(ncoParamsFromEnv(ENV)).toEqual({
      ashost: 'saphost.example',
      sysnr: '10',
      client: '300',
      user: 'DEVUSER',
      passwd: 'secret',
      lang: 'EN',
    });
  });

  it('SAP_NCO_* override the derived values', () => {
    const p = ncoParamsFromEnv({
      ...ENV,
      SAP_URL: 'https://webdisp.example:44300',
      SAP_NCO_ASHOST: 'appsrv',
      SAP_NCO_SYSNR: '00',
      SAP_NCO_LANG: 'KO',
    });
    expect(p).toMatchObject({ ashost: 'appsrv', sysnr: '00', lang: 'KO' });
  });

  it('names every missing setting', () => {
    expect(() =>
      ncoParamsFromEnv({ SAP_URL: 'https://webdisp.example:44300' }),
    ).toThrow(/SAP_NCO_SYSNR.*SAP_CLIENT.*SAP_USERNAME.*SAP_PASSWORD/);
  });

  it('calls remote-enabled FMs directly with the IV_* params', async () => {
    const f = fakeClient(() => ({
      EV_SUBRC: 0,
      EV_MESSAGE: '',
      EV_RESULT: '{}',
    }));
    const r = await ncoFunctionImport('Dispatch', {
      IV_ACTION: 'TABLE_READ',
      IV_PARAMS: '{}',
    });
    expect(r.EV_SUBRC).toBe(0);
    expect(f.calls).toEqual([
      {
        fm: 'ZMCP_ADT_DISPATCH',
        params: { IV_ACTION: 'TABLE_READ', IV_PARAMS: '{}' },
      },
    ]);
    await ncoFunctionImport('DdicActivate', { IV_TYPE: 'TABL', IV_NAME: 'ZT' });
    expect(f.calls[1].fm).toBe('ZMCP_ADT_DDIC_ACTIVATE');
    expect(f.opened()).toBe(1); // one logon, reused
  });

  it('wraps non-remote FMs in ZMCP_ADT_DISPATCH FM_PROXY and unwraps the exports', async () => {
    const f = fakeClient(({ params }) => {
      const body = JSON.parse(String(params.IV_PARAMS));
      expect(body).toEqual({
        fm: 'ZMCP_ADT_DDIC_TTYP',
        params: [
          { name: 'IV_ACTION', value: 'CREATE' },
          { name: 'IV_NAME', value: 'ZTT' },
        ],
      });
      return {
        EV_SUBRC: 0,
        EV_MESSAGE: '',
        EV_RESULT: JSON.stringify({
          EV_SUBRC: 0,
          EV_MESSAGE: 'ok',
          EV_RESULT: '{"a":1}',
        }),
      };
    });
    const r = await ncoFunctionImport('DdicTtyp', {
      IV_ACTION: 'CREATE',
      IV_NAME: 'ZTT',
    });
    expect(f.calls[0].fm).toBe('ZMCP_ADT_DISPATCH');
    expect(f.calls[0].params.IV_ACTION).toBe('FM_PROXY');
    expect(r).toEqual({ EV_SUBRC: 0, EV_MESSAGE: 'ok', EV_RESULT: '{"a":1}' });
  });

  it('points to setup when the dispatcher has no FM_PROXY yet', async () => {
    fakeClient(() => ({
      EV_SUBRC: 4,
      EV_MESSAGE: 'Unknown action: FM_PROXY',
      EV_RESULT: '',
    }));
    await expect(
      ncoFunctionImport('DdicTablRead', { IV_NAME: 'MARA', IV_VERSION: 'A' }),
    ).rejects.toThrow(/predates FM_PROXY; reinstall it via \/sc4sap:setup/);
  });

  it('refuses an unmapped FunctionImport', async () => {
    fakeClient(() => ({}));
    await expect(ncoFunctionImport('Nope', {})).rejects.toThrow(
      /no function module mapped for 'Nope'/,
    );
  });
});

describe('connection type', () => {
  it('SAP_CONNECTION_TYPE=nco maps to the RFC connection; others stay HTTP', () => {
    expect(rfcConnectionTypeFromEnv({ SAP_CONNECTION_TYPE: 'nco' })).toBe(
      'rfc',
    );
    expect(rfcConnectionTypeFromEnv({ SAP_CONNECTION_TYPE: ' NCO ' })).toBe(
      'rfc',
    );
    expect(
      rfcConnectionTypeFromEnv({ SAP_CONNECTION_TYPE: 'http' }),
    ).toBeUndefined();
    expect(rfcConnectionTypeFromEnv({})).toBeUndefined();
  });

  it('nco is not a removed transport; rfc still is', () => {
    expect(
      findRemovedTransport({
        SAP_CONNECTION_TYPE: 'nco',
        SAP_RFC_BACKEND: 'nco',
      }),
    ).toBeNull();
    expect(findRemovedTransport({ SAP_CONNECTION_TYPE: 'rfc' })).toMatch(
      /was removed/,
    );
  });
});
