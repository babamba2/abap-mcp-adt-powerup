/**
 * Unit tests for src/lib/odataRfc.ts
 *
 * Mocks global fetch so the CSRF handshake + function import flow runs
 * offline. Each test resets modules so the internal CSRF cache starts
 * empty and env changes take effect.
 */

type MockFetchCall = {
  url: string;
  init?: RequestInit;
};

let fetchCalls: MockFetchCall[];
let mockFetch: jest.Mock;

interface ResponseOpts {
  status?: number;
  ok?: boolean;
  headers?: Record<string, string | string[]>;
  body?: any;
  bodyIsJson?: boolean;
}

function makeResponse(opts: ResponseOpts = {}): Response {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  const headerEntries: Array<[string, string]> = [];
  const setCookies: string[] = [];
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    if (k.toLowerCase() === 'set-cookie' && Array.isArray(v)) {
      setCookies.push(...v);
      for (const c of v) headerEntries.push(['set-cookie', c]);
    } else if (Array.isArray(v)) {
      for (const item of v) headerEntries.push([k, item]);
    } else {
      headerEntries.push([k, v]);
    }
  }
  const headers = new Headers(headerEntries);
  (headers as any).getSetCookie = () => setCookies;
  const bodyJson = opts.bodyIsJson !== false ? opts.body : null;
  const bodyText =
    opts.bodyIsJson === false
      ? String(opts.body ?? '')
      : JSON.stringify(opts.body ?? {});
  return {
    ok,
    status,
    headers,
    json: async () => bodyJson,
    text: async () => bodyText,
  } as unknown as Response;
}

