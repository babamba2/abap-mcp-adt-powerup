/**
 * The registration path every transport uses (BaseMcpServer.registerHandlers)
 * must (1) apply the tier readonly guard before a handler runs and (2) turn
 * `source_file` into `source_code` for the source-writing tools, confined to
 * the MCP output directory. Also: RunUnitTest result_format "summary".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const updateSchema = {
  type: 'object',
  properties: {
    program_name: { type: 'string' },
    source_code: { type: 'string' },
  },
  required: ['program_name', 'source_code'],
};

function setTier(tier: 'DEV' | 'QA' | 'PRD') {
  const { applyProfile, __resetProfileState } = require('../../lib/profile');
  __resetProfileState();
  applyProfile({
    alias: `T-${tier}`,
    sourcePath: '/dev/null',
    envVars: { SAP_TIER: tier },
    tier,
    readonly: tier !== 'DEV',
    legacy: false,
  });
}

function buildServer() {
  const { BaseMcpServer } = require('../../server/BaseMcpServer');
  const {
    CompositeHandlersRegistry,
  } = require('../../lib/handlers/registry/CompositeHandlersRegistry');
  const calls: Record<string, any[]> = {};
  const tools: Record<string, { config: any; run: (a: any) => Promise<any> }> =
    {};
  const handler = (name: string) => async (_ctx: any, args: any) => {
    if (!calls[name]) calls[name] = [];
    calls[name].push(args);
    return { content: [{ type: 'text', text: 'ok' }] };
  };
  const group = {
    getName: () => 'test',
    getHandlers: () => [
      {
        toolDefinition: {
          name: 'UpdateProgram',
          description: 'x',
          inputSchema: updateSchema,
        },
        handler: handler('UpdateProgram'),
      },
      {
        toolDefinition: {
          name: 'SearchObject',
          description: 'x',
          inputSchema: {
            type: 'object',
            properties: { object_name: { type: 'string' } },
            required: ['object_name'],
          },
        },
        handler: handler('SearchObject'),
      },
    ],
  };
  class TestServer extends BaseMcpServer {
    constructor() {
      super({ name: 'test' });
    }
    registerTool(name: string, config: any, run: any) {
      tools[name] = { config, run };
      return {} as any;
    }
    async getConnection() {
      return {} as any;
    }
    register(reg: any) {
      this.registerHandlers(reg);
    }
  }
  const s = new TestServer();
  s.register(new CompositeHandlersRegistry([group]));
  return { tools, calls };
}

describe('BaseMcpServer registration wrapper', () => {
  let outDir: string;
  const savedOut = process.env.MCP_OUTPUT_DIR;

  beforeEach(() => {
    jest.resetModules();
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-out-'));
    process.env.MCP_OUTPUT_DIR = outDir;
  });
  afterEach(() => {
    if (savedOut === undefined) delete process.env.MCP_OUTPUT_DIR;
    else process.env.MCP_OUTPUT_DIR = savedOut;
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('blocks a mutation on a PRD profile before the handler runs', async () => {
    setTier('PRD');
    const { tools, calls } = buildServer();
    await expect(
      tools.UpdateProgram.run({
        program_name: 'Z1',
        source_code: 'REPORT z1.',
      }),
    ).rejects.toThrow(/ERR_READONLY_TIER/);
    expect(calls.UpdateProgram).toBeUndefined();
    await tools.SearchObject.run({ object_name: 'Z1' });
    expect(calls.SearchObject).toHaveLength(1);
  });

  it('blocks a mutation on a QA profile too', async () => {
    setTier('QA');
    const { tools } = buildServer();
    await expect(
      tools.UpdateProgram.run({ program_name: 'Z1', source_code: 'x' }),
    ).rejects.toThrow(/ERR_READONLY_TIER/);
  });

  it('passes source_file content on as source_code (DEV)', async () => {
    setTier('DEV');
    const file = path.join(outDir, 'src', 'z1.prog.abap');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '﻿REPORT z1.\r\nWRITE 1.\r\n');
    const { tools, calls } = buildServer();
    await tools.UpdateProgram.run({ program_name: 'Z1', source_file: file });
    expect(calls.UpdateProgram[0]).toEqual({
      program_name: 'Z1',
      source_code: 'REPORT z1.\r\nWRITE 1.\r\n',
    });
  });

  it('advertises source_file and no longer requires source_code', () => {
    setTier('DEV');
    const { withSourceFileSchema } = require('../../lib/sourceFileInput');
    const s = withSourceFileSchema('UpdateProgram', updateSchema);
    expect(s.properties.source_file.type).toBe('string');
    expect(s.required).toEqual(['program_name']);
    expect(
      withSourceFileSchema('SearchObject', { type: 'object', properties: {} }),
    ).toEqual({ type: 'object', properties: {} });
  });

  it('refuses a source_file outside the output directory, and both inputs at once', async () => {
    setTier('DEV');
    const outside = path.join(os.tmpdir(), `outside-${Date.now()}.abap`);
    fs.writeFileSync(outside, 'secret');
    const inside = path.join(outDir, 'z.abap');
    fs.writeFileSync(inside, 'REPORT z.');
    const { tools, calls } = buildServer();
    try {
      await expect(
        tools.UpdateProgram.run({ program_name: 'Z1', source_file: outside }),
      ).rejects.toThrow(/source_file: refused/);
      await expect(
        tools.UpdateProgram.run({
          program_name: 'Z1',
          source_file: '../../etc/x.abap',
        }),
      ).rejects.toThrow(/source_file: refused/);
      await expect(
        tools.UpdateProgram.run({
          program_name: 'Z1',
          source_code: 'REPORT z.',
          source_file: inside,
        }),
      ).rejects.toThrow(/not both/);
      await expect(
        tools.SearchObject.run({ object_name: 'Z', source_file: inside }),
      ).rejects.toThrow(/does not take source_file/);
      expect(calls.UpdateProgram).toBeUndefined();
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});

describe('RunUnitTest result_format summary', () => {
  const {
    summarizeRunResult,
  } = require('../../handlers/unit_test/high/handleRunUnitTest');
  const xml = `<aunit:runResult xmlns:aunit="x" xmlns:adtcore="y"><program adtcore:name="ZP"><testClasses>
<testClass adtcore:name="LTCL_A"><testMethods>
<testMethod adtcore:name="OK_1"/>
<testMethod adtcore:name="FAIL_1"><alerts><alert kind="failedAssertion" severity="critical"><title>Assertion failed: &quot;1&quot; vs &quot;2&quot;</title><details><detail text="Expected [1] Actual [2]"/><detail text="Test LTCL_A-&gt;FAIL_1"/></details></alert></alerts></testMethod>
<testMethod adtcore:name="WARN_1"><alerts><alert kind="warning" severity="tolerable"><title>slow</title></alert></alerts></testMethod>
</testMethods></testClass>
<testClass adtcore:name="LTCL_B"><alerts><alert kind="exception" severity="fatal"><title>CX_SY_ZERODIVIDE in setup</title></alert></alerts><testMethods><testMethod adtcore:name="OK_2"/></testMethods></testClass>
</testClasses></program></aunit:runResult>`;

  it('counts methods and lists only blocking alerts', () => {
    const s = summarizeRunResult(xml);
    expect(s).toMatchObject({ classes: 2, methods: 4, passed: 3, failed: 1 });
    expect(s.failures).toEqual([
      {
        class: 'LTCL_A',
        method: 'FAIL_1',
        kind: 'failedAssertion',
        severity: 'critical',
        title: 'Assertion failed: "1" vs "2"',
        details: ['Expected [1] Actual [2]', 'Test LTCL_A->FAIL_1'],
      },
      {
        class: 'LTCL_B',
        method: '',
        kind: 'exception',
        severity: 'fatal',
        title: 'CX_SY_ZERODIVIDE in setup',
        details: [],
      },
    ]);
  });

  it('is much smaller than the XML', () => {
    expect(JSON.stringify(summarizeRunResult(xml)).length).toBeLessThan(
      xml.length,
    );
  });
});
