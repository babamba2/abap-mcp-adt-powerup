/**
 * `source_patches` — server-side patch input for the Update* source tools.
 * The reader (ADT client / include endpoint) is mocked: no SAP calls.
 */
import { createHash } from 'node:crypto';

const reads: Array<{ kind: string; config: any; version: string }> = [];
let store: Record<
  string,
  { inactive?: string | Error; active?: string | Error }
> = {};

function reader(kind: string) {
  return {
    read: jest.fn(async (config: any, version: 'active' | 'inactive') => {
      reads.push({ kind, config, version });
      const v = store[kind]?.[version];
      if (v instanceof Error) throw v;
      if (v === undefined) return undefined;
      return { readResult: { data: v, status: 200 } };
    }),
  };
}

jest.mock('../../lib/clients', () => ({
  createAdtClient: () => ({
    getProgram: () => reader('program'),
    getClass: () => reader('class'),
    getInterface: () => reader('interface'),
    getFunctionModule: () => reader('fm'),
    getLocalTypes: () => reader('localTypes'),
    getLocalDefinitions: () => reader('localDefinitions'),
    getLocalMacros: () => reader('localMacros'),
    getLocalTestClass: () => reader('localTestClass'),
  }),
}));

jest.mock('../../lib/utils', () => {
  const actual = jest.requireActual('../../lib/utils');
  return {
    ...actual,
    makeAdtRequestWithTimeout: jest.fn(async (_c: any, url: string) => {
      const version = /version=(\w+)/.exec(url)?.[1] || 'active';
      reads.push({ kind: 'include', config: { url }, version });
      const v = store.include?.[version as 'active' | 'inactive'];
      if (v instanceof Error) throw v;
      if (v === undefined) {
        const e: any = new Error('not found');
        e.response = { status: 404 };
        throw e;
      }
      return { data: v };
    }),
  };
});

import { INCLUDE_STAGED_ADVICE } from '../../handlers/include/high/handleUpdateInclude';
import {
  applySourcePatches,
  attachPatchedInfo,
  isReadChannel,
  parseSourcePatches,
  resolveSourcePatchesArg,
  runWithPatchRestore,
  SOURCE_PATCH_TOOLS,
  stripAbapComments,
  withSourcePatchesSchema,
} from '../../lib/sourcePatchInput';

const ctx: any = { connection: {}, logger: undefined };
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const progSchema = {
  type: 'object',
  properties: {
    program_name: { type: 'string' },
    source_code: { type: 'string' },
  },
  required: ['program_name', 'source_code'],
};
const P = (old_string: string, new_string: string, replace_all?: boolean) =>
  replace_all === undefined
    ? { old_string, new_string }
    : { old_string, new_string, replace_all };

beforeEach(() => {
  reads.length = 0;
  store = {};
});

describe('applySourcePatches', () => {
  it('replaces an old_string that occurs exactly once', () => {
    const r = applySourcePatches('REPORT z.\nWRITE 1.\n', [
      P('WRITE 1.', 'WRITE 2.'),
    ]);
    expect(r.text).toBe('REPORT z.\nWRITE 2.\n');
    expect(r.replacements).toBe(1);
  });

  it('refuses 0 and 2 matches, naming the patch index and the count', () => {
    const src = 'A.\nB.\nB.\n';
    expect(() =>
      applySourcePatches(src, [P('A.', 'X.'), P('C.', 'Y.')]),
    ).toThrow(/source_patches\[1\]: old_string found 0 times/);
    expect(() => applySourcePatches(src, [P('B.', 'Y.')])).toThrow(
      /source_patches\[0\]: old_string found 2 times/,
    );
  });

  it('replace_all replaces every occurrence, still refuses 0', () => {
    const r = applySourcePatches('B.\nB.\nC.\n', [P('B.', 'Z.', true)]);
    expect(r.text).toBe('Z.\nZ.\nC.\n');
    expect(r.replacements).toBe(2);
    expect(() => applySourcePatches('C.\n', [P('B.', 'Z.', true)])).toThrow(
      /found 0 times/,
    );
  });

  it('matches LF patches on a CRLF source and keeps CRLF', () => {
    const src = 'REPORT z.\r\nDATA a TYPE i.\r\nWRITE a.\r\n';
    const r = applySourcePatches(src, [
      P('DATA a TYPE i.\nWRITE a.', 'DATA a TYPE p.\nWRITE / a.'),
    ]);
    expect(r.text).toBe('REPORT z.\r\nDATA a TYPE p.\r\nWRITE / a.\r\n');
  });

  it('applies patches in order (a later patch sees an earlier result)', () => {
    const r = applySourcePatches('X = 1.\n', [
      P('X = 1.', 'X = 2.'),
      P('X = 2.', 'X = 3.'),
    ]);
    expect(r.text).toBe('X = 3.\n');
    expect(() =>
      applySourcePatches('X = 1.\n', [
        P('X = 2.', 'X = 3.'),
        P('X = 1.', 'X = 2.'),
      ]),
    ).toThrow(/source_patches\[0\]: old_string found 0 times/);
  });

  it('treats $ in new_string literally', () => {
    expect(applySourcePatches('a\n', [P('a', '$& $1 $$')]).text).toBe(
      '$& $1 $$\n',
    );
  });
});

