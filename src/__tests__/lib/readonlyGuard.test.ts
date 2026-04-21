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
  ];
  const runtimeExec = [
    'RuntimeRunProgramWithProfiling',
    'RuntimeRunClassWithProfiling',
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
