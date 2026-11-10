/**
 * Unit tests for src/lib/bizRfc.ts and the business-action handlers.
 * No SAP calls: soap / native / dispatcher are mocked.
 */

jest.mock('../../lib/soapRfc', () => ({
  callSoapRfc: jest.fn(),
}));
jest.mock('../../lib/nativeRfc', () => ({
  callRfcFunction: jest.fn(),
}));
jest.mock('../../lib/rfcBackend', () => ({
  getBackend: jest.fn(),
  callDispatch: jest.fn(),
}));

const soap = require('../../lib/soapRfc');
const native = require('../../lib/nativeRfc');
const rfc = require('../../lib/rfcBackend');
const biz = require('../../lib/bizRfc');

describe('bizRfc — routing per backend', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds string imports with upper-case action and JSON params', () => {
    expect(
      biz.buildImports({
        action: ' mm.po.list_open ',
        mode: 'QUERY',
        params: { werks: '1100', ebelp: ['10'] },
      }),
    ).toEqual({
      IV_ACTION: 'MM.PO.LIST_OPEN',
      IV_MODE: 'QUERY',
      IV_PARAMS: '{"werks":"1100","ebelp":["10"]}',
      IV_TOKEN: '',
      IV_IDEM_KEY: '',
    });
  });

  it('soap: calls ZMCP_BIZ_EXECUTE directly and keeps a non-zero subrc', async () => {
    rfc.getBackend.mockReturnValue('soap');
    soap.callSoapRfc.mockResolvedValue({
      raw: {
        EV_SUBRC: '4',
        EV_MESSAGE: 'refused',
        EV_RESULT: '{"a":1}',
        EV_TOKEN: '',
      },
    });
    const r = await biz.callBizExecute({}, { action: 'X.Y', mode: 'PREVIEW' });
    expect(soap.callSoapRfc).toHaveBeenCalledWith(
      {},
      'ZMCP_BIZ_EXECUTE',
      expect.objectContaining({ IV_MODE: 'PREVIEW' }),
    );
    expect(r).toEqual({
      subrc: 4,
      message: 'refused',
      token: '',
      result: { a: 1 },
    });
    expect(rfc.callDispatch).not.toHaveBeenCalled();
  });

  it('native: calls the FM through node-rfc', async () => {
    rfc.getBackend.mockReturnValue('native');
    native.callRfcFunction.mockResolvedValue({
      EV_SUBRC: 0,
      EV_TOKEN: 'T1',
      EV_RESULT: '',
    });
    const r = await biz.callBizExecute({}, { action: 'X.Y', mode: 'PREVIEW' });
    expect(native.callRfcFunction).toHaveBeenCalledWith(
      'ZMCP_BIZ_EXECUTE',
      expect.any(Object),
    );
    expect(r.token).toBe('T1');
    expect(r.result).toBeNull();
  });

  it.each(['odata', 'gateway', 'zrfc'])(
    '%s: goes through dispatcher BIZ_EXECUTE',
    async (b) => {
      rfc.getBackend.mockReturnValue(b);
      rfc.callDispatch.mockResolvedValue({
        result: { subrc: 0, message: 'ok', token: 'TK', result: { rows: [] } },
        subrc: 0,
        message: '',
      });
      const r = await biz.callBizExecute(
        {},
        {
          action: 'mm.po.x',
          mode: 'EXECUTE',
          params: { ebeln: '1' },
          token: 'TK',
          idemKey: 'K',
        },
      );
      expect(rfc.callDispatch).toHaveBeenCalledWith({}, 'BIZ_EXECUTE', {
        action: 'MM.PO.X',
        mode: 'EXECUTE',
        params: '{"ebeln":"1"}',
        token: 'TK',
        idem_key: 'K',
      });
      expect(r).toEqual({
        subrc: 0,
        message: 'ok',
        token: 'TK',
        result: { rows: [] },
      });
    },
  );

  it('fromDispatch tolerates a JSON string and a plain-text result', () => {
    expect(
      biz.fromDispatch('{"subrc":4,"message":"m","result":"text"}'),
    ).toEqual({
      subrc: 4,
      message: 'm',
      token: '',
      result: 'text',
    });
  });
});