describe('parseSourcePatches', () => {
  it('refuses malformed input', () => {
    expect(() => parseSourcePatches('x')).toThrow(/must be an array/);
    expect(() => parseSourcePatches([])).toThrow(/1–50/);
    expect(() =>
      parseSourcePatches(Array.from({ length: 51 }, () => P('a', 'b'))),
    ).toThrow(/1–50/);
    expect(() => parseSourcePatches([P('', 'b')])).toThrow(
      /\[0\]\.old_string must be a non-empty/,
    );
    expect(() => parseSourcePatches([{ old_string: 'a' }])).toThrow(
      /\[0\]\.new_string/,
    );
    expect(() =>
      parseSourcePatches([
        P('a', 'b'),
        { old_string: 'a', new_string: 'b', replace_all: 'y' },
      ]),
    ).toThrow(/\[1\]\.replace_all/);
    expect(() => parseSourcePatches([P('a\r\n', 'a\n')])).toThrow(
      /are the same/,
    );
  });
});

describe('withSourcePatchesSchema', () => {
  it('adds source_patches only to the supported Update tools', () => {
    const s = withSourcePatchesSchema('UpdateProgram', progSchema);
    expect(s.properties.source_patches.type).toBe('array');
    expect(s.properties.source_patches.maxItems).toBe(50);
    expect(s.properties.source_patches.items.required).toEqual([
      'old_string',
      'new_string',
    ]);
    expect(s.required).toEqual(['program_name']);
    for (const name of [
      'CreateProgram',
      'UpdateProgramLow',
      'UpdateView',
      'UpdateBehaviorDefinition',
      'SearchObject',
    ])
      expect(withSourcePatchesSchema(name, progSchema)).toBe(progSchema);
    const local = {
      type: 'object',
      properties: {
        class_name: { type: 'string' },
        local_types_code: { type: 'string' },
      },
      required: ['class_name', 'local_types_code'],
    };
    expect(withSourcePatchesSchema('UpdateLocalTypes', local).required).toEqual(
      ['class_name'],
    );
    expect(SOURCE_PATCH_TOOLS).toEqual(
      expect.arrayContaining([
        'UpdateProgram',
        'UpdateInclude',
        'UpdateClass',
        'UpdateInterface',
        'UpdateFunctionModule',
        'UpdateLocalTypes',
        'UpdateLocalDefinitions',
        'UpdateLocalMacros',
        'UpdateLocalTestClass',
      ]),
    );
  });

  it('every real Update tool that gets source_patches has the source field it writes', () => {
    const defs = [
      require('../../handlers/program/high/handleUpdateProgram')
        .TOOL_DEFINITION,
      require('../../handlers/include/high/handleUpdateInclude')
        .TOOL_DEFINITION,
      require('../../handlers/class/high/handleUpdateClass').TOOL_DEFINITION,
      require('../../handlers/interface/high/handleUpdateInterface')
        .TOOL_DEFINITION,
      require('../../handlers/function/high/handleUpdateFunctionModule')
        .TOOL_DEFINITION,
      require('../../handlers/class/high/handleUpdateLocalTypes')
        .TOOL_DEFINITION,
      require('../../handlers/class/high/handleUpdateLocalDefinitions')
        .TOOL_DEFINITION,
      require('../../handlers/class/high/handleUpdateLocalMacros')
        .TOOL_DEFINITION,
      require('../../handlers/class/high/handleUpdateLocalTestClass')
        .TOOL_DEFINITION,
    ];
    for (const d of defs) {
      const s = withSourcePatchesSchema(d.name, d.inputSchema);
      expect([d.name, !!s.properties.source_patches]).toEqual([d.name, true]);
    }
  });
});

