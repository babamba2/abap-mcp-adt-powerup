/**
 * GetTcodeUsage / GetJobUsage on S/4HANA: the FM_PROXY route of
 * ZMCP_ADT_DISPATCH (lib/wlUsageS4) and the handler switch between the ECC
 * bridge and the S/4 route. The backend is mocked; no SAP call is made.
 */

const callDispatch = jest.fn();
const callWlTcodeUsage = jest.fn();
const callWlJobUsage = jest.fn();
jest.mock('../../lib/rfcBackend', () => ({
  callDispatch: (...args: unknown[]) => callDispatch(...args),
  callWlTcodeUsage: (...args: unknown[]) => callWlTcodeUsage(...args),
  callWlJobUsage: (...args: unknown[]) => callWlJobUsage(...args),
  eccBridgePath: () => 'ecc-odata-rfc',
}));

import { handleGetJobUsage } from '../../handlers/system/readonly/handleGetJobUsage';
import { handleGetTcodeUsage } from '../../handlers/system/readonly/handleGetTcodeUsage';
import {
  callWlJobUsageS4,
  callWlTcodeUsageS4,
  explainProxyError,
  isEccSystem,
} from '../../lib/wlUsageS4';

const conn = {} as any;
const ctx = { connection: conn, logger: undefined } as any;
const savedVersion = process.env.SAP_VERSION;
const savedDest = process.env.SAP_USAGE_RFCDEST;

/** What FM_PROXY returns for the tcode FM (exports as one JSON object). */
function tcodeAnswer(over: Record<string, unknown> = {}) {
  return {
    result: {
      EV_SUBRC: 0,
      EV_MESSAGE: 'Workload data covers all 12 months',
      EV_COVERAGE: 12,
      EV_RESULT: '{"VA01":true,"ZUNUSED":false}',
      EV_SYSID: 'S4H',
      ...over,
    },
    subrc: 0,
    message: '',
  };
}

function bodyOf(res: any) {
  return JSON.parse(res.content[0].text);
}

beforeEach(() => {
  callDispatch.mockReset();
  callWlTcodeUsage.mockReset();
  callWlJobUsage.mockReset();
  delete process.env.SAP_USAGE_RFCDEST;
});
afterEach(() => {
  if (savedVersion === undefined) delete process.env.SAP_VERSION;
  else process.env.SAP_VERSION = savedVersion;
  if (savedDest === undefined) delete process.env.SAP_USAGE_RFCDEST;
  else process.env.SAP_USAGE_RFCDEST = savedDest;
});

