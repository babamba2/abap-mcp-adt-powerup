/**
 * Follow-ups of the RunUnitTest round: (1) a run without any test method says so
 * (`warning`, `methods: 0`) instead of plain success; (2) UpdateInclude writes a
 * function-group include through its group's ADT path. ADT calls are mocked.
 */
jest.mock('../../lib/systemContext', () => ({ getSystemContext: jest.fn() }));
jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/utils', () => {
  const actual = jest.requireActual('../../lib/utils');
  return {
    ...actual,
    makeAdtRequestWithTimeout: jest.fn(),
    isCloudConnection: () => false,
  };
});

import {
  functionGroupOf,
  handleUpdateInclude,
} from '../../handlers/include/high/handleUpdateInclude';
import { handleGetUnitTestResult } from '../../handlers/unit_test/high/handleGetUnitTestResult';
import {
  emptyRunWarning,
  handleRunUnitTest,
} from '../../handlers/unit_test/high/handleRunUnitTest';
import { createAdtClient } from '../../lib/clients';
import { getSystemContext } from '../../lib/systemContext';
import { makeAdtRequestWithTimeout } from '../../lib/utils';

const mockReq = makeAdtRequestWithTimeout as jest.Mock;
const mockCtx = getSystemContext as jest.Mock;
const mockClient = createAdtClient as jest.Mock;
const body = (r: any) => JSON.parse(r.content[0].text);
const EMPTY =
  '<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit"/>';
const ONE =
  '<aunit:runResult xmlns:aunit="x"><program adtcore:name="ZP"><testClasses><testClass adtcore:name="LTCL"><testMethods><testMethod adtcore:name="A"/></testMethods></testClass></testClasses></program></aunit:runResult>';

beforeEach(() => jest.resetAllMocks());

describe('empty run result', () => {
  it('warns when no test method ran', () => {
    expect(emptyRunWarning(EMPTY)).toMatch(/No test method ran/);
    expect(emptyRunWarning(undefined)).toMatch(/No test method ran/);
    expect(emptyRunWarning(ONE)).toBeUndefined();
    // junit format: <testcase> elements count as test methods
    expect(
      emptyRunWarning(
        '<?xml version="1.0"?><testsuites><testsuite name="ZP" tests="1"><testcase name="A" classname="ZP.LTCL"/></testsuite></testsuites>',
      ),
    ).toBeUndefined();
    expect(emptyRunWarning('<?xml version="1.0"?><testsuites/>')).toMatch(
      /No test method ran/,
    );
  });

  it('RunUnitTest by object: warning + methods 0 for a nonexistent container, nothing extra otherwise', async () => {
    mockCtx.mockReturnValue({ isLegacy: false });
    mockReq.mockResolvedValueOnce({ data: EMPTY });
    const empty = body(
      await handleRunUnitTest({ connection: {}, logger: undefined } as any, {
        tests: [
          { container_class: 'ZNONE', test_class: 'X', container_type: 'PROG' },
        ],
      }),
    );
    expect(empty).toMatchObject({ run_id: 'object-sync', methods: 0 });
    expect(empty.warning).toMatch(/NOT RUN/);
    mockReq.mockResolvedValueOnce({ data: ONE });
    const one = body(
      await handleRunUnitTest({ connection: {}, logger: undefined } as any, {
        tests: [
          { container_class: 'ZP', test_class: 'LTCL', container_type: 'PROG' },
        ],
      }),
    );
    expect(one.warning).toBeUndefined();
    expect(one.methods).toBeUndefined();
  });

  it('GetUnitTestResult warns on an empty result too', async () => {
    mockClient.mockReturnValue({
      getUnitTest: () => ({
        read: jest.fn().mockResolvedValue({ runResult: EMPTY }),
      }),
    });
    mockCtx.mockReturnValue({ isLegacy: false });
    const r = await handleGetUnitTestResult(
      { connection: {}, logger: undefined } as any,
      { run_id: 'RUN1' },
    );
    expect(body(r)).toMatchObject({ run_id: 'RUN1', methods: 0 });
  });
});

describe('UpdateInclude for function-group includes', () => {
  it('takes the group from function_group or from main_program SAPL<group>', () => {
    expect(functionGroupOf({ function_group: 'zsc4sap_pt_m1_f' })).toBe(
      'ZSC4SAP_PT_M1_F',
    );
    expect(functionGroupOf({ main_program: 'SAPLZSC4SAP_PT_M1_F' })).toBe(
      'ZSC4SAP_PT_M1_F',
    );
    expect(functionGroupOf({ main_program: 'ZPROG' })).toBeNull();
    expect(functionGroupOf({ main_program: 'SAPL' })).toBeNull();
    expect(functionGroupOf({})).toBeNull();
  });

  it('locks, writes, unlocks and activates under /functions/groups/<fg>/includes/<inc>', async () => {
    const connection = { setSessionType: jest.fn() } as any;
    mockReq.mockImplementation(async (_c: any, url: string, method: string) => {
      if (url.includes('_action=LOCK'))
        return {
          data: '<asx:abap><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
          headers: {},
        };
      if (url === '/sap/bc/adt/activation') return { data: '' };
      return { data: '', headers: {}, method };
    });
    const r = await handleUpdateInclude(
      { connection, logger: undefined } as any,
      {
        include_name: 'LZSC4SAP_PT_M1_FTOP',
        main_program: 'SAPLZSC4SAP_PT_M1_F',
        source_code: 'FUNCTION-POOL zsc4sap_pt_m1_f.',
        activate: true,
      },
    );
    const urls = mockReq.mock.calls.map((c) => c[1] as string);
    const base =
      '/sap/bc/adt/functions/groups/zsc4sap_pt_m1_f/includes/lzsc4sap_pt_m1_ftop';
    expect(urls[0]).toBe(`${base}?_action=LOCK&accessMode=MODIFY`);
    expect(
      urls.some((u) => u.startsWith(`${base}/source/main?lockHandle=H1`)),
    ).toBe(true);
    expect(urls.some((u) => u.startsWith(`${base}?_action=UNLOCK`))).toBe(true);
    // no pre-write program check against the SAPL… program URI for a group include
    expect(urls.some((u) => u.includes('/programs/programs/saplzsc4sap'))).toBe(
      false,
    );
    const activation = mockReq.mock.calls.find(
      (c) => c[1] === '/sap/bc/adt/activation',
    );
    expect(String(activation?.[4])).toContain(`adtcore:uri="${base}"`);
    expect(r.isError).toBe(false);
  });

  it('keeps the program include path for ordinary includes', async () => {
    const connection = { setSessionType: jest.fn() } as any;
    mockReq.mockImplementation(async (_c: any, url: string) =>
      url.includes('_action=LOCK')
        ? {
            data: '<asx:abap><asx:values><DATA><LOCK_HANDLE>H2</LOCK_HANDLE></DATA></asx:values></asx:abap>',
            headers: {},
          }
        : { data: '', headers: {} },
    );
    await handleUpdateInclude({ connection, logger: undefined } as any, {
      include_name: 'ZPROG_F01',
      source_code: 'FORM x. ENDFORM.',
    });
    expect(mockReq.mock.calls[0][1]).toBe(
      '/sap/bc/adt/programs/includes/ZPROG_F01?_action=LOCK&accessMode=MODIFY',
    );
  });
});