describe('resolveSourcePatchesArg', () => {
  it('passes calls without source_patches through', async () => {
    const a = { program_name: 'Z1', source_code: 'x' };
    expect(
      await resolveSourcePatchesArg('UpdateProgram', progSchema, a, ctx),
    ).toEqual({ args: a });
    expect(reads).toHaveLength(0);
  });

  it('reads the inactive version first and patches it', async () => {
    store.program = {
      inactive: 'REPORT z.\nWRITE 9.\n',
      active: 'REPORT z.\nWRITE 1.\n',
    };
    const r = await resolveSourcePatchesArg(
      'UpdateProgram',
      progSchema,
      {
        program_name: 'z1',
        transport_request: 'T1',
        source_patches: [P('WRITE 9.', 'WRITE 10.')],
      },
      ctx,
    );
    expect(r.args).toEqual({
      program_name: 'z1',
      transport_request: 'T1',
      source_code: 'REPORT z.\nWRITE 10.\n',
    });
    expect(r.patched).toEqual({
      count: 1,
      replacements: 1,
      bytes: Buffer.byteLength('REPORT z.\nWRITE 10.\n'),
      source_sha256: sha('REPORT z.\nWRITE 10.\n'),
    });
    // Inactive first (the patch base); active only to tell a real inactive version apart.
    expect(reads).toEqual([
      { kind: 'program', config: { programName: 'Z1' }, version: 'inactive' },
      { kind: 'program', config: { programName: 'Z1' }, version: 'active' },
    ]);
    expect(r.restore?.hadInactive).toBe(true);
  });

  it('falls back to the active version when no inactive one exists', async () => {
    store.class = { active: 'CLASS zc DEFINITION.\r\nENDCLASS.\r\n' };
    const r = await resolveSourcePatchesArg(
      'UpdateClass',
      { type: 'object', properties: { class_name: {}, source_code: {} } },
      { class_name: 'ZC', source_patches: [P('ENDCLASS.', 'ENDCLASS. "x')] },
      ctx,
    );
    expect(r.args.source_code).toBe('CLASS zc DEFINITION.\r\nENDCLASS. "x\r\n');
    expect(r.patched!.source_sha256).toBe(
      sha('CLASS zc DEFINITION.\r\nENDCLASS. "x\r\n'),
    );
    expect(reads.map((x) => x.version)).toEqual(['inactive', 'active']);
  });

  it('refuses a non-404 read error instead of patching the active text', async () => {
    const e: any = new Error('boom');
    e.response = { status: 500 };
    store.program = { inactive: e, active: 'REPORT z.\n' };
    await expect(
      resolveSourcePatchesArg(
        'UpdateProgram',
        progSchema,
        { program_name: 'Z1', source_patches: [P('z', 'y')] },
        ctx,
      ),
    ).rejects.toThrow(
      /cannot read the current source of Z1 — nothing uploaded/,
    );
  });

  it('reads includes, function modules and local class parts with their own names', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const inc = await resolveSourcePatchesArg(
      'UpdateInclude',
      { type: 'object', properties: { include_name: {}, source_code: {} } },
      { include_name: 'zi_top', source_patches: [P('FORM a.', 'FORM b.')] },
      ctx,
    );
    expect(inc.args.source_code).toBe('FORM b.\nENDFORM.\n');
    expect(reads.map((x) => x.config.url)).toEqual([
      '/sap/bc/adt/programs/includes/ZI_TOP/source/main?version=inactive',
      '/sap/bc/adt/programs/includes/ZI_TOP/source/main?version=active',
    ]);

    reads.length = 0;
    store.fm = { inactive: 'FUNCTION z_f.\nENDFUNCTION.\n' };
    const fm = await resolveSourcePatchesArg(
      'UpdateFunctionModule',
      {
        type: 'object',
        properties: {
          function_group_name: {},
          function_module_name: {},
          source_code: {},
        },
      },
      {
        function_group_name: 'zfg',
        function_module_name: 'z_f',
        source_patches: [P('ENDFUNCTION.', '  " x\nENDFUNCTION.')],
      },
      ctx,
    );
    expect(fm.args.source_code).toBe('FUNCTION z_f.\n  " x\nENDFUNCTION.\n');
    expect(reads[0].config).toEqual({
      functionModuleName: 'Z_F',
      functionGroupName: 'ZFG',
    });
    await expect(
      resolveSourcePatchesArg(
        'UpdateFunctionModule',
        {
          type: 'object',
          properties: {
            function_group_name: {},
            function_module_name: {},
            source_code: {},
          },
        },
        { function_module_name: 'z_f', source_patches: [P('a', 'b')] },
        ctx,
      ),
    ).rejects.toThrow(/needs function_group_name/);

    store.localTypes = { inactive: 'TYPES ty TYPE i.\n' };
    const lt = await resolveSourcePatchesArg(
      'UpdateLocalTypes',
      { type: 'object', properties: { class_name: {}, local_types_code: {} } },
      { class_name: 'zc', source_patches: [P('TYPE i.', 'TYPE p.')] },
      ctx,
    );
    expect(lt.args).toEqual({
      class_name: 'zc',
      local_types_code: 'TYPES ty TYPE p.\n',
    });
  });

  it('refuses source_patches with source_code or source_file, and on unsupported tools', async () => {
    store.program = { active: 'REPORT z.\n' };
    await expect(
      resolveSourcePatchesArg(
        'UpdateProgram',
        progSchema,
        {
          program_name: 'Z1',
          source_code: 'REPORT z.',
          source_patches: [P('z', 'y')],
        },
        ctx,
      ),
    ).rejects.toThrow(/give source_patches alone/);
    await expect(
      resolveSourcePatchesArg(
        'UpdateProgram',
        progSchema,
        {
          program_name: 'Z1',
          source_file: '/x.abap',
          source_patches: [P('z', 'y')],
        },
        ctx,
      ),
    ).rejects.toThrow(/give source_patches alone/);
    await expect(
      resolveSourcePatchesArg(
        'UpdateView',
        progSchema,
        { view_name: 'Z', source_patches: [P('a', 'b')] },
        ctx,
      ),
    ).rejects.toThrow(/UpdateView does not take source_patches/);
    await expect(
      resolveSourcePatchesArg(
        'UpdateProgramLow',
        progSchema,
        { program_name: 'Z', source_patches: [P('a', 'b')] },
        ctx,
      ),
    ).rejects.toThrow(/does not take source_patches/);
    expect(reads).toHaveLength(0);
  });
});