describe('odataRfc — OData v2 FunctionImport backend', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = (global as any).fetch;
  const FAKE_CONNECTION = {} as any;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SAP_')) delete process.env[k];
    }
    fetchCalls = [];
    mockFetch = jest.fn<Promise<Response>, [string, RequestInit?]>(
      async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init });
        return makeResponse({ body: { d: {} } });
      },
    );
    (global as any).fetch = mockFetch;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    (global as any).fetch = ORIGINAL_FETCH;
  });

  function setHappyEnv() {
    process.env.SAP_RFC_ODATA_SERVICE_URL =
      'https://sap.example.com:44300/sap/opu/odata/sap/ZMCP_ADT_SRV';
    process.env.SAP_USERNAME = 'DEVUSER';
    process.env.SAP_PASSWORD = 'p@ss';
    process.env.SAP_CLIENT = '100';
  }

  /** Queue a response while preserving fetchCalls capture. */
  function nextResponse(opts: ResponseOpts) {
    mockFetch.mockImplementationOnce(
      async (url: string, reqInit?: RequestInit) => {
        fetchCalls.push({ url, init: reqInit });
        return makeResponse(opts);
      },
    );
  }

  /** Queue a CSRF fetch response — token, cookie, OK. */
  function queueCsrfFetch(
    token = 'csrf-ABC123',
    cookies: string[] = ['MYSAPSSO2=xyz'],
  ) {
    nextResponse({
      status: 200,
      headers: { 'x-csrf-token': token, 'set-cookie': cookies },
      body: '<edmx:Edmx />',
      bodyIsJson: false,
    });
  }

  /** Queue a function import POST response. */
  function queuePostDispatch(body: any) {
    nextResponse({ status: 200, body });
  }

  describe('CSRF handshake', () => {
    it('GET $metadata with X-CSRF-Token: Fetch on first call', async () => {
      setHappyEnv();
      queueCsrfFetch();
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});

      // First call = CSRF fetch
      expect(fetchCalls[0].url).toBe(
        'https://sap.example.com:44300/sap/opu/odata/sap/ZMCP_ADT_SRV/$metadata?sap-client=100',
      );
      expect(fetchCalls[0].init?.method).toBe('GET');
      const csrfHeaders = fetchCalls[0].init?.headers as Record<string, string>;
      expect(csrfHeaders['X-CSRF-Token']).toBe('Fetch');
      expect(csrfHeaders.Authorization).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
    });

    it('subsequent POST uses cached token + cookie', async () => {
      setHappyEnv();
      queueCsrfFetch('tok-xyz', ['SAP_SESSIONID=aaa', 'MYSAPSSO2=bbb']);
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});

      const postHeaders = fetchCalls[1].init?.headers as Record<string, string>;
      expect(postHeaders['X-CSRF-Token']).toBe('tok-xyz');
      expect(postHeaders.Cookie).toBe('SAP_SESSIONID=aaa; MYSAPSSO2=bbb');
    });

    it('reuses the cached session across multiple calls (single CSRF fetch)', async () => {
      setHappyEnv();
      queueCsrfFetch();
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      await callDispatch(FAKE_CONNECTION, 'PING', {});

      // 1 CSRF + 3 POSTs = 4 fetch calls
      expect(fetchCalls).toHaveLength(4);
      expect(fetchCalls[0].url).toContain('/$metadata');
      expect(fetchCalls[1].url).toContain('/Dispatch');
      expect(fetchCalls[2].url).toContain('/Dispatch');
      expect(fetchCalls[3].url).toContain('/Dispatch');
    });

    it('refreshes CSRF token on 403 with "x-csrf-token: required" and retries once', async () => {
      setHappyEnv();
      queueCsrfFetch('old-token');
      nextResponse({
        status: 403,
        headers: { 'x-csrf-token': 'Required' },
        body: 'CSRF Token required',
        bodyIsJson: false,
      });
      queueCsrfFetch('new-token');
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: 'ok' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});

      // 1st POST used old token, 2nd CSRF fetch got new token, 3rd POST used new token
      expect(fetchCalls).toHaveLength(4);
      const retryHeaders = fetchCalls[3].init?.headers as Record<
        string,
        string
      >;
      expect(retryHeaders['X-CSRF-Token']).toBe('new-token');
      expect(out.message).toBe('ok');
    });

    it('throws on CSRF fetch HTTP failure', async () => {
      setHappyEnv();
      nextResponse({
        status: 500,
        body: 'Internal Server Error',
        bodyIsJson: false,
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /OData CSRF fetch returned HTTP 500/,
      );
    });

    it('throws when server does not return X-CSRF-Token header', async () => {
      setHappyEnv();
      nextResponse({
        status: 200,
        headers: {},
        body: '<edmx:Edmx />',
        bodyIsJson: false,
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /did not return an X-CSRF-Token/,
      );
    });

    it('throws when SAP_RFC_ODATA_SERVICE_URL is unset', async () => {
      process.env.SAP_USERNAME = 'x';
      process.env.SAP_PASSWORD = 'x';
      const { callDispatch } = require('../../lib/odataRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /SAP_RFC_ODATA_SERVICE_URL is required/,
      );
    });
  });

  describe('URL construction', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('strips trailing slash from SAP_RFC_ODATA_SERVICE_URL', async () => {
      process.env.SAP_RFC_ODATA_SERVICE_URL =
        'https://sap.example.com:44300/sap/opu/odata/sap/ZMCP_ADT_SRV///';
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(fetchCalls[1].url).toBe(
        "https://sap.example.com:44300/sap/opu/odata/sap/ZMCP_ADT_SRV/Dispatch?IV_ACTION='PING'&IV_PARAMS='%7B%7D'&sap-client=100",
      );
    });

    it('wraps string params in OData single quotes and escapes apostrophes', async () => {
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, "O'REILLY", { name: "it's" });
      const url = fetchCalls[1].url;
      expect(url).toContain("IV_ACTION='O''REILLY'");
      expect(url).toContain("IV_PARAMS='");
      // the JSON-stringified value { "name": "it's" } contains a single quote → must double
      expect(url).toMatch(/IV_PARAMS='[^']*''s[^']*'/);
    });

    it('omits sap-client query when SAP_CLIENT is unset', async () => {
      delete process.env.SAP_CLIENT;
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(fetchCalls[0].url).not.toContain('sap-client');
      expect(fetchCalls[1].url).not.toContain('sap-client');
    });
  });

  describe('response envelope auto-detection', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('Form A: { d: { Dispatch: { ... } } } — FunctionImport name wrapped', async () => {
      queuePostDispatch({
        d: {
          Dispatch: { EV_RESULT: '{"rows":3}', EV_SUBRC: 0, EV_MESSAGE: 'ok' },
        },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out).toEqual({ result: { rows: 3 }, subrc: 0, message: 'ok' });
    });

    it('Form B: { d: { EV_RESULT: ... } } — direct complex type', async () => {
      queuePostDispatch({
        d: { EV_RESULT: '{"rows":5}', EV_SUBRC: 0, EV_MESSAGE: 'direct' },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out).toEqual({ result: { rows: 5 }, subrc: 0, message: 'direct' });
    });

    it('throws clear error when "d" envelope is missing', async () => {
      queuePostDispatch({ error: 'nope' });
      const { callDispatch } = require('../../lib/odataRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /missing 'd' envelope/,
      );
    });
  });

  describe('callDispatch', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('serialises params as JSON in IV_PARAMS and wraps in OData literal', async () => {
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: '{}', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await callDispatch(FAKE_CONNECTION, 'CUA_FETCH', { program: 'Z_FOO' });

      const url = fetchCalls[1].url;
      expect(url).toContain("IV_ACTION='CUA_FETCH'");
      // { "program": "Z_FOO" } → JSON → URL-encoded inside single quotes
      expect(url).toContain(
        "IV_PARAMS='" + encodeURIComponent('{"program":"Z_FOO"}') + "'",
      );
    });

    it('throws with action + subrc + message on non-zero subrc', async () => {
      queuePostDispatch({
        d: {
          Dispatch: { EV_RESULT: '{}', EV_SUBRC: 4, EV_MESSAGE: 'not found' },
        },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      await expect(
        callDispatch(FAKE_CONNECTION, 'CUA_FETCH', {}),
      ).rejects.toThrow(
        /ZMCP_ADT_DISPATCH error \(action=CUA_FETCH, subrc=4\): not found/,
      );
    });

    it('falls back to {} result when EV_RESULT is not valid JSON', async () => {
      queuePostDispatch({
        d: { Dispatch: { EV_RESULT: 'NOT JSON', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callDispatch } = require('../../lib/odataRfc');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out.result).toEqual({});
    });

    it('throws with HTTP status on non-2xx non-403 responses', async () => {
      nextResponse({ status: 500, body: 'Internal Error', bodyIsJson: false });
      const { callDispatch } = require('../../lib/odataRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /OData function import returned HTTP 500/,
      );
    });
  });

  describe('callTextpool', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('READ — forwards IV_PROGRAM + IV_LANGUAGE and parses array result', async () => {
      const rows = [{ ID: 'T', KEY: 'R', ENTRY: 'Hi', LENGTH: 2 }];
      queuePostDispatch({
        d: {
          Textpool: {
            EV_RESULT: JSON.stringify(rows),
            EV_SUBRC: 0,
            EV_MESSAGE: '',
          },
        },
      });
      const { callTextpool } = require('../../lib/odataRfc');
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
        language: 'EN',
      });

      const url = fetchCalls[1].url;
      expect(url).toContain('/Textpool?');
      expect(url).toContain("IV_ACTION='READ'");
      expect(url).toContain("IV_PROGRAM='Z_FOO'");
      expect(url).toContain("IV_LANGUAGE='EN'");
      expect(url).toContain("IV_TEXTPOOL_JSON=''");
      expect(out.result).toEqual(rows);
    });

    it('WRITE — forwards textpool_json payload', async () => {
      queuePostDispatch({
        d: {
          Textpool: { EV_RESULT: '[]', EV_SUBRC: 0, EV_MESSAGE: 'written' },
        },
      });
      const { callTextpool } = require('../../lib/odataRfc');
      const payload = '[{"ID":"T","KEY":"R","ENTRY":"Hi","LENGTH":2}]';
      await callTextpool(FAKE_CONNECTION, 'WRITE', {
        program: 'Z_FOO',
        language: 'EN',
        textpool_json: payload,
      });

      const url = fetchCalls[1].url;
      expect(url).toContain("IV_ACTION='WRITE'");
      expect(url).toContain(
        `IV_TEXTPOOL_JSON='${encodeURIComponent(payload)}'`,
      );
    });

    it('defaults to [] when EV_RESULT is empty/missing', async () => {
      queuePostDispatch({
        d: { Textpool: { EV_RESULT: '', EV_SUBRC: 0, EV_MESSAGE: '' } },
      });
      const { callTextpool } = require('../../lib/odataRfc');
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
      });
      expect(out.result).toEqual([]);
    });

    it('throws on non-zero subrc', async () => {
      queuePostDispatch({
        d: {
          Textpool: {
            EV_RESULT: '[]',
            EV_SUBRC: 8,
            EV_MESSAGE: 'auth missing',
          },
        },
      });
      const { callTextpool } = require('../../lib/odataRfc');
      await expect(
        callTextpool(FAKE_CONNECTION, 'READ', { program: 'Z_FOO' }),
      ).rejects.toThrow(
        /ZMCP_ADT_TEXTPOOL error \(action=READ, subrc=8\): auth missing/,
      );
    });
  });
});
