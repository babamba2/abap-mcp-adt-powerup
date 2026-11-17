/**
 * RunUnitTest: PROG / FUGR containers on modern systems run synchronously through
 * /abapunit/testruns (object references). ADT calls are mocked; object names are invented.
 */

jest.mock('../../lib/systemContext', () => ({ getSystemContext: jest.fn() }));
jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/utils', () => {
  const actual = jest.requireActual('../../lib/utils');
  return { ...actual, makeAdtRequestWithTimeout: jest.fn() };
});

import {
  buildObjectRunXml,
  handleRunUnitTest,
  TOOL_DEFINITION,
} from '../../handlers/unit_test/high/handleRunUnitTest';
import { createAdtClient } from '../../lib/clients';
import { getSystemContext } from '../../lib/systemContext';
import { makeAdtRequestWithTimeout } from '../../lib/utils';

const mockCtx = getSystemContext as jest.Mock;
const mockReq = makeAdtRequestWithTimeout as jest.Mock;
const mockClient = createAdtClient as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;
const RESULT =
  '<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit"><program adtcore:name="ZTEST_PT"/></aunit:runResult>';

const body = (r: any) => JSON.parse(r.content[0].text);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('buildObjectRunXml', () => {
  it('references programs, function groups and classes by URI', () => {
    const xml = buildObjectRunXml([
      { container_class: 'ZTEST_PT', container_type: 'PROG' },
      { container_class: 'ZTEST_FG', container_type: 'FUGR' },
      { container_class: 'ZCL_TEST' },
    ]);
    expect(xml).toContain(
      'adtcore:uri="/sap/bc/adt/programs/programs/ztest_pt"',
    );
    expect(xml).toContain(
      'adtcore:uri="/sap/bc/adt/functions/groups/ztest_fg"',
    );
    expect(xml).toContain('adtcore:uri="/sap/bc/adt/oo/classes/zcl_test"');
    expect(xml).toContain('<aunit:runConfiguration');
    expect(() =>
      buildObjectRunXml([{ container_class: 'X', container_type: 'TABL' }]),
    ).toThrow(/Unsupported/);
  });

  it('describes the S/4 program run', () => {
    expect(TOOL_DEFINITION.description).toContain('object-sync');
  });
});

describe('handleRunUnitTest on a modern system', () => {
  it('runs a PROG container synchronously and returns the result inline', async () => {
    mockCtx.mockReturnValue({ isLegacy: false });
    mockReq.mockResolvedValue({ data: RESULT });
    const r = await handleRunUnitTest(ctx, {
      tests: [
        {
          container_class: 'ztest_pt',
          test_class: 'LTCL_PT',
          container_type: 'PROG',
        },
      ],
    });
    expect(r.isError).toBe(false);
    expect(body(r)).toMatchObject({
      success: true,
      run_id: 'object-sync',
      run_result: RESULT,
    });
    expect(mockReq.mock.calls[0][1]).toBe('/sap/bc/adt/abapunit/testruns');
    expect(mockReq.mock.calls[0][2]).toBe('POST');
    expect(mockClient).not.toHaveBeenCalled();
  });

  it('retries with the versioned media type on 415', async () => {
    mockCtx.mockReturnValue({ isLegacy: false });
    mockReq
      .mockRejectedValueOnce(
        Object.assign(new Error('unsupported'), { response: { status: 415 } }),
      )
      .mockResolvedValueOnce({ data: RESULT });
    const r = await handleRunUnitTest(ctx, {
      tests: [
        {
          container_class: 'ZTEST_PT',
          test_class: 'LTCL_PT',
          container_type: 'PROG',
        },
      ],
    });
    expect(body(r).run_id).toBe('object-sync');
    expect(mockReq.mock.calls[1][6]['Content-Type']).toMatch(
      /testruns\.config/,
    );
  });

  it('reports other errors without a retry', async () => {
    mockCtx.mockReturnValue({ isLegacy: false });
    mockReq.mockRejectedValue(
      Object.assign(new Error('not authorized'), { response: { status: 403 } }),
    );
    const r = await handleRunUnitTest(ctx, {
      tests: [
        {
          container_class: 'ZTEST_PT',
          test_class: 'LTCL_PT',
          container_type: 'PROG',
        },
      ],
    });
    expect(r.isError).toBe(true);
    expect(mockReq).toHaveBeenCalledTimes(1);
  });

  it('keeps the asynchronous run for CLAS containers', async () => {
    mockCtx.mockReturnValue({ isLegacy: false });
    const create = jest.fn().mockResolvedValue({ runId: 'RUN1' });
    mockClient.mockReturnValue({ getUnitTest: () => ({ create }) });
    const r = await handleRunUnitTest(ctx, {
      tests: [{ container_class: 'ZCL_TEST', test_class: 'LTCL_TEST' }],
    });
    expect(body(r).run_id).toBe('RUN1');
    expect(mockReq).not.toHaveBeenCalled();
  });
});