describe('review fixes', () => {
  const savedProfile = process.env.MCP_BLOCKLIST_PROFILE;
  afterEach(() => {
    if (savedProfile === undefined) delete process.env.MCP_BLOCKLIST_PROFILE;
    else process.env.MCP_BLOCKLIST_PROFILE = savedProfile;
  });
  const run = (args: any, schema: any = progSchema, tool = 'UpdateProgram') =>
    resolveSourcePatchesArg(tool, schema, args, ctx);

  it('refuses source_patches with a present source field even when it is "" / blank / null', async () => {
    store.program = { active: 'REPORT z.\n' };
    for (const source_code of ['', '   ', null, undefined])
      await expect(
        run({ program_name: 'Z1', source_code, source_patches: [P('z', 'y')] }),
      ).rejects.toThrow(/give source_patches alone/);
    await expect(
      run({
        program_name: 'Z1',
        source_file: '',
        source_patches: [P('z', 'y')],
      }),
    ).rejects.toThrow(/give source_patches alone/);
    await expect(
      run(
        {
          class_name: 'ZC',
          test_class_code: '',
          source_patches: [P('a', 'b')],
        },
        { type: 'object', properties: { class_name: {}, test_class_code: {} } },
        'UpdateLocalTestClass',
      ),
    ).rejects.toThrow(/not together with test_class_code/);
    expect(reads).toHaveLength(0);
  });

  // Policy (verifier #3, 2026-11-24): exactly "same as a full upload" — the hook scans a full upload
  // only when it is test code, so a patch to test code is refused outright (current or patched text);
  // business code passes. No blocklist profile on the server.
  const TC = (body: string) =>
    'CLASS ltcl DEFINITION FINAL FOR TESTING.\n  PRIVATE SECTION. METHODS m FOR TESTING.\nENDCLASS.\n' +
    `CLASS ltcl IMPLEMENTATION.\n  METHOD m.\n${body}\n  ENDMETHOD.\nENDCLASS.\n`;
  const REFUSED =
    /^source_patches refused — this source contains test classes \(FOR TESTING, or a class implementation whose definition is in another include\); nothing uploaded\. Send the full source_code so the blocklist hook can check it\.$/;

  it('an include holding only a class implementation (definition elsewhere) is test code — refused', async () => {
    const schema = {
      type: 'object',
      properties: { include_name: {}, source_code: {} },
    };
    store.include = {
      active:
        'CLASS ltcl_x IMPLEMENTATION.\n  METHOD t1.\n    lv = 1.\n  ENDMETHOD.\nENDCLASS.\n',
    };
    await expect(
      run(
        { include_name: 'ZI_T99', source_patches: [P('lv = 1.', 'lv = 2.')] },
        schema,
        'UpdateInclude',
      ),
    ).rejects.toThrow(REFUSED);
  });

  it('orphan-implementation rule: definition in the same text, DEFERRED, literals and comments', () => {
    const impl = 'CLASS lcl_a IMPLEMENTATION.\nENDCLASS.\n';
    expect(
      isReadChannel(
        'UpdateProgram',
        'CLASS lcl_a DEFINITION.\nENDCLASS.\n' + impl,
      ),
    ).toBe(false);
    expect(
      isReadChannel(
        'UpdateProgram',
        'CLASS lcl_a DEFINITION DEFERRED.\n' + impl,
      ),
    ).toBe(true);
    expect(isReadChannel('UpdateProgram', impl)).toBe(true);
    expect(
      isReadChannel(
        'UpdateProgram',
        "lv = 'CLASS x IMPLEMENTATION'. \" CLASS y IMPLEMENTATION\n",
      ),
    ).toBe(false);
    expect(
      isReadChannel(
        'UpdateProgram',
        'CLASS /abc/cl_a DEFINITION.\nENDCLASS.\nCLASS /ABC/CL_A IMPLEMENTATION.\nENDCLASS.\n',
      ),
    ).toBe(false);
  });

  it('a | inside an embedded expression of a template does not hide code (verifier F1)', () => {
    expect(
      isReadChannel(
        'UpdateProgram',
        "DATA(s) = |{ '|' }|. CLASS ltc DEFINITION FOR TESTING. ENDCLASS. DATA(t) = |x|.",
      ),
    ).toBe(true);
    expect(
      isReadChannel(
        'UpdateProgram',
        "DATA(u) = |{ '|' }|. CLASS ltc IMPLEMENTATION. METHOD m. ENDMETHOD. ENDCLASS. DATA(v) = |x|.",
      ),
    ).toBe(true);
    expect(
      isReadChannel(
        'UpdateProgram',
        'lv = |a { |b{ `|` }c| } d|. CLASS ltc DEFINITION FOR TESTING.',
      ),
    ).toBe(true);
    expect(
      isReadChannel('UpdateProgram', "lv = |FOR TESTING { 'FOR TESTING' }|."),
    ).toBe(false);
    expect(stripAbapComments("x = |a{ y }b|. \" c\n* z\nw = 'q'.")).toBe(
      "x = |{ y }|. \n\nw = ''.",
    );
  });

  it('colon chaining and LOCAL FRIENDS (verifier F2, F5)', () => {
    expect(
      isReadChannel('UpdateProgram', 'CLASS ltc DEFINITION FOR: TESTING.'),
    ).toBe(true);
    expect(
      isReadChannel('UpdateProgram', 'CLASS: ltc IMPLEMENTATION.\nENDCLASS.'),
    ).toBe(true);
    expect(
      isReadChannel(
        'UpdateProgram',
        'CLASS zcl_a DEFINITION LOCAL FRIENDS ltc.\nCLASS ltc IMPLEMENTATION.\nENDCLASS.',
      ),
    ).toBe(true);
  });

  it('a literal holding another quote kind does not hide FOR TESTING', () => {
    expect(
      isReadChannel(
        'UpdateProgram',
        "lv = `don't`. CLASS ltcl DEFINITION FOR TESTING. lv2 = 'x'.",
      ),
    ).toBe(true);
    expect(
      isReadChannel(
        'UpdateProgram',
        "lv = |'|. CLASS ltcl DEFINITION FOR TESTING. lv2 = 'x'.",
      ),
    ).toBe(true);
  });

  it('business code: patches reading or typing KNA1 / USR21 pass (same as a full upload)', async () => {
    delete process.env.MCP_BLOCKLIST_PROFILE;
    store.program = {
      active:
        'REPORT z.\nSELECT SINGLE bukrs FROM t001 INTO @DATA(lv).\nWRITE 1.\n',
    };
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [P('FROM t001', 'FROM kna1')],
      }),
    ).resolves.toBeDefined();
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [
          P(
            'WRITE 1.',
            'SELECT * FROM usr21 INTO TABLE @DATA(lt).\nDATA ls TYPE kna1.',
          ),
        ],
      }),
    ).resolves.toBeDefined();
  });

  it('any patch to a source containing FOR TESTING is refused — even a harmless one, before any upload', async () => {
    store.program = { active: 'REPORT z.\nWRITE 1.\n' + TC('    lv = 1.') };
    await expect(
      run({ program_name: 'Z1', source_patches: [P('WRITE 1.', 'WRITE 2.')] }),
    ).rejects.toThrow(REFUSED);
    // strict / custom-only tables (e.g. DBTABLOG) never depend on a server profile
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [
          P('lv = 1.', 'SELECT * FROM dbtablog INTO TABLE @DATA(lt).'),
        ],
      }),
    ).rejects.toThrow(REFUSED);
  });

  it('moving a read from business code into the test class is refused (equal table counts)', async () => {
    store.program = {
      active:
        'REPORT z.\nSELECT * FROM usr21 INTO TABLE @DATA(lt).\n' +
        TC('    lv = 1.'),
    };
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [
          P('SELECT * FROM usr21 INTO TABLE @DATA(lt).\n', ''),
          P('lv = 1.', 'SELECT * FROM usr21 INTO TABLE @DATA(lt).'),
        ],
      }),
    ).rejects.toThrow(REFUSED);
  });

  it('a patch that adds or removes FOR TESTING is refused', async () => {
    store.program = { active: 'REPORT z.\nWRITE 1.\n' };
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [P('WRITE 1.', 'WRITE 1.\n' + TC('    lv = 1.'))],
      }),
    ).rejects.toThrow(REFUSED);
    store.program = { active: 'REPORT z.\n' + TC('    lv = 1.') };
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [
          P('FINAL FOR TESTING', 'FINAL'),
          P('m FOR TESTING', 'm'),
        ],
      }),
    ).rejects.toThrow(REFUSED);
  });

  it('UpdateLocalTestClass is refused before any read', async () => {
    const schema = {
      type: 'object',
      properties: { class_name: {}, test_class_code: {} },
    };
    store.localTestClass = { inactive: 'METHOD m.\n  lv = 1.\nENDMETHOD.\n' };
    await expect(
      run(
        { class_name: 'ZC', source_patches: [P('lv = 1.', 'lv = 2.')] },
        schema,
        'UpdateLocalTestClass',
      ),
    ).rejects.toThrow(REFUSED);
    expect(reads).toHaveLength(0);
  });

  it('a " inside a |…| template with an escaped \\| does not hide FOR TESTING', async () => {
    store.program = {
      active:
        'REPORT z.\nlv = |a\\|"|. CLASS ltcl DEFINITION FOR TESTING.\nENDCLASS.\nWRITE 1.\n',
    };
    await expect(
      run({ program_name: 'Z1', source_patches: [P('WRITE 1.', 'WRITE 2.')] }),
    ).rejects.toThrow(REFUSED);
  });

  it('FOR TESTING only in a comment or literal does not make test code', async () => {
    store.program = {
      active: `REPORT z.\n* FOR TESTING\nlv = 'FOR TESTING'. " FOR TESTING\nWRITE 1.\n`,
    };
    await expect(
      run({ program_name: 'Z1', source_patches: [P('WRITE 1.', 'WRITE 2.')] }),
    ).resolves.toBeDefined();
  });

  it('replacements counts what was replaced, not overlapping matches', () => {
    expect(applySourcePatches('aaaa\n', [P('aa', 'b', true)])).toEqual({
      text: 'bb\n',
      replacements: 2,
    });
    expect(applySourcePatches('aaa\n', [P('aa', 'b', true)])).toEqual({
      text: 'ba\n',
      replacements: 1,
    });
  });

  it('reads a function-group include from the URL UpdateInclude writes', async () => {
    const schema = {
      type: 'object',
      properties: { include_name: {}, source_code: {} },
    };
    store.include = { inactive: 'FORM a.\nENDFORM.\n' };
    await run(
      {
        include_name: 'LZFGF01',
        function_group: 'zfg',
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      schema,
      'UpdateInclude',
    );
    await run(
      {
        include_name: 'LZFGF01',
        main_program: 'SAPLZFG',
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      schema,
      'UpdateInclude',
    );
    expect(reads.map((r) => r.config.url)).toEqual([
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgf01/source/main?version=inactive',
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgf01/source/main?version=active',
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgf01/source/main?version=inactive',
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgf01/source/main?version=active',
    ]);
  });

  it('counts overlapping occurrences', () => {
    expect(() => applySourcePatches('aaa\n', [P('aa', 'b')])).toThrow(
      /found 2 times/,
    );
    expect(applySourcePatches('aaa\n', [P('aa', 'b', true)]).text).toBe('ba\n');
  });

  it('mixed line endings: patches the raw text when old_string matches as written, else refuses', () => {
    const src = 'REPORT z.\r\nWRITE 1.\nWRITE 2.\r\n';
    expect(applySourcePatches(src, [P('WRITE 1.', 'WRITE 9.')]).text).toBe(
      'REPORT z.\r\nWRITE 9.\nWRITE 2.\r\n',
    );
    expect(
      applySourcePatches(src, [P('WRITE 1.\nWRITE 2.', 'WRITE 3.')]).text,
    ).toBe('REPORT z.\r\nWRITE 3.\r\n');
    expect(() =>
      applySourcePatches(src, [P('REPORT z.\nWRITE 1.', 'x')]),
    ).toThrow(/mixed line endings — nothing uploaded, send source_code/);
  });

  it('an inactive version that reads as "" is used, not replaced by the active one', async () => {
    store.program = { inactive: '', active: 'REPORT z.\n' };
    await expect(
      run({
        program_name: 'Z1',
        source_patches: [P('REPORT z.', 'REPORT y.')],
      }),
    ).rejects.toThrow(/found 0 times/);
    // The "" inactive text is the patch base; active is read only for the comparison.
    expect(reads.map((r) => r.version)).toEqual(['inactive', 'active']);
  });
});