describe('wlUsageS4 — FM_PROXY route', () => {
  it('only SAP_VERSION=ECC counts as ECC', () => {
    expect(isEccSystem({ SAP_VERSION: 'ecc' } as any)).toBe(true);
    expect(isEccSystem({ SAP_VERSION: 'S4' } as any)).toBe(false);
    expect(isEccSystem({} as any)).toBe(false);
  });

  it('calls ZMCP_WL_TCODE_USAGE through FM_PROXY with string params', async () => {
    callDispatch.mockResolvedValue(tcodeAnswer());
    const r = await callWlTcodeUsageS4(conn, {
      tcodes: ['VA01', 'ZUNUSED'],
      months: 12,
      rfcdest: 'QAS_RFC',
    });
    expect(callDispatch).toHaveBeenCalledTimes(1);
    const [c, action, params] = callDispatch.mock.calls[0];
    expect(c).toBe(conn);
    expect(action).toBe('FM_PROXY');
    expect(params).toEqual({
      fm: 'ZMCP_WL_TCODE_USAGE',
      params: [
        { name: 'IV_TCODES', value: 'VA01,ZUNUSED' },
        { name: 'IV_MONTHS', value: '12' },
        { name: 'IV_RFCDEST', value: 'QAS_RFC' },
      ],
    });
    expect(r).toEqual({
      subrc: 0,
      message: 'Workload data covers all 12 months',
      coverage: 12,
      result: { VA01: true, ZUNUSED: false },
      sysid: 'S4H',
    });
  });

  it('sends an empty destination as an empty string and defaults the window', async () => {
    callDispatch.mockResolvedValue(tcodeAnswer());
    await callWlTcodeUsageS4(conn, { tcodes: ['VA01'] });
    expect(callDispatch.mock.calls[0][2].params).toEqual([
      { name: 'IV_TCODES', value: 'VA01' },
      { name: 'IV_MONTHS', value: '12' },
      { name: 'IV_RFCDEST', value: '' },
    ]);
  });

  it('returns subrc 4 (no workload rows) as an answer, throws on subrc >= 8', async () => {
    callDispatch.mockResolvedValueOnce(
      tcodeAnswer({
        EV_SUBRC: 4,
        EV_COVERAGE: 0,
        EV_MESSAGE: 'No workload rows in the requested months - usage unknown',
        EV_RESULT: '{"VA01":false}',
      }),
    );
    const r = await callWlTcodeUsageS4(conn, { tcodes: ['VA01'] });
    expect(r.subrc).toBe(4);
    expect(r.coverage).toBe(0);
    expect(r.result).toEqual({ VA01: false });

    callDispatch.mockResolvedValueOnce(
      tcodeAnswer({ EV_SUBRC: 12, EV_MESSAGE: 'RFC destination X failed' }),
    );
    await expect(
      callWlTcodeUsageS4(conn, { tcodes: ['VA01'], rfcdest: 'X' }),
    ).rejects.toThrow(/ZMCP_WL_TCODE_USAGE error \(subrc=12\).*destination X/);
  });

  it('survives a result that is not JSON', async () => {
    callDispatch.mockResolvedValue(tcodeAnswer({ EV_RESULT: 'garbage' }));
    const r = await callWlTcodeUsageS4(conn, { tcodes: ['VA01'] });
    expect(r.result).toEqual({});
  });

  it('calls ZMCP_WL_JOB_USAGE through FM_PROXY', async () => {
    callDispatch.mockResolvedValue({
      result: {
        EV_SUBRC: 0,
        EV_MESSAGE: 'Job history covers the whole window since 20251101',
        EV_OLDEST: '20240105',
        EV_RESULT: '{"ZREP1":true,"ZREP2":false}',
      },
      subrc: 0,
      message: '',
    });
    const r = await callWlJobUsageS4(conn, {
      programs: ['ZREP1', 'ZREP2'],
      months: 13,
    });
    expect(callDispatch.mock.calls[0][1]).toBe('FM_PROXY');
    expect(callDispatch.mock.calls[0][2]).toEqual({
      fm: 'ZMCP_WL_JOB_USAGE',
      params: [
        { name: 'IV_PROGRAMS', value: 'ZREP1,ZREP2' },
        { name: 'IV_MONTHS', value: '13' },
      ],
    });
    expect(r.oldest).toBe('20240105');
    expect(r.result).toEqual({ ZREP1: true, ZREP2: false });
  });

  it('names the missing piece when the dispatcher or the FM is not installed', async () => {
    callDispatch.mockRejectedValueOnce(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=FM_PROXY, subrc=4): Unknown action: FM_PROXY',
      ),
    );
    await expect(
      callWlTcodeUsageS4(conn, { tcodes: ['VA01'] }),
    ).rejects.toThrow(/predates FM_PROXY/);

    callDispatch.mockRejectedValueOnce(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=FM_PROXY, subrc=4): FM_PROXY: ZMCP_WL_JOB_USAGE is not installed on this system',
      ),
    );
    await expect(
      callWlJobUsageS4(conn, { programs: ['ZREP1'] }),
    ).rejects.toThrow(
      /function group ZMCP_WL.*zmcp_wl_job_usage_s4\.abap.*Step 9a\.3/,
    );

    expect(
      explainProxyError(
        'ZMCP_WL_TCODE_USAGE',
        new Error('FM_PROXY: ZMCP_WL_TCODE_USAGE is not on the allow list'),
      ).message,
    ).toMatch(/allow-list entry/);
    const other = new Error('boom');
    expect(explainProxyError('X', other, {} as any)).toBe(other);
  });

  it('hints at SAP_VERSION=ECC only when SAP_VERSION is unset and the error is a dispatcher one', () => {
    const missing = new Error(
      'FM_PROXY: ZMCP_WL_JOB_USAGE is not installed on this system',
    );
    const unknown = new Error('Unknown action: FM_PROXY');
    const generic = new Error('ZMCP_ADT_DISPATCH error (action=FM_PROXY): x');
    for (const e of [missing, unknown, generic]) {
      expect(
        explainProxyError('ZMCP_WL_JOB_USAGE', e, {} as any).message,
      ).toMatch(/set SAP_VERSION=ECC in \.sc4sap\/sap\.env/);
      expect(
        explainProxyError('ZMCP_WL_JOB_USAGE', e, { SAP_VERSION: ' ' } as any)
          .message,
      ).toMatch(/SAP_VERSION=ECC/);
      expect(
        explainProxyError('ZMCP_WL_JOB_USAGE', e, { SAP_VERSION: 'S4' } as any)
          .message,
      ).not.toMatch(/SAP_VERSION=ECC/);
    }
    const net = new Error('socket hang up');
    expect(explainProxyError('X', net, {} as any)).toBe(net);
  });

  it('adds the hint through the real call path when SAP_VERSION is unset', async () => {
    delete process.env.SAP_VERSION;
    callDispatch.mockRejectedValue(new Error('Unknown action: FM_PROXY'));
    await expect(
      callWlTcodeUsageS4(conn, { tcodes: ['VA01'] }),
    ).rejects.toThrow(/predates FM_PROXY.*set SAP_VERSION=ECC/);
  });
});

