/**
 * Unit tests for src/lib/gatewayRfc.ts
 *
 * Mocks global fetch so these tests run without any middleware. The
 * fetch mock captures URL / method / headers / body so we can assert
 * the exact on-the-wire contract the RFC Gateway must implement.
 */

type MockFetchCall = {
  url: string;
  init?: RequestInit;
};

let fetchCalls: MockFetchCall[];
let mockFetch: jest.Mock;

function jsonResponse(
  body: any,
  init: { status?: number; ok?: boolean } = {},
): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('gatewayRfc — HTTP middleware backend', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = (global as any).fetch;
  const FAKE_CONNECTION = {} as any;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    // Strip every SAP_* to start each test from a known state
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SAP_')) delete process.env[k];
    }
    fetchCalls = [];
    mockFetch = jest.fn<Promise<Response>, [string, RequestInit?]>(
      async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init });
        return jsonResponse({ result: {}, subrc: 0, message: '' });
      },
    );
    (global as any).fetch = mockFetch;
  });

  /**
   * Queue the next response body while preserving fetchCalls capture.
   * Use this instead of mockResolvedValueOnce — the `...Once` helpers
   * replace the default impl, which would drop our fetchCalls.push().
   */
  function nextResponse(body: any, init: { status?: number } = {}) {
    mockFetch.mockImplementationOnce(
      async (url: string, reqInit?: RequestInit) => {
        fetchCalls.push({ url, init: reqInit });
        return jsonResponse(body, init);
      },
    );
  }

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    (global as any).fetch = ORIGINAL_FETCH;
  });

  function setHappyEnv() {
    process.env.SAP_RFC_GATEWAY_URL = 'https://rfc-gw.example.com:8443';
    process.env.SAP_RFC_GATEWAY_TOKEN = 'bearer-xyz';
    process.env.SAP_USERNAME = 'DEVUSER';
    process.env.SAP_PASSWORD = 'p@ss';
    process.env.SAP_CLIENT = '100';
    process.env.SAP_LANGUAGE = 'EN';
  }

  describe('callDispatch', () => {
    it('posts to /rfc/dispatch on SAP_RFC_GATEWAY_URL', async () => {
      setHappyEnv();
      nextResponse({ result: { rows: 2 }, subrc: 0, message: 'ok' });
      const { callDispatch } = require('../../lib/gatewayRfc');
      await callDispatch(FAKE_CONNECTION, 'CUA_FETCH', { program: 'Z_FOO' });
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe(
        'https://rfc-gw.example.com:8443/rfc/dispatch',
      );
      expect(fetchCalls[0].init?.method).toBe('POST');
    });

    it('strips trailing slash from SAP_RFC_GATEWAY_URL when building URL', async () => {
      setHappyEnv();
      process.env.SAP_RFC_GATEWAY_URL = 'https://rfc-gw.example.com:8443/';
      const { callDispatch } = require('../../lib/gatewayRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(fetchCalls[0].url).toBe(
        'https://rfc-gw.example.com:8443/rfc/dispatch',
      );
    });

    it('sends Authorization Bearer header when SAP_RFC_GATEWAY_TOKEN set', async () => {
      setHappyEnv();
      const { callDispatch } = require('../../lib/gatewayRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      const headers = fetchCalls[0].init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer bearer-xyz');
    });

    it('omits Authorization when SAP_RFC_GATEWAY_TOKEN unset', async () => {
      setHappyEnv();
      delete process.env.SAP_RFC_GATEWAY_TOKEN;
      const { callDispatch } = require('../../lib/gatewayRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      const headers = fetchCalls[0].init?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it('passes SAP credentials via X-SAP-* headers', async () => {
      setHappyEnv();
      const { callDispatch } = require('../../lib/gatewayRfc');
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      const headers = fetchCalls[0].init?.headers as Record<string, string>;
      expect(headers['X-SAP-User']).toBe('DEVUSER');
      expect(headers['X-SAP-Password']).toBe('p@ss');
      expect(headers['X-SAP-Client']).toBe('100');
      expect(headers['X-SAP-Language']).toBe('EN');
    });

    it('sends action + params in JSON body', async () => {
      setHappyEnv();
      const { callDispatch } = require('../../lib/gatewayRfc');
      await callDispatch(FAKE_CONNECTION, 'DYNPRO_READ', {
        program: 'Z_FOO',
        screen: '0100',
      });
      expect(fetchCalls[0].init?.body).toBe(
        JSON.stringify({
          action: 'DYNPRO_READ',
          params: { program: 'Z_FOO', screen: '0100' },
        }),
      );
    });

    it('returns DispatchResult on subrc=0', async () => {
      setHappyEnv();
      nextResponse({ result: { count: 5 }, subrc: 0, message: 'done' });
      const { callDispatch } = require('../../lib/gatewayRfc');
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out).toEqual({ result: { count: 5 }, subrc: 0, message: 'done' });
    });

    it('throws with action + subrc + message on non-zero subrc', async () => {
      setHappyEnv();
      nextResponse({ result: {}, subrc: 4, message: 'not found' });
      const { callDispatch } = require('../../lib/gatewayRfc');
      await expect(
        callDispatch(FAKE_CONNECTION, 'CUA_FETCH', {}),
      ).rejects.toThrow(
        /ZMCP_ADT_DISPATCH error \(action=CUA_FETCH, subrc=4\): not found/,
      );
    });

    it('throws with HTTP status when gateway returns non-2xx', async () => {
      setHappyEnv();
      nextResponse({ error: 'unauthorized' }, { status: 401 });
      const { callDispatch } = require('../../lib/gatewayRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /RFC Gateway returned HTTP 401/,
      );
    });

    it('throws with helpful guidance when fetch itself fails', async () => {
      setHappyEnv();
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const { callDispatch } = require('../../lib/gatewayRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /RFC Gateway request failed.*ECONNREFUSED.*SAP_RFC_GATEWAY_URL/s,
      );
    });

    it('throws with SAP_RFC_GATEWAY_URL name when env is missing', async () => {
      // Do not call setHappyEnv — all SAP_* env vars are unset
      const { callDispatch } = require('../../lib/gatewayRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /SAP_RFC_GATEWAY_URL is required/,
      );
    });
  });

  describe('callTextpool', () => {
    beforeEach(setHappyEnv);

    it('posts to /rfc/textpool with action/program/language/textpool_json', async () => {
      nextResponse({ result: [], subrc: 0, message: '' });
      const { callTextpool } = require('../../lib/gatewayRfc');
      await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
        language: 'EN',
      });
      expect(fetchCalls[0].url).toBe(
        'https://rfc-gw.example.com:8443/rfc/textpool',
      );
      expect(fetchCalls[0].init?.body).toBe(
        JSON.stringify({
          action: 'READ',
          program: 'Z_FOO',
          language: 'EN',
          textpool_json: '',
        }),
      );
    });

    it('WRITE forwards textpool_json payload', async () => {
      nextResponse({ result: [], subrc: 0, message: 'written' });
      const { callTextpool } = require('../../lib/gatewayRfc');
      const payload = '[{"ID":"T","KEY":"R","ENTRY":"Hi","LENGTH":2}]';
      await callTextpool(FAKE_CONNECTION, 'WRITE', {
        program: 'Z_FOO',
        language: 'EN',
        textpool_json: payload,
      });
      const body = JSON.parse(String(fetchCalls[0].init?.body));
      expect(body.action).toBe('WRITE');
      expect(body.textpool_json).toBe(payload);
    });

    it('defaults language/textpool_json to empty string when omitted', async () => {
      nextResponse({ result: [], subrc: 0, message: '' });
      const { callTextpool } = require('../../lib/gatewayRfc');
      await callTextpool(FAKE_CONNECTION, 'READ', { program: 'Z_FOO' });
      const body = JSON.parse(String(fetchCalls[0].init?.body));
      expect(body.language).toBe('');
      expect(body.textpool_json).toBe('');
    });

    it('returns TextpoolResult array on subrc=0', async () => {
      const rows = [{ ID: 'T', KEY: 'R', ENTRY: 'Hi', LENGTH: 2 }];
      nextResponse({ result: rows, subrc: 0, message: '' });
      const { callTextpool } = require('../../lib/gatewayRfc');
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
      });
      expect(out.result).toEqual(rows);
      expect(out.subrc).toBe(0);
    });

    it('throws with subrc + message on non-zero subrc', async () => {
      nextResponse({ result: [], subrc: 8, message: 'auth denied' });
      const { callTextpool } = require('../../lib/gatewayRfc');
      await expect(
        callTextpool(FAKE_CONNECTION, 'READ', { program: 'Z_FOO' }),
      ).rejects.toThrow(
        /ZMCP_ADT_TEXTPOOL error \(action=READ, subrc=8\): auth denied/,
      );
    });
  });
});