describe('attachPatchedInfo', () => {
  const patched = { count: 1, replacements: 1, bytes: 3, source_sha256: 'abc' };
  it('adds patched to the JSON result and leaves errors alone', () => {
    const r = attachPatchedInfo(
      { content: [{ type: 'text', text: '{"success":true}' }] },
      patched,
    );
    expect(JSON.parse((r as any).content[0].text)).toEqual({
      success: true,
      patched,
    });
    const err = { isError: true, content: [{ type: 'text', text: 'x' }] };
    expect(attachPatchedInfo(err, patched)).toBe(err);
    const plain = attachPatchedInfo(
      { content: [{ type: 'text', text: 'ok' }] },
      patched,
    ) as any;
    expect(plain.content[1]).toEqual({
      type: 'text',
      text: JSON.stringify({ patched }),
    });
  });
});

describe('BaseMcpServer registration wrapper — source_patches', () => {
  function buildServer() {
    const { BaseMcpServer } = require('../../server/BaseMcpServer');
    const {
      CompositeHandlersRegistry,
    } = require('../../lib/handlers/registry/CompositeHandlersRegistry');
    const calls: any[] = [];
    const tools: Record<
      string,
      { config: any; run: (a: any) => Promise<any> }
    > = {};
    const group = {
      getName: () => 'test',
      getHandlers: () => [
        {
          toolDefinition: {
            name: 'UpdateProgram',
            description: 'x',
            inputSchema: progSchema,
          },
          handler: async (_ctx: any, args: any) => {
            calls.push(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    program_name: args.program_name,
                  }),
                },
              ],
            };
          },
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
    const { applyProfile, __resetProfileState } = require('../../lib/profile');
    __resetProfileState();
    applyProfile({
      alias: 'T-DEV',
      sourcePath: '/dev/null',
      envVars: { SAP_TIER: 'DEV' },
      tier: 'DEV',
      readonly: false,
      legacy: false,
    });
    new TestServer().register(new CompositeHandlersRegistry([group]));
    return { tools, calls };
  }

  it('uploads the patched source and returns patched.source_sha256 of it, never the source', async () => {
    store.program = { active: 'REPORT z.\r\nWRITE 1.\r\n' };
    const { tools, calls } = buildServer();
    expect(Object.keys(tools.UpdateProgram.config.inputSchema)).toContain(
      'source_patches',
    );
    // The zod shape the SDK validates with keeps the patches (source_code no longer required).
    const { z } = require('zod');
    expect(
      z.object(tools.UpdateProgram.config.inputSchema).parse({
        program_name: 'Z1',
        source_patches: [
          { old_string: 'a', new_string: 'b', replace_all: true },
        ],
      }),
    ).toEqual({
      program_name: 'Z1',
      source_patches: [{ old_string: 'a', new_string: 'b', replace_all: true }],
    });
    const res = await tools.UpdateProgram.run({
      program_name: 'Z1',
      source_patches: [P('WRITE 1.', 'WRITE 2.')],
    });
    expect(calls).toEqual([
      { program_name: 'Z1', source_code: 'REPORT z.\r\nWRITE 2.\r\n' },
    ]);
    const out = JSON.parse(res.content[0].text);
    expect(out.patched).toEqual({
      count: 1,
      replacements: 1,
      bytes: Buffer.byteLength('REPORT z.\r\nWRITE 2.\r\n'),
      source_sha256: sha('REPORT z.\r\nWRITE 2.\r\n'),
    });
    expect(res.content[0].text).not.toContain('REPORT');
  });

  it('refuses the whole call when one patch does not match — the handler never runs', async () => {
    store.program = { active: 'REPORT z.\nWRITE 1.\nWRITE 1.\n' };
    const { tools, calls } = buildServer();
    await expect(
      tools.UpdateProgram.run({
        program_name: 'Z1',
        source_patches: [
          P('REPORT z.', 'REPORT y.'),
          P('WRITE 1.', 'WRITE 2.'),
        ],
      }),
    ).rejects.toThrow(/source_patches\[1\]: old_string found 2 times/);
    await expect(
      tools.UpdateProgram.run({
        program_name: 'Z1',
        source_patches: [P('WRITE 7.', 'WRITE 2.')],
      }),
    ).rejects.toThrow(/source_patches\[0\]: old_string found 0 times/);
    await expect(
      tools.UpdateProgram.run({
        program_name: 'Z1',
        source_code: 'REPORT z.',
        source_patches: [P('a', 'b')],
      }),
    ).rejects.toThrow(/give source_patches alone/);
    expect(calls).toHaveLength(0);
  });
});