describe('handlers — ECC bridge vs S/4 route', () => {
  it('GetTcodeUsage on S/4 uses FM_PROXY, not the ECC bridge', async () => {
    process.env.SAP_VERSION = 'S4';
    callDispatch.mockResolvedValue(tcodeAnswer());
    const res = await handleGetTcodeUsage(ctx, {
      tcodes: ['va01', 'zunused'],
    });
    expect(res.isError).toBe(false);
    expect(callWlTcodeUsage).not.toHaveBeenCalled();
    expect(callDispatch.mock.calls[0][2].params[0]).toEqual({
      name: 'IV_TCODES',
      value: 'VA01,ZUNUSED',
    });
    const body = bodyOf(res);
    expect(body).toMatchObject({
      success: true,
      path: 's4-dispatch-fm-proxy',
      system: 'S4H',
      destination: null,
      months: 12,
      coverage: 12,
      complete: true,
      usage_known: true,
      used: ['VA01'],
      unused: ['ZUNUSED'],
      result: { VA01: true, ZUNUSED: false },
    });
  });

  it('GetTcodeUsage passes SAP_USAGE_RFCDEST and LOCAL on S/4', async () => {
    process.env.SAP_VERSION = 'S4';
    process.env.SAP_USAGE_RFCDEST = 'PRD_RFC';
    callDispatch.mockResolvedValue(tcodeAnswer());
    await handleGetTcodeUsage(ctx, { tcodes: ['VA01'] });
    expect(callDispatch.mock.calls[0][2].params[2]).toEqual({
      name: 'IV_RFCDEST',
      value: 'PRD_RFC',
    });
    callDispatch.mockClear();
    await handleGetTcodeUsage(ctx, { tcodes: ['VA01'], destination: 'local' });
    expect(callDispatch.mock.calls[0][2].params[2].value).toBe('');
  });

  it('GetTcodeUsage keeps the ECC bridge on ECC', async () => {
    process.env.SAP_VERSION = 'ECC';
    callWlTcodeUsage.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      coverage: 6,
      result: { VA01: true },
      sysid: 'ECD',
    });
    const res = await handleGetTcodeUsage(ctx, { tcodes: ['VA01'] });
    expect(callDispatch).not.toHaveBeenCalled();
    expect(callWlTcodeUsage).toHaveBeenCalledWith(conn, {
      tcodes: ['VA01'],
      months: 12,
      rfcdest: '',
    });
    expect(bodyOf(res)).toMatchObject({
      path: 'ecc-odata-rfc',
      coverage: 6,
      complete: false,
    });
  });

  it('GetTcodeUsage reports a missing S/4 install as an error reply', async () => {
    process.env.SAP_VERSION = 'S4';
    callDispatch.mockRejectedValue(
      new Error(
        'FM_PROXY: ZMCP_WL_TCODE_USAGE is not installed on this system',
      ),
    );
    const res = await handleGetTcodeUsage(ctx, { tcodes: ['VA01'] });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/zmcp_wl_tcode_usage_s4\.abap/);
  });

  it('GetJobUsage on S/4 uses FM_PROXY and keeps the reply shape', async () => {
    process.env.SAP_VERSION = 'S4';
    callDispatch.mockResolvedValue({
      result: {
        EV_SUBRC: 0,
        EV_MESSAGE: 'history',
        EV_OLDEST: '19990101',
        EV_RESULT: '{"ZREP1":true,"ZREP2":false}',
      },
      subrc: 0,
      message: '',
    });
    const res = await handleGetJobUsage(ctx, {
      programs: ['zrep1', 'zrep2'],
      months: 6,
    });
    expect(res.isError).toBe(false);
    expect(callWlJobUsage).not.toHaveBeenCalled();
    const body = bodyOf(res);
    expect(body).toMatchObject({
      success: true,
      path: 's4-dispatch-fm-proxy',
      months: 6,
      oldest: '19990101',
      complete: true,
      used: ['ZREP1'],
      unused: ['ZREP2'],
    });
    expect(body.window_start).toMatch(/^\d{6}01$/);
  });

  it('GetJobUsage keeps the ECC bridge on ECC', async () => {
    process.env.SAP_VERSION = 'ECC';
    callWlJobUsage.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      oldest: '',
      result: { ZREP1: false },
    });
    const res = await handleGetJobUsage(ctx, { programs: ['ZREP1'] });
    expect(callDispatch).not.toHaveBeenCalled();
    expect(bodyOf(res)).toMatchObject({
      path: 'ecc-odata-rfc',
      complete: false,
      unused: ['ZREP1'],
    });
  });

  it('both handlers still refuse an empty list before any call', async () => {
    process.env.SAP_VERSION = 'S4';
    expect((await handleGetTcodeUsage(ctx, { tcodes: [] })).isError).toBe(true);
    expect((await handleGetJobUsage(ctx, { programs: [] })).isError).toBe(true);
    expect(callDispatch).not.toHaveBeenCalled();
  });
});
