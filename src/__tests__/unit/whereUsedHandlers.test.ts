/**
 * Unit tests for GetWhereUsed options / response fields and GetUsageSnippets.
 * The ADT client is mocked; object names are invented.
 */

import { createAdtClient } from '../../lib/clients';

jest.mock('../../lib/clients', () => ({ createAdtClient: jest.fn() }));
jest.mock('../../lib/getObjectsListCache', () => ({
  objectsListCache: { setCache: jest.fn() },
}));

import {
  chunk,
  handleGetUsageSnippets,
  SNIPPET_BATCH_SIZE,
  TOOL_DEFINITION as SNIPPETS_TOOL,
} from '../../handlers/system/readonly/handleGetUsageSnippets';
import {
  applyWhereUsedFilters,
  handleGetWhereUsed,
  isCustomerReference,
  matchesPackage,
  TOOL_DEFINITION as WHERE_USED_TOOL,
  whereUsedErrorHint,
} from '../../handlers/system/readonly/handleGetWhereUsed';

const mockCreate = createAdtClient as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;

function lib(ref: Partial<Record<string, any>>) {
  return {
    uri: `/sap/bc/adt/x/${String(ref.name).toLowerCase()}`,
    isResult: false,
    ...ref,
  };
}

const LIB_REFS = [
  lib({
    name: 'ZTEST_FG01',
    type: 'FUGR/F',
    packageName: 'ZTEST_PKG',
    responsible: 'DEVUSER',
  }),
  lib({
    name: 'ZTEST_FM_UPDATE',
    type: 'FUGR/FF',
    packageName: 'ZTEST_PKG',
    usageInformation: 'gradeDirect,includeProductive',
    objectIdentifier: 'ABAPFullName;SAPLZTEST_FG01;LZTEST_FG01U01;\\TY:X;2',
  }),
  lib({
    name: 'SAPMV45A',
    type: 'PROG/P',
    packageName: 'VA',
    objectIdentifier: 'ABAPFullName;SAPMV45A;MV45AF0A;\\TY:X;2',
  }),
  lib({
    name: 'LV45AF0B',
    type: 'PROG/I',
    packageName: 'VA',
    objectIdentifier: 'ABAPFullName;SAPMV45A;LV45AF0B;\\TY:X;2',
  }),
  lib({
    name: 'ZXVVAU01',
    type: 'PROG/I',
    packageName: 'ZTEST_EXIT',
    objectIdentifier: 'ABAPFullName;SAPLXVVA;ZXVVAU01;\\TY:X;2',
  }),
];

function mockUtils(over: Record<string, any> = {}) {
  const utils = {
    getWhereUsedList: jest.fn(async (p: any) => ({
      objectName: p.object_name,
      objectType: p.object_type,
      totalReferences: 4,
      resultDescription: `References for: ${p.object_name}`,
      references: LIB_REFS,
    })),
    getUsageSnippets: jest.fn(async (p: any) => ({
      objects: p.objectIdentifiers.map((id: string) => ({
        objectIdentifier: id,
        snippets: [
          {
            uri: '/src/main#start=10,2',
            sourceUri: '/src/main',
            line: 10,
            column: 2,
            content: '  SELECT * FROM X.',
            matches: '16-17,accessUnknown,gradeDirect',
            description: 'ctx',
          },
        ],
      })),
      totalSnippets: p.objectIdentifiers.length,
    })),
    ...over,
  };
  mockCreate.mockReturnValue({ getUtils: () => utils });
  return utils;
}

const json = (r: any) => r.content[0].json;

