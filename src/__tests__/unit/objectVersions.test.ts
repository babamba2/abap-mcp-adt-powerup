/**
 * GetObjectVersions / GetObjectVersionSource: ADT revision feed parsing, the
 * feed URI per object type, the VRSD fallback and the version source read.
 */
import { handleGetObjectVersionSource } from '../../handlers/system/readonly/handleGetObjectVersionSource';
import { handleGetObjectVersions } from '../../handlers/system/readonly/handleGetObjectVersions';
import {
  isFeedMissing,
  isVersionContentUri,
  parseVersionsFeed,
  versionsUri,
  vrsdKey,
} from '../../lib/objectVersions';
import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/rfcBackend', () => ({ callDispatch: jest.fn() }));
const dispatch = callDispatch as jest.Mock;

const BASE = '/sap/bc/adt/programs/programs/zsdr0001/source/main/versions';
const FEED = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core">
  <atom:title>Version List of ZSDR0001 (REPS)</atom:title>
  <atom:entry>
    <atom:author><atom:name>DEVUSER</atom:name></atom:author>
    <atom:content src="${BASE}/20261123101007/00000/content" type="text/plain"/>
    <atom:id>00000</atom:id>
    <atom:link href="/sap/bc/adt/cts/transportrequests/HKDK900002" rel="http://www.sap.com/adt/relations/transport/request" adtcore:name="HKDK900002" adtcore:type="RQRQ"/>
    <atom:title>Fix rounding</atom:title>
    <atom:updated>2026-11-23T10:10:07Z</atom:updated>
  </atom:entry>
  <atom:entry>
    <atom:author><atom:name>OLDUSER</atom:name></atom:author>
    <atom:link href="https://host:44300${BASE}/20230608101216/00001/content" rel="http://www.sap.com/adt/relations/content" type="text/plain"/>
    <atom:id>00001</atom:id>
    <atom:title>First version</atom:title>
    <atom:updated>2023-06-08T10:12:16Z</atom:updated>
  </atom:entry>