describe('source_patches — a failed patched call never leaves its source behind', () => {
  const progSchema = {
    type: 'object',
    properties: { program_name: {}, source_code: {}, activate: {} },
  };
  const incSchema = {
    type: 'object',
    properties: { include_name: {}, source_code: {}, activate: {} },
  };
  beforeEach(() => {
    reads.length = 0;
    store = {};
  });

  it('include saved then activation fails → previous source re-uploaded and activated', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const calls: any[] = [];
    const invoke = jest.fn(async (a: any) => {
      calls.push(a);
      store.include = { ...store.include, inactive: a.source_code };
      if (calls.length === 1)
        throw new Error('Include ZI activation failed (1 error)');
      if (a.activate) store.include = { active: a.source_code };
      return { isError: false, content: [{ type: 'text', text: '{}' }] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /activation failed[\s\S]*the failed patch was undone — the previous source is active again/,
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      include_name: 'ZI',
      source_code: 'FORM a.\nENDFORM.\n',
      activate: true,
    });
    expect(store.include).toEqual({ active: 'FORM a.\nENDFORM.\n' });
  });

  it('ECC: ?version=inactive returns the active text when none exists → undo still activates (HKT-DEV live 2026-11-24)', async () => {
    const src = 'FORM a.\nENDFORM.\n';
    store.include = {
      active: src,
      inactive: src.replace(/\n/g, '\r\n') + '\r\n',
    };
    const calls: any[] = [];
    const invoke = jest.fn(async (a: any) => {
      calls.push(a);
      store.include = { ...store.include, inactive: a.source_code };
      if (calls.length === 1)
        throw new Error('Include ZI activation failed (1 error)');
      if (a.activate)
        store.include = { active: a.source_code, inactive: a.source_code };
      return { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    expect(resolved.restore?.hadInactive).toBe(false);
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /the previous source is active again/,
    );
    expect(calls[1]).toMatchObject({ activate: true });
  });

  it('inactive version exists but active is unreadable → treated as inactive (not activated)', async () => {
    const e: any = new Error('boom');
    e.response = { status: 500 };
    store.include = { active: e, inactive: 'FORM a.\nENDFORM.\n' };
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    expect(resolved.restore?.hadInactive).toBe(true);
  });

  it("someone else's inactive version existed → it is restored, not activated", async () => {
    store.include = {
      active: 'FORM a.\nENDFORM.\n',
      inactive: 'FORM a.\n  " wip\nENDFORM.\n',
    };
    const calls: any[] = [];
    const invoke = jest.fn(async (a: any) => {
      calls.push(a);
      store.include = { ...store.include, inactive: a.source_code };
      return calls.length === 1
        ? {
            isError: true,
            content: [{ type: 'text', text: 'activation failed' }],
          }
        : { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('" wip', '" wip2')],
      },
      ctx,
    );
    const res = await runWithPatchRestore(resolved, ctx, invoke);
    expect(res.isError).toBe(true);
    expect(res.content.map((c: any) => c.text).join('\n')).toMatch(
      /previous inactive version is back \(not activated\)/,
    );
    expect(calls[1]).toMatchObject({
      source_code: 'FORM a.\n  " wip\nENDFORM.\n',
      activate: false,
    });
    expect(store.include.inactive).toBe('FORM a.\n  " wip\nENDFORM.\n');
  });

  it('failure before the upload (pre-write check) → nothing to undo, no second call', async () => {
    store.program = { active: 'REPORT z.\nWRITE 1.\n' };
    const invoke = jest.fn(async () => {
      throw new Error('preCheck syntax check failed');
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateProgram',
      progSchema,
      { program_name: 'Z1', source_patches: [P('WRITE 1.', 'WRITE x.')] },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /preCheck syntax check failed\nsource_patches: the patched source was not saved — nothing to undo\./,
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('undo itself fails → the error says the patched source is still saved', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      if (invoke.mock.calls.length > 1) throw new Error('lock failed'); // nothing saved by the undo
      store.include = { ...store.include, inactive: a.source_code };
      throw new Error('activation failed');
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /UNDO FAILED \(lock failed\) — the PATCHED source is still saved/,
    );
  });

  // Same text the handler throws (built from the shared constant).
  const STAGED = `Include ZI activation failed (1 error): [L3] Field "X" is unknown.. ${INCLUDE_STAGED_ADVICE}`;

  it('the shared advice is the handler wording', () => {
    expect(INCLUDE_STAGED_ADVICE).toMatch(
      /broken source is staged as inactive and must be replaced via a second UpdateInclude call\.$/,
    );
  });

  it("ECC class: inactive read = active text → NOT activated on undo (other class parts may hold someone's WIP; verifier 2)", async () => {
    const src = 'CLASS zc DEFINITION.\nENDCLASS.\n';
    store.class = { active: src, inactive: src };
    const classSchema = {
      type: 'object',
      properties: { class_name: {}, source_code: {}, activate: {} },
    };
    const calls: any[] = [];
    const invoke = jest.fn(async (a: any) => {
      calls.push(a);
      store.class = { ...store.class, inactive: a.source_code };
      return calls.length === 1
        ? {
            isError: true,
            content: [{ type: 'text', text: 'activation failed' }],
          }
        : { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateClass',
      classSchema,
      {
        class_name: 'ZC',
        activate: true,
        source_patches: [P('ENDCLASS.', 'ENDCLASS. "x')],
      },
      ctx,
    );
    expect(resolved.restore?.hadInactive).toBe(true);
    const res = await runWithPatchRestore(resolved, ctx, invoke);
    expect(calls[1]).toMatchObject({ source_code: src, activate: false });
    expect(res.content.map((c: any) => c.text).join('\n')).toMatch(
      /saved as the inactive version, not activated: activating it would also activate the other parts/,
    );
  });

  it('active read fails (500) → kept inactive and the note says it could not tell (verifier 3)', async () => {
    const e: any = new Error('HTTP 500');
    e.response = { status: 500 };
    const src = 'FORM a.\nENDFORM.\n';
    store.include = { active: e, inactive: src };
    const invoke = jest.fn(async (a: any) => {
      store.include = { ...store.include, inactive: a.source_code };
      if (invoke.mock.calls.length === 1) throw new Error(STAGED);
      return { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    const err: Error = await runWithPatchRestore(resolved, ctx, invoke).then(
      () => {
        throw new Error('no throw');
      },
      (x) => x,
    );
    expect(invoke.mock.calls[1][0]).toMatchObject({ activate: false });
    expect(err.message).toMatch(
      /not activated: the active version could not be read \(HTTP 500\)/,
    );
    expect(err.message).not.toMatch(/previous inactive version is back/);
  });

  it('never activated (active 404) + inactive exists → real inactive version, plain note', async () => {
    store.include = { inactive: 'FORM a.\nENDFORM.\n' };
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    expect(resolved.restore).toMatchObject({ hadInactive: true });
    expect(resolved.restore?.unsure).toBeUndefined();
  });

  it('saved text is neither patched nor pre-patch → NOT UNDONE, advice kept (verifier 4)', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async () => {
      store.include = {
        ...store.include,
        inactive: 'FORM mangled.\nENDFORM.\n',
      };
      throw new Error(STAGED);
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /broken source is staged as inactive[\s\S]*NOT UNDONE — the saved source is neither/,
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('undo call succeeds but read-back differs → UNDO UNCONFIRMED, advice kept (verifier 5)', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      if (invoke.mock.calls.length === 1) {
        store.include = { ...store.include, inactive: a.source_code };
        throw new Error(STAGED);
      }
      return { content: [] }; // claims success, saves nothing
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /broken source is staged as inactive[\s\S]*UNDO UNCONFIRMED/,
    );
  });

  it('undo succeeded → the handler\'s "staged as inactive" advice is dropped (HKT-DEV live 2026-11-24)', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      store.include = { ...store.include, inactive: a.source_code };
      if (invoke.mock.calls.length === 1) throw new Error(STAGED);
      if (a.activate) store.include = { active: a.source_code };
      return { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    const err: Error = await runWithPatchRestore(resolved, ctx, invoke).then(
      () => {
        throw new Error('no throw');
      },
      (e) => e,
    );
    expect(err.message).toBe(
      'Include ZI activation failed (1 error): [L3] Field "X" is unknown..\n' +
        'source_patches: the failed patch was undone — the previous source is active again.',
    );
  });

  it('undo failed → the "staged as inactive" advice stays (it is still true)', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      if (invoke.mock.calls.length > 1) throw new Error('lock failed');
      store.include = { ...store.include, inactive: a.source_code };
      throw new Error(STAGED);
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /broken source is staged as inactive[\s\S]*UNDO FAILED/,
    );
  });

  it('isError result + undo succeeded → advice dropped from the text items too', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      store.include = { ...store.include, inactive: a.source_code };
      if (invoke.mock.calls.length === 1)
        return { isError: true, content: [{ type: 'text', text: STAGED }] };
      if (a.activate) store.include = { active: a.source_code };
      return { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    const res = await runWithPatchRestore(resolved, ctx, invoke);
    const text = res.content.map((c: any) => c.text).join('\n');
    expect(text).not.toMatch(/staged as inactive/);
    expect(text).toMatch(/the failed patch was undone/);
  });

  it('SAP drops trailing blanks on save — the undo still recognises the patched text (verifier A)', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      const saved = a.source_code
        .split('\n')
        .map((l: string) => l.trimEnd())
        .join('\n')
        .replace(/\n+$/, '');
      store.include = {
        ...store.include,
        inactive: saved.replace(/\n/g, '\r\n'),
      };
      if (invoke.mock.calls.length === 1) throw new Error('activation failed');
      if (a.activate) store.include = { active: a.source_code };
      return { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.  ')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /the failed patch was undone/,
    );
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('local class parts undo with activate_on_update, not activate (verifier B)', async () => {
    const schema = {
      type: 'object',
      properties: {
        class_name: {},
        local_types_code: {},
        activate_on_update: {},
      },
    };
    store.localTypes = {
      active: 'TYPES t TYPE i.\n',
      inactive: 'TYPES t TYPE i. " wip\n',
    };
    const calls: any[] = [];
    const invoke = jest.fn(async (a: any) => {
      calls.push(a);
      store.localTypes = { ...store.localTypes, inactive: a.local_types_code };
      if (calls.length === 1) throw new Error('activation failed');
      return { content: [] };
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateLocalTypes',
      schema,
      {
        class_name: 'ZCL_A',
        activate_on_update: true,
        source_patches: [P('" wip', '" wip2')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /previous inactive version is back/,
    );
    expect(calls[1]).toMatchObject({
      local_types_code: 'TYPES t TYPE i. " wip\n',
      activate_on_update: false,
    });
    expect(calls[1]).not.toHaveProperty('activate');
  });

  it('undo saved the old text but its activation failed → the note says so (verifier C)', async () => {
    store.include = { active: 'FORM a.\nENDFORM.\n' };
    const invoke = jest.fn(async (a: any) => {
      store.include = { ...store.include, inactive: a.source_code };
      throw new Error('activation failed');
    });
    const resolved = await resolveSourcePatchesArg(
      'UpdateInclude',
      incSchema,
      {
        include_name: 'ZI',
        activate: true,
        source_patches: [P('FORM a.', 'FORM b.')],
      },
      ctx,
    );
    await expect(runWithPatchRestore(resolved, ctx, invoke)).rejects.toThrow(
      /UNDO FAILED \(activation failed\) — the pre-patch source is saved again but its activation did not finish/,
    );
  });

  it('success and non-patch calls pass straight through', async () => {
    const invoke = jest.fn(async () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));
    expect(
      await runWithPatchRestore(
        { args: { program_name: 'Z1', source_code: 'x' } },
        ctx,
        invoke,
      ),
    ).toEqual({
      content: [{ type: 'text', text: 'ok' }],
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