describe('business-action handlers', () => {
  const profile = require('../../lib/profile');
  const h = require('../../handlers/business/handleBusinessActions');
  const ctx = { connection: {}, logger: console } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    rfc.getBackend.mockReturnValue('soap');
    soap.callSoapRfc.mockResolvedValue({
      raw: { EV_SUBRC: 0, EV_MESSAGE: 'ok', EV_RESULT: '{}', EV_TOKEN: 'T' },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('all four tools carry tool_profile biz', () => {
    for (const t of [
      h.ListBusinessActions_Tool,
      h.RunBusinessQuery_Tool,
      h.PreviewBusinessAction_Tool,
      h.ExecuteBusinessAction_Tool,
    ]) {
      expect(t.tool_profile).toEqual(['biz']);
    }
  });

  it('RunBusinessQuery uses QUERY, or PRECHECK when precheck=true', async () => {
    await h.handleRunBusinessQuery(ctx, { action: 'MM.PO.LIST_OPEN' });
    expect(soap.callSoapRfc.mock.calls[0][2].IV_MODE).toBe('QUERY');
    await h.handleRunBusinessQuery(ctx, { action: 'MM.PO.X', precheck: true });
    expect(soap.callSoapRfc.mock.calls[1][2].IV_MODE).toBe('PRECHECK');
  });

  it('accepts params as a JSON string, refuses an array', async () => {
    const ok = await h.handleRunBusinessQuery(ctx, {
      action: 'A.B',
      params: '{"x":"1"}',
    });
    expect(ok.isError).toBe(false);
    const bad = await h.handleRunBusinessQuery(ctx, {
      action: 'A.B',
      params: [1],
    });
    expect(bad.isError).toBe(true);
  });

  it('Execute without a token is refused before any SAP call', async () => {
    const r = await h.handleExecuteBusinessAction(ctx, {
      action: 'A.B',
      params: {},
    });
    expect(r.isError).toBe(true);
    expect(soap.callSoapRfc).not.toHaveBeenCalled();
  });

  it('Preview and Execute are refused on PRD', async () => {
    jest.spyOn(profile, 'getActiveTier').mockReturnValue('PRD');
    const p = await h.handlePreviewBusinessAction(ctx, {
      action: 'A.B',
      params: {},
    });
    const e = await h.handleExecuteBusinessAction(ctx, {
      action: 'A.B',
      params: {},
      token: 'T',
    });
    expect(p.isError).toBe(true);
    expect(e.isError).toBe(true);
    expect(soap.callSoapRfc).not.toHaveBeenCalled();
  });

  it('a refusal (subrc 4) is returned as content with ok=false', async () => {
    soap.callSoapRfc.mockResolvedValue({
      raw: { EV_SUBRC: 4, EV_MESSAGE: 'no auth', EV_RESULT: '' },
    });
    const r = await h.handlePreviewBusinessAction(ctx, {
      action: 'A.B',
      params: {},
    });
    expect(r.isError).toBe(false);
    const body = JSON.parse(r.content[0].text);
    expect(body).toMatchObject({
      ok: false,
      subrc: 4,
      message: 'no auth',
      mode: 'PREVIEW',
    });
  });
});

describe('tool profile filter', () => {
  const {
    isToolInProfile,
    resolveToolProfile,
  } = require('../../lib/handlers/interfaces');

  it('resolves SAP_TOOL_PROFILE with dev default', () => {
    expect(resolveToolProfile(undefined)).toBe('dev');
    expect(resolveToolProfile('')).toBe('dev');
    expect(resolveToolProfile('BIZ')).toBe('biz');
    expect(resolveToolProfile('all')).toBe('all');
    expect(resolveToolProfile('junk')).toBe('dev');
  });

  it('untagged tools are dev-only; biz tools only in biz / all', () => {
    expect(isToolInProfile(undefined, 'dev')).toBe(true);
    expect(isToolInProfile(undefined, 'biz')).toBe(false);
    expect(isToolInProfile(['biz'], 'dev')).toBe(false);
    expect(isToolInProfile(['biz'], 'biz')).toBe(true);
    expect(isToolInProfile(['biz'], 'all')).toBe(true);
    expect(isToolInProfile(['dev', 'biz'], 'biz')).toBe(true);
  });
});
