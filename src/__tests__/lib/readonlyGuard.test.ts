/**
 * Unit tests for src/lib/readonlyGuard.ts
 *
 * Exercises the block matrix via `checkToolAllowed` (pure) and the throwing
 * `guardTool` bound to the module-level active tier state.
 */

describe('readonlyGuard — checkToolAllowed (pure matrix)', () => {
  const { checkToolAllowed } = require('../../lib/readonlyGuard');

  const mutations = [
    'CreateClass',
    'CreateTransport',
    'CreateProgram',
    'UpdateClass',
    'UpdateFunctionModule',
    'DeleteTable',
    'DeleteStructure',
    // These three mutate SAP but match none of Create/Update/Delete. They were
    // reachable on QA and PRD until the prefix list grew to cover them.
    'ActivateObjects',
    'PatchGuiStatus',
    'WriteTextElementsBulk',
  ];
  const runtimeExec = [
    'RuntimeRunProgramWithProfiling',
    'RuntimeRunClassWithProfiling',
    'RuntimeCreateProfilerTraceParameters',
  ];
  const reads = [
    'GetClass',
    'ReadProgram',
    'SearchObject',
    'GetSqlQuery',
    'RuntimeAnalyzeDump',
    'RuntimeListDumps',
    'RuntimeGetDumpById',
    'ValidateServiceBinding',
    // Near-misses for the runtime blocklist above. If someone ever "simplifies"
    // it to a bare `Runtime` prefix, these are the reads that would silently die
    // on QA and PRD — so they are asserted explicitly.
    'RuntimeAnalyzeProfilerTrace',
    'RuntimeGetProfilerTraceData',
    'RuntimeListProfilerTraceFiles',
    'RuntimeGetGatewayErrorLog',
    'RuntimeListSystemMessages',
  ];

  it('DEV tier allows everything', () => {
    for (const t of [...mutations, ...runtimeExec, 'RunUnitTest', ...reads]) {
      expect(checkToolAllowed(t, 'DEV')).toBeNull();
    }
  });

  it('QA tier blocks mutations', () => {
    for (const t of mutations) {
      expect(checkToolAllowed(t, 'QA')).toMatch(/mutates/);
    }
  });

  it('QA tier blocks runtime program/class execution', () => {
    for (const t of runtimeExec) {
      expect(checkToolAllowed(t, 'QA')).toMatch(/executes ABAP code/);
    }
  });

  it('QA tier allows RunUnitTest', () => {
    expect(checkToolAllowed('RunUnitTest', 'QA')).toBeNull();
  });

  it('QA tier allows reads and dump/profile analysis', () => {
    for (const t of reads) {
      expect(checkToolAllowed(t, 'QA')).toBeNull();
    }
  });

  it('PRD tier blocks mutations', () => {
    for (const t of mutations) {
      expect(checkToolAllowed(t, 'PRD')).toMatch(/mutates/);
    }
  });

  it('PRD tier blocks RunUnitTest (no QA allowlist applies)', () => {
    expect(checkToolAllowed('RunUnitTest', 'PRD')).toMatch(/executes ABAP/);
  });

  it('PRD tier blocks runtime execution tools', () => {
    for (const t of runtimeExec) {
      expect(checkToolAllowed(t, 'PRD')).toMatch(/executes ABAP code/);
    }
  });

  it('PRD tier allows reads', () => {
    for (const t of reads) {
      expect(checkToolAllowed(t, 'PRD')).toBeNull();
    }
  });

  // Documents a known, deliberate hole rather than asserting desired behaviour.
  // RuntimeCallDispatch invokes an arbitrary ZMCP_ADT_DISPATCH action; the
  // action name is a runtime argument, so this layer — which sees only the tool
  // name — cannot tell SSF_UPLOAD (write) from SSF_EXISTS (read). If it ever
  // does get blocked, this test should flip, not be deleted quietly.
  it('does NOT yet block RuntimeCallDispatch (known gap, tracked separately)', () => {
    expect(checkToolAllowed('RuntimeCallDispatch', 'PRD')).toBeNull();
  });
});

describe('readonlyGuard — guardTool (uses active profile state)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not throw on DEV tier', () => {
    const { applyProfile, __resetProfileState } = require('../../lib/profile');
    __resetProfileState();
    applyProfile({
      alias: 'HK-DEV',
      sourcePath: '/dev/null',
      envVars: { SAP_TIER: 'DEV' },
      tier: 'DEV',
      readonly: false,
      legacy: false,
    });
    const { guardTool } = require('../../lib/readonlyGuard');
    expect(() => guardTool('UpdateClass')).not.toThrow();
    expect(() => guardTool('CreateTransport')).not.toThrow();
  });

  it('throws McpError on PRD mutation with tier-aware message', () => {
    const { applyProfile, __resetProfileState } = require('../../lib/profile');
    __resetProfileState();
    applyProfile({
      alias: 'HK-PRD',
      sourcePath: '/dev/null',
      envVars: { SAP_TIER: 'PRD' },
      tier: 'PRD',
      readonly: true,
      legacy: false,
    });
    const { guardTool } = require('../../lib/readonlyGuard');
    expect(() => guardTool('UpdateClass')).toThrow(
      /ERR_READONLY_TIER.*HK-PRD.*tier=PRD/s,
    );
  });

  it('throws on QA runtime execution but allows RunUnitTest', () => {
    const { applyProfile, __resetProfileState } = require('../../lib/profile');
    __resetProfileState();
    applyProfile({
      alias: 'HK-QA',
      sourcePath: '/dev/null',
      envVars: { SAP_TIER: 'QA' },
      tier: 'QA',
      readonly: true,
      legacy: false,
    });
    const { guardTool } = require('../../lib/readonlyGuard');
    expect(() => guardTool('RuntimeRunProgramWithProfiling')).toThrow(
      /ERR_READONLY_TIER/,
    );
    expect(() => guardTool('RunUnitTest')).not.toThrow();
  });

  it('always allows ReloadProfile regardless of tier', () => {
    const { applyProfile, __resetProfileState } = require('../../lib/profile');
    __resetProfileState();
    applyProfile({
      alias: 'HK-PRD',
      sourcePath: '/dev/null',
      envVars: { SAP_TIER: 'PRD' },
      tier: 'PRD',
      readonly: true,
      legacy: false,
    });
    const { guardTool } = require('../../lib/readonlyGuard');
    expect(() => guardTool('ReloadProfile')).not.toThrow();
  });

  it('emits legacy marker when no alias is set', () => {
    const { applyProfile, __resetProfileState } = require('../../lib/profile');
    __resetProfileState();
    applyProfile({
      alias: undefined,
      sourcePath: '/dev/null',
      envVars: { SAP_TIER: 'PRD' },
      tier: 'PRD',
      readonly: true,
      legacy: true,
    });
    const { guardTool } = require('../../lib/readonlyGuard');
    expect(() => guardTool('CreateClass')).toThrow(/\(legacy\)/);
  });
});