describe('GetWhereUsed helpers', () => {
  it('declares legacy availability and the new optional inputs', () => {
    expect(WHERE_USED_TOOL.available_in).toEqual(['onprem', 'cloud', 'legacy']);
    const props = Object.keys(WHERE_USED_TOOL.inputSchema.properties);
    expect(props).toEqual(
      expect.arrayContaining([
        'max_results',
        'customer_only',
        'package',
        'timeout_ms',
      ]),
    );
    expect(WHERE_USED_TOOL.inputSchema.required).toEqual([
      'object_name',
      'object_type',
    ]);
  });

  it('classifies customer references', () => {
    expect(isCustomerReference({ name: 'ZTEST_X' })).toBe(true);
    expect(isCustomerReference({ name: 'ytest' })).toBe(true);
    expect(
      isCustomerReference({ name: '/BEV1/X', package_name: '/BEV1/SR' }),
    ).toBe(false);
    expect(isCustomerReference({ name: '/1BCDWB/SF00000001' })).toBe(false);
    expect(
      isCustomerReference({ name: '/ACME/TOOL', package_name: 'ZACME' }),
    ).toBe(true);
    expect(isCustomerReference({ name: 'SAPMV45A', package_name: 'VA' })).toBe(
      false,
    );
    expect(isCustomerReference({ name: 'LXYZ', package_name: '$TMP' })).toBe(
      true,
    );
  });

  it('matches packages exactly or by prefix*', () => {
    expect(matchesPackage('ZTEST_PKG', 'ztest_pkg')).toBe(true);
    expect(matchesPackage('ZTEST_PKG2', 'ZTEST_PKG')).toBe(false);
    expect(matchesPackage('ZTEST_PKG2', 'ZTEST*')).toBe(true);
    expect(matchesPackage(undefined, 'Z*')).toBe(false);
    expect(matchesPackage('VA', '*')).toBe(true);
  });

  it('returns the list unchanged without options', () => {
    const refs = [{ name: 'A', type: 'T', uri: 'u' }];
    const r = applyWhereUsedFilters(refs, {});
    expect(r.references).toBe(refs);
    expect(r).toMatchObject({ filtered_out: 0, truncated: false });
    expect(applyWhereUsedFilters(refs, { max_results: 0 }).truncated).toBe(
      false,
    );
  });

  it('gives hints for known failures', () => {
    expect(
      whereUsedErrorHint(new Error('Error while converting object references')),
    ).toMatch(/VIT/);
    const t = new Error('timeout of 30000ms exceeded');
    (t as any).code = 'ECONNABORTED';
    expect(whereUsedErrorHint(t)).toMatch(/timeout_ms/);
    expect(
      whereUsedErrorHint(
        new Error('Unsupported object type for where-used: foo'),
      ),
    ).toMatch(/Supported object_type/);
    expect(whereUsedErrorHint(new Error('other'))).toBeUndefined();
  });
});

describe('handleGetWhereUsed', () => {
  it('keeps the existing fields and adds the new ones (no options)', async () => {
    const utils = mockUtils();
    const r = await handleGetWhereUsed(ctx, {
      object_name: 'ZTEST_TAB01',
      object_type: 'table',
    });
    expect(r.isError).toBe(false);
    const j = json(r);
    expect(Object.keys(j)).toEqual([
      'object_name',
      'object_type',
      'enable_all_types',
      'total_references',
      'result_description',
      'references',
      'returned_references',
      'truncated',
      'filtered_out',
      'notes',
    ]);
    expect(j.references).toHaveLength(5);
    expect(j.references[0]).toEqual({
      name: 'ZTEST_FG01',
      type: 'FUGR/F',
      uri: '/sap/bc/adt/x/ztest_fg01',
      package_name: 'ZTEST_PKG',
      responsible: 'DEVUSER',
      usage_information: undefined,
      object_identifier: undefined,
    });
    expect(j).toMatchObject({
      total_references: 4,
      returned_references: 5,
      truncated: false,
      filtered_out: 0,
      notes: [],
    });
    // No timeout passed through unless asked for
    expect(utils.getWhereUsedList.mock.calls[0][0]).toEqual({
      object_name: 'ZTEST_TAB01',
      object_type: 'table',
      enableAllTypes: undefined,
    });
  });

  it('applies customer_only, package and max_results; passes timeout_ms', async () => {
    const utils = mockUtils();
    const r = await handleGetWhereUsed(ctx, {
      object_name: 'VBAK',
      object_type: 'table',
      customer_only: true,
      max_results: 2,
      timeout_ms: 90000,
    });
    const j = json(r);
    expect(j.references.map((x: any) => x.name)).toEqual([
      'ZTEST_FG01',
      'ZTEST_FM_UPDATE',
    ]);
    expect(j).toMatchObject({
      returned_references: 2,
      truncated: true,
      filtered_out: 2,
    });
    expect(utils.getWhereUsedList.mock.calls[0][0].timeoutMs).toBe(90000);

    const p = json(
      await handleGetWhereUsed(ctx, {
        object_name: 'VBAK',
        object_type: 'table',
        package: 'ZTEST_E*',
      }),
    );
    expect(p.references.map((x: any) => x.name)).toEqual(['ZXVVAU01']);
    expect(p.filtered_out).toBe(4);
  });

  it('passes library notes through', async () => {
    mockUtils({
      getWhereUsedList: jest.fn(async () => ({
        objectName: 'X',
        objectType: 'program',
        totalReferences: 0,
        resultDescription: '',
        references: [],
        notes: ['legacy system (BASIS < 7.50): scope step skipped'],
      })),
    });
    const j = json(
      await handleGetWhereUsed(ctx, {
        object_name: 'X',
        object_type: 'program',
      }),
    );
    expect(j.notes).toEqual([
      'legacy system (BASIS < 7.50): scope step skipped',
    ]);
  });

  it('returns an error with a hint on failure', async () => {
    mockUtils({
      getWhereUsedList: jest.fn(async () => {
        throw new Error('Error while converting object references');
      }),
    });
    const r = await handleGetWhereUsed(ctx, {
      object_name: 'X',
      object_type: 'table',
    });
    expect(r.isError).toBe(true);
    expect((r.content[0] as any).text).toMatch(/Hint: .*SAP_VERSION=ECC/);
  });
});