</atom:feed>`;

const fakeConnection = (handler: (req: any) => any) =>
  ({ makeAdtRequest: jest.fn(async (req: any) => handler(req)) }) as any;
const ctx = (connection: any) =>
  ({
    connection,
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  }) as any;
const json = (res: any) => JSON.parse(res.content[0].text);

describe('object versions — library', () => {
  it('builds the feed URI per object type', () => {
    expect(versionsUri({ object_type: 'PROG', object_name: 'ZSDR0001' })).toBe(
      BASE,
    );
    expect(
      versionsUri({ object_type: 'PROG/I', object_name: 'ZSDR0001_F01' }),
    ).toBe('/sap/bc/adt/programs/includes/zsdr0001_f01/source/main/versions');
    expect(versionsUri({ object_type: 'CLAS', object_name: 'ZCL_A' })).toBe(
      '/sap/bc/adt/oo/classes/zcl_a/includes/main/versions',
    );
    expect(
      versionsUri({
        object_type: 'CLAS/OC',
        object_name: 'ZCL_A',
        class_include: 'implementations',
      }),
    ).toBe('/sap/bc/adt/oo/classes/zcl_a/includes/implementations/versions');
    expect(
      versionsUri({
        object_type: 'FUNC',
        object_name: 'Z_FM',
        function_group: 'ZFG',
      }),
    ).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm/source/main/versions',
    );
    expect(versionsUri({ object_type: 'INTF', object_name: 'ZIF_A' })).toMatch(
      /\/oo\/interfaces\/zif_a\/source\/main\/versions$/,
    );
  });

  it('refuses types without versioned source and a function module without its group', () => {
    expect(() =>
      versionsUri({ object_type: 'TABL', object_name: 'ZT' }),
    ).toThrow(/no source versions/);
    expect(() =>
      versionsUri({ object_type: 'FUGR/FF', object_name: 'Z_FM' }),
    ).toThrow(/function_group is required/);
    expect(() =>
      versionsUri({
        object_type: 'CLAS',
        object_name: 'ZCL_A',
        class_include: 'x',
      }),
    ).toThrow(/class_include/);
  });

  it('parses the feed: version, date, author, transport, content URI (host stripped)', () => {
    const v = parseVersionsFeed(FEED);
    expect(v).toHaveLength(2);
    expect(v[0]).toEqual({
      version: '00000',
      date: '2026-11-23T10:10:07Z',
      author: 'DEVUSER',
      transport: 'HKDK900002',
      title: 'Fix rounding',
      content_uri: `${BASE}/20261123101007/00000/content`,
    });
    expect(v[1]).toMatchObject({
      version: '00001',
      transport: '',
      content_uri: `${BASE}/20230608101216/00001/content`,
    });
    expect(
      parseVersionsFeed(
        '<atom:feed xmlns:atom="http://www.w3.org/2005/Atom"/>',
      ),
    ).toEqual([]);
  });

  it('only version content URIs count', () => {
    expect(isVersionContentUri(`${BASE}/20230608101216/00001/content`)).toBe(
      true,
    );
    expect(
      isVersionContentUri(
        'https://h/sap/bc/adt/programs/programs/z/source/main/versions/1/2/content',
      ),
    ).toBe(true);
    for (const ok of [
      '/sap/bc/adt/oo/classes/zcl_a/includes/implementations/versions/20261012072145/00001/content',
      '/sap/bc/adt/functions/groups/zsd008/fmodules/zsd_rfc_x/source/main/versions/20241016011403/00017/content',
      '/sap/bc/adt/oo/interfaces/zif_a/source/main/versions/20241016011403/00002/content',
      '/sap/bc/adt/programs/programs/%2fabc%2fzprog/source/main/versions/20241016011403/00002/content',
    ])
      expect(isVersionContentUri(ok)).toBe(true);
    expect(
      isVersionContentUri('/sap/bc/adt/programs/programs/z/source/main'),
    ).toBe(false);
    expect(isVersionContentUri('/sap/bc/adt/cts/transportrequests/X')).toBe(
      false,
    );
  });

  it('refuses traversal, encoded bytes and other paths ending in /content', () => {
    for (const bad of [
      '/sap/bc/adt/x/versions/../../../../../sap/public/info/content',
      '/sap/bc/adt/x/versions/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/foo/content',
      '/sap/bc/adt/x/versions/..\\..\\..\\..\\..\\foo/content',
      '/sap/bc/adt/programs/programs/../../../foo/source/main/versions/1/2/content',
      '/sap/bc/adt/programs/programs/%2e%2e/source/main/versions/1/2/content',
      '/sap/bc/adt/programs/programs/z%5cy/source/main/versions/1/2/content',
      '/sap/bc/adt/programs/programs/z/source/main/versions/1/2/content?x=1',
      '/sap/bc/adt/programs/programs/z/source/main/versions/1/2/content#x',
      '/sap/bc/adt/programs/programs/z/source/main/versions/./1/2/content',
      '/sap/bc/adt/programs/programs/z/source/main/versions/a/2/content',
      '/sap/bc/adt/programs/programs/z/source/other/versions/1/2/content',
      '/sap/bc/adt/ddic/tables/z/source/main/versions/1/2/content',
      '//evil/sap/bc/adt/programs/programs/z/source/main/versions/1/2/content',
      '/sap/bc/adt/programs/programs/z/source/main/versions/1/2/content\n',
    ])
      expect(isVersionContentUri(bad)).toBe(false);
  });

  it('tells a missing feed from a real failure — the status decides when there is one', () => {
    expect(isFeedMissing({ response: { status: 404 } })).toBe(true);
    expect(isFeedMissing({ response: { status: 501 } })).toBe(true);
    expect(isFeedMissing(new Error('Resource not found'))).toBe(true);
    expect(isFeedMissing({ response: { status: 401 } })).toBe(false);
    expect(isFeedMissing(new Error('socket hang up'))).toBe(false);
    expect(
      isFeedMissing({ status: 500, message: 'Program ZX does not exist' }),
    ).toBe(false);
    expect(
      isFeedMissing({
        status: 403,
        message: 'Operation not supported for user',
      }),
    ).toBe(false);
    expect(isFeedMissing({ response: { status: 400 } })).toBe(false);
  });

  it('keeps leading zeros of versions and authors', () => {
    const v =
      parseVersionsFeed(`<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
      <atom:entry><atom:author><atom:name>00123</atom:name></atom:author><atom:id>00007</atom:id>
      <atom:updated>2026-01-01T00:00:00Z</atom:updated></atom:entry></atom:feed>`);
    expect(v[0]).toMatchObject({ version: '00007', author: '00123' });
  });

  it('encodes namespace names in the feed URI', () => {
    expect(
      versionsUri({ object_type: 'PROG', object_name: '/ABC/ZPROG' }),
    ).toBe('/sap/bc/adt/programs/programs/%2fabc%2fzprog/source/main/versions');
    expect(
      versionsUri({
        object_type: 'FUNC',
        object_name: '/ABC/Z_FM',
        function_group: '/ABC/ZFG',
      }),
    ).toBe(
      '/sap/bc/adt/functions/groups/%2fabc%2fzfg/fmodules/%2fabc%2fz_fm/source/main/versions',
    );
  });

  it('maps objects to their VRSD keys', () => {
    expect(vrsdKey({ object_type: 'PROG', object_name: 'zsdr0001' })).toEqual({
      objtype: 'REPS',
      objname: 'ZSDR0001',
    });
    expect(
      vrsdKey({
        object_type: 'FUNC',
        object_name: 'z_fm',
        function_group: 'ZFG',
      }),
    ).toEqual({ objtype: 'FUNC', objname: 'Z_FM' });
  });
});

describe('GetObjectVersions', () => {
  beforeEach(() => dispatch.mockReset());

  it('lists versions from the ADT feed with the feed Accept header', async () => {
    const conn = fakeConnection(() => ({ status: 200, data: FEED }));
    const res = await handleGetObjectVersions(ctx(conn), {
      object_type: 'PROG',
      object_name: 'ZSDR0001',
    });
    expect(res.isError).toBe(false);
    const out = json(res);
    expect(out).toMatchObject({
      source: 'adt',
      total: 2,
      truncated: false,
      feed_uri: BASE,
    });
    expect(out.versions[0].transport).toBe('HKDK900002');
    const req = conn.makeAdtRequest.mock.calls[0][0];
    expect(req).toMatchObject({ url: BASE, method: 'GET' });
    expect(req.headers.Accept).toMatch(/atom\+xml/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('falls back to VRSD (list only) when the system has no feed', async () => {
    const conn = fakeConnection(() => {
      throw Object.assign(new Error('Request failed with status code 404'), {
        response: { status: 404 },
      });
    });
    dispatch.mockResolvedValue({
      result: {
        rows: [
          {
            VERSNO: '1',
            KORRNUM: 'HKDK9A1ITM',
            AUTHOR: 'OLDUSER',
            DATUM: '2023-06-08',
            ZEIT: '10:12:16',
          },
          {
            VERSNO: '0',
            KORRNUM: 'HKDK9A2PQR',
            AUTHOR: 'DEVUSER',
            DATUM: '2026-11-23',
            ZEIT: '10:10:07',
          },
        ],
      },
    });
    const res = await handleGetObjectVersions(ctx(conn), {
      object_type: 'PROG',
      object_name: 'ZSDR0001',
    });
    expect(res.isError).toBe(false);
    const out = json(res);
    expect(out.source).toBe('vrsd');
    expect(out.versions.map((v: any) => v.version)).toEqual(['00000', '00001']); // newest first
    expect(out.versions[0]).toMatchObject({
      transport: 'HKDK9A2PQR',
      content_uri: '',
    });
    expect(out.note).toMatch(/VRSD/);
    const [, action, params] = dispatch.mock.calls[0];
    expect(action).toBe('TABLE_READ');
    expect(params).toMatchObject({
      table_name: 'VRSD',
      condition: "OBJTYPE = 'REPS' AND OBJNAME = 'ZSDR0001'",
    });
  });

  it('VRSD: reads every row, then returns the newest N with truncated set', async () => {
    const conn = fakeConnection(() => {
      throw Object.assign(new Error('404'), { response: { status: 404 } });
    });
    dispatch.mockResolvedValue({
      result: {
        rows: [1, 3, 2].map((n) => ({
          VERSNO: String(n),
          KORRNUM: `TR${n}`,
          AUTHOR: 'U',
          DATUM: `2026010${n}`,
          ZEIT: '120000',
        })),
      },
    });
    const out = json(
      await handleGetObjectVersions(ctx(conn), {
        object_type: 'PROG',
        object_name: 'ZSDR0001',
        max_versions: 2,
      }),
    );
    expect(out.versions.map((v: any) => v.version)).toEqual(['00003', '00002']);
    expect(out).toMatchObject({ total: 3, truncated: true });
    expect(dispatch.mock.calls[0][2].max_rows).toBe(5000); // all rows, not "any 2"
  });

  it('VRSD with no rows says the name may be wrong', async () => {
    const conn = fakeConnection(() => {
      throw Object.assign(new Error('404'), { response: { status: 404 } });
    });
    dispatch.mockResolvedValue({ result: { rows: [] } });
    const out = json(
      await handleGetObjectVersions(ctx(conn), {
        object_type: 'PROG',
        object_name: 'ZTYPO',
      }),
    );
    expect(out.total).toBe(0);
    expect(out.note).toMatch(/check the object name/);
  });

  it('no fallback on a 500 that says "does not exist"', async () => {
    const conn = fakeConnection(() => {
      throw Object.assign(new Error('Program ZX does not exist'), {
        response: { status: 500 },
      });
    });
    const res = await handleGetObjectVersions(ctx(conn), {
      object_type: 'PROG',
      object_name: 'ZX',
    });
    expect(res.isError).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reports a real failure (no fallback on 401) and bad input as errors', async () => {
    const conn = fakeConnection(() => {
      throw Object.assign(new Error('Unauthorized'), {
        response: { status: 401 },
      });
    });
    const res = await handleGetObjectVersions(ctx(conn), {
      object_type: 'PROG',
      object_name: 'ZSDR0001',
    });
    expect(res.isError).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    const bad = await handleGetObjectVersions(ctx(conn), {
      object_type: 'TABL',
      object_name: 'ZT',
    });
    expect(bad.isError).toBe(true);
    expect(conn.makeAdtRequest).toHaveBeenCalledTimes(1); // the bad type never reached SAP
  });
});

describe('GetObjectVersionSource', () => {
  it('reads a version by number through the feed', async () => {
    const conn = fakeConnection((req) =>
      /\/content$/.test(req.url)
        ? { status: 200, data: "REPORT zsdr0001.\nWRITE 'old'." }
        : { status: 200, data: FEED },
    );
    const res = await handleGetObjectVersionSource(ctx(conn), {
      object_type: 'PROG',
      object_name: 'ZSDR0001',
      version: '1',
    });
    expect(res.isError).toBe(false);
    const out = json(res);
    expect(out).toMatchObject({
      version: '00001',
      lines: 2,
      content_uri: `${BASE}/20230608101216/00001/content`,
    });
    expect(out.source).toContain("WRITE 'old'");
    expect(conn.makeAdtRequest.mock.calls[1][0].headers.Accept).toBe(
      'text/plain',
    );
  });

  it('reads a given content_uri and refuses any other URI', async () => {
    const conn = fakeConnection(() => ({ status: 200, data: 'REPORT z.' }));
    const ok = await handleGetObjectVersionSource(ctx(conn), {
      content_uri: `${BASE}/20230608101216/00001/content`,
    });
    expect(ok.isError).toBe(false);
    const bad = await handleGetObjectVersionSource(ctx(conn), {
      content_uri: '/sap/bc/adt/cts/transportrequests/X',
    });
    expect(bad.isError).toBe(true);
    expect(conn.makeAdtRequest).toHaveBeenCalledTimes(1);
  });

  it('names the versions it has when the number is unknown', async () => {
    const conn = fakeConnection(() => ({ status: 200, data: FEED }));
    const res = await handleGetObjectVersionSource(ctx(conn), {
      object_type: 'PROG',
      object_name: 'ZSDR0001',
      version: '7',
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/versions: 00000, 00001/);
  });
});
