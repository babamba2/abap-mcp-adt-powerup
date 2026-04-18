/**
 * Unit tests for src/lib/zrfcProxy.ts
 *
 * Mocks global fetch so the CSRF preflight + POST endpoint flow runs
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

describe('zrfcProxy — custom ICF handler backend', () => {
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
        return makeResponse({ body: {} });
      },
    );
    (global as any).fetch = mockFetch;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    (global as any).fetch = ORIGINAL_FETCH;
  });

  function setHappyEnv() {
    process.env.SAP_RFC_ZRFC_BASE_URL =
      'https://sap.example.com:44300/sap/bc/rest/zmcp_rfc';
    process.env.SAP_USERNAME = 'DEVUSER';
    process.env.SAP_PASSWORD = 'p@ss';
    process.env.SAP_CLIENT = '100';
  }

  function nextResponse(opts: ResponseOpts) {
    mockFetch.mockImplementationOnce(
      async (url: string, reqInit?: RequestInit) => {
        fetchCalls.push({ url, init: reqInit });
        return makeResponse(opts);
      },
    );
  }

  function queueCsrfFetch(
    token = 'csrf-ABC123',
    cookies: string[] = ['zrfc_csrf=csrf-ABC123'],
  ) {
    nextResponse({
      status: 200,
      headers: { 'x-csrf-token': token, 'set-cookie': cookies },
      body: '',
      bodyIsJson: false,
    });
  }

  function queuePost(body: any, status = 200) {
    nextResponse({ status, body });
  }

  describe('CSRF handshake', () => {
    it('GET /dispatch with X-CSRF-Token: Fetch on first call', async () => {
      setHappyEnv();
      queueCsrfFetch();
      queuePost({ result: '{}', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await callDispatch(FAKE_CONNECTION, 'PING', {});

      expect(fetchCalls[0].url).toBe(
        'https://sap.example.com:44300/sap/bc/rest/zmcp_rfc/dispatch?sap-client=100',
      );
      expect(fetchCalls[0].init?.method).toBe('GET');
      const headers = fetchCalls[0].init?.headers as Record<string, string>;
      expect(headers['X-CSRF-Token']).toBe('Fetch');
      expect(headers.Authorization).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
    });

    it('subsequent POST uses cached token + cookie', async () => {
      setHappyEnv();
      queueCsrfFetch('tok-xyz', ['zrfc_csrf=tok-xyz', 'SAP_SESSIONID=bbb']);
      queuePost({ result: '{}', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await callDispatch(FAKE_CONNECTION, 'PING', {});

      const postHeaders = fetchCalls[1].init?.headers as Record<string, string>;
      expect(postHeaders['X-CSRF-Token']).toBe('tok-xyz');
      expect(postHeaders.Cookie).toBe('zrfc_csrf=tok-xyz; SAP_SESSIONID=bbb');
      expect(postHeaders['Content-Type']).toBe(
        'application/json; charset=utf-8',
      );
    });

    it('reuses cached session across multiple calls', async () => {
      setHappyEnv();
      queueCsrfFetch();
      queuePost({ result: '{}', subrc: 0, message: '' });
      queuePost({ result: '{}', subrc: 0, message: '' });
      queuePost({ result: '{}', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      await callDispatch(FAKE_CONNECTION, 'PING', {});

      expect(fetchCalls).toHaveLength(4);
      expect(fetchCalls[0].init?.method).toBe('GET');
      for (let i = 1; i <= 3; i++) {
        expect(fetchCalls[i].init?.method).toBe('POST');
        expect(fetchCalls[i].url).toContain('/dispatch');
      }
    });

    it('refreshes CSRF on 403 "x-csrf-token: Required" and retries once', async () => {
      setHappyEnv();
      queueCsrfFetch('old-token');
      nextResponse({
        status: 403,
        headers: { 'x-csrf-token': 'Required' },
        body: 'CSRF Token required',
        bodyIsJson: false,
      });
      queueCsrfFetch('new-token', ['zrfc_csrf=new-token']);
      queuePost({ result: '{}', subrc: 0, message: 'ok' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});

      // 1st CSRF GET, 1st POST (403), 2nd CSRF GET, 2nd POST (ok)
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
      nextResponse({ status: 500, body: 'boom', bodyIsJson: false });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /ZRFC CSRF fetch returned HTTP 500/,
      );
    });

    it('throws when server does not return X-CSRF-Token header', async () => {
      setHappyEnv();
      nextResponse({
        status: 200,
        headers: {},
        body: '',
        bodyIsJson: false,
      });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /did not return an X-CSRF-Token/,
      );
    });

    it('throws when SAP_RFC_ZRFC_BASE_URL is unset', async () => {
      process.env.SAP_USERNAME = 'x';
      process.env.SAP_PASSWORD = 'x';
      const { callDispatch } = require('../../lib/zrfcProxy');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /SAP_RFC_ZRFC_BASE_URL is required/,
      );
    });
  });

  describe('URL construction', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('strips trailing slashes from SAP_RFC_ZRFC_BASE_URL', async () => {
      process.env.SAP_RFC_ZRFC_BASE_URL =
        'https://sap.example.com:44300/sap/bc/rest/zmcp_rfc///';
      queuePost({ result: '{}', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(fetchCalls[1].url).toBe(
        'https://sap.example.com:44300/sap/bc/rest/zmcp_rfc/dispatch?sap-client=100',
      );
    });

    it('omits sap-client query when SAP_CLIENT is unset', async () => {
      delete process.env.SAP_CLIENT;
      queuePost({ result: '{}', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(fetchCalls[0].url).not.toContain('sap-client');
      expect(fetchCalls[1].url).not.toContain('sap-client');
    });
  });

  describe('callDispatch', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('sends action + stringified params in POST body', async () => {
      queuePost({ result: '{}', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await callDispatch(FAKE_CONNECTION, 'CUA_FETCH', { program: 'Z_FOO' });

      const body = JSON.parse(String(fetchCalls[1].init?.body ?? '{}'));
      expect(body.action).toBe('CUA_FETCH');
      expect(body.params).toBe('{"program":"Z_FOO"}');
    });

    it('parses result JSON and returns {result, subrc, message}', async () => {
      queuePost({ result: '{"rows":3}', subrc: 0, message: 'ok' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out).toEqual({ result: { rows: 3 }, subrc: 0, message: 'ok' });
    });

    it('throws with action + subrc + message on non-zero subrc', async () => {
      queuePost({ result: '{}', subrc: 4, message: 'not found' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await expect(
        callDispatch(FAKE_CONNECTION, 'CUA_FETCH', {}),
      ).rejects.toThrow(
        /ZMCP_ADT_DISPATCH error \(action=CUA_FETCH, subrc=4\): not found/,
      );
    });

    it('falls back to {} when result is not valid JSON', async () => {
      queuePost({ result: 'NOT JSON', subrc: 0, message: '' });
      const { callDispatch } = require('../../lib/zrfcProxy');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out.result).toEqual({});
    });

    it('throws on non-2xx non-403 responses', async () => {
      nextResponse({ status: 500, body: 'boom', bodyIsJson: false });
      const { callDispatch } = require('../../lib/zrfcProxy');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /ZRFC endpoint returned HTTP 500/,
      );
    });
  });

  describe('callTextpool', () => {
    beforeEach(() => {
      setHappyEnv();
      queueCsrfFetch();
    });

    it('READ — forwards program + language and parses array result', async () => {
      const rows = [{ ID: 'T', KEY: 'R', ENTRY: 'Hi', LENGTH: 2 }];
      queuePost({ result: JSON.stringify(rows), subrc: 0, message: '' });
      const { callTextpool } = require('../../lib/zrfcProxy');
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
        language: 'EN',
      });

      expect(fetchCalls[1].url).toContain('/textpool');
      const body = JSON.parse(String(fetchCalls[1].init?.body ?? '{}'));
      expect(body).toEqual({
        action: 'READ',
        program: 'Z_FOO',
        language: 'EN',
        textpoolJson: '',
      });
      expect(out.result).toEqual(rows);
    });

    it('WRITE — forwards textpool_json as textpoolJson (camelCase)', async () => {
      queuePost({ result: '[]', subrc: 0, message: 'written' });
      const { callTextpool } = require('../../lib/zrfcProxy');
      const payload = '[{"ID":"T","KEY":"R","ENTRY":"Hi","LENGTH":2}]';
      await callTextpool(FAKE_CONNECTION, 'WRITE', {
        program: 'Z_FOO',
        language: 'EN',
        textpool_json: payload,
      });

      const body = JSON.parse(String(fetchCalls[1].init?.body ?? '{}'));
      expect(body.action).toBe('WRITE');
      expect(body.textpoolJson).toBe(payload);
    });

    it('defaults to [] when result is empty/missing', async () => {
      queuePost({ result: '', subrc: 0, message: '' });
      const { callTextpool } = require('../../lib/zrfcProxy');
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
      });
      expect(out.result).toEqual([]);
    });

    it('throws on non-zero subrc', async () => {
      queuePost({ result: '[]', subrc: 8, message: 'auth missing' });
      const { callTextpool } = require('../../lib/zrfcProxy');
      await expect(
        callTextpool(FAKE_CONNECTION, 'READ', { program: 'Z_FOO' }),
      ).rejects.toThrow(
        /ZMCP_ADT_TEXTPOOL error \(action=READ, subrc=8\): auth missing/,
      );
    });
  });
});