describe('handleGetUsageSnippets', () => {
  it('is declared read-only for all environments', () => {
    expect(SNIPPETS_TOOL.name).toBe('GetUsageSnippets');
    expect(SNIPPETS_TOOL.available_in).toEqual(['onprem', 'cloud', 'legacy']);
    expect(SNIPPETS_TOOL.description.startsWith('[read-only]')).toBe(true);
  });

  it('chunks lists', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it('fetches snippets for given identifiers in batches', async () => {
    const utils = mockUtils();
    const ids = Array.from(
      { length: SNIPPET_BATCH_SIZE + 3 },
      (_, i) => `ID${i}`,
    );
    const r = await handleGetUsageSnippets(ctx, {
      object_identifiers: [...ids, 'ID0', ''],
    });
    const j = json(r);
    expect(utils.getUsageSnippets).toHaveBeenCalledTimes(2);
    expect(utils.getWhereUsedList).not.toHaveBeenCalled();
    expect(j).toMatchObject({
      source: 'object_identifiers',
      requested_objects: ids.length,
      truncated: false,
      total_snippets: ids.length,
    });
    expect(j.objects[0].snippets[0]).toEqual({
      uri: '/src/main#start=10,2',
      source_uri: '/src/main',
      line: 10,
      column: 2,
      content: '  SELECT * FROM X.',
      matches: '16-17,accessUnknown,gradeDirect',
    });
  });

  it('runs where-used first when given an object, with filters and cap', async () => {
    const utils = mockUtils();
    const r = await handleGetUsageSnippets(ctx, {
      object_name: 'VBAK',
      object_type: 'table',
      customer_only: true,
      max_objects: 1,
      include_context: true,
    });
    const j = json(r);
    expect(utils.getWhereUsedList).toHaveBeenCalledTimes(1);
    // ZTEST_FG01 has no identifier; SAP objects removed by customer_only
    expect(j).toMatchObject({
      source: 'where_used',
      object_name: 'VBAK',
      available_objects: 2,
      requested_objects: 1,
      truncated: true,
    });
    expect(j.objects[0]).toMatchObject({
      name: 'ZTEST_FM_UPDATE',
      type: 'FUGR/FF',
      package_name: 'ZTEST_PKG',
    });
    expect(j.objects[0].snippets[0].context).toBe('ctx');
    expect(j.notes[0]).toMatch(/2 referencing objects removed/);
  });

  it('asks for input when neither identifiers nor object are given', async () => {
    mockUtils();
    const r = await handleGetUsageSnippets(ctx, {});
    expect(r.isError).toBe(true);
    expect((r.content[0] as any).text).toMatch(/object_identifiers/);
  });

  it('reports an old client library clearly', async () => {
    mockUtils({ getUsageSnippets: undefined });
    const r = await handleGetUsageSnippets(ctx, { object_identifiers: ['A'] });
    expect(r.isError).toBe(true);
    expect((r.content[0] as any).text).toMatch(/3\.15\.0/);
  });
});
