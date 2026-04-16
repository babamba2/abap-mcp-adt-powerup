/**
 * Unit tests for src/lib/nativeRfc.ts
 *
 * node-rfc is mocked at the module level so these tests run on any
 * host — NW RFC SDK and build tools are NOT required. The mock
 * captures the connectionParameters the Pool is constructed with, and
 * exposes the client.call() stub so the happy / error paths of
 * callDispatch and callTextpool can be asserted end-to-end.
 */

type MockClient = {
  call: jest.Mock;
};

type MockPool = {
  acquire: jest.Mock;
  release: jest.Mock;
};

const poolCtorCalls: Array<{ connectionParameters: Record<string, string> }> =
  [];
let mockClient: MockClient;
let mockPool: MockPool;

function resetMockRuntime() {
  poolCtorCalls.length = 0;
  mockClient = {
    call: jest.fn<Promise<Record<string, any>>, [string, Record<string, any>]>(
      async () => ({}),
    ),
  };
  mockPool = {
    acquire: jest.fn<Promise<MockClient>, []>(async () => mockClient),
    release: jest.fn<Promise<void>, [MockClient]>(async () => undefined),
  };
}

jest.mock(
  'node-rfc',
  () => {
    class Pool {
      constructor(opts: any) {
        poolCtorCalls.push({ connectionParameters: opts.connectionParameters });
      }
      acquire() {
        return mockPool.acquire();
      }
      release(c: MockClient) {
        return mockPool.release(c);
      }
    }
    return { Pool };
  },
  { virtual: true },
);

describe('nativeRfc — readConnectionParams + call flows', () => {
  const ORIGINAL_ENV = { ...process.env };
  const FAKE_CONNECTION = {} as any;

  beforeEach(() => {
    jest.resetModules();
    resetMockRuntime();
    process.env = { ...ORIGINAL_ENV };
    // Strip every SAP_RFC_* var so each test starts from a clean slate
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SAP_RFC_')) delete process.env[k];
    }
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function setDirectAppServerEnv() {
    process.env.SAP_RFC_ASHOST = 's4h.example.com';
    process.env.SAP_RFC_SYSNR = '00';
    process.env.SAP_RFC_CLIENT = '100';
    process.env.SAP_RFC_USER = 'MCP_RFC';
    process.env.SAP_RFC_PASSWD = 'secret';
  }

  function setMessageServerEnv() {
    process.env.SAP_RFC_MSHOST = 'msrv.example.com';
    process.env.SAP_RFC_SYSID = 'S4H';
    process.env.SAP_RFC_CLIENT = '100';
    process.env.SAP_RFC_USER = 'MCP_RFC';
    process.env.SAP_RFC_PASSWD = 'secret';
  }

  describe('readConnectionParams via Pool construction', () => {
    it('builds direct-app-server params (ashost/sysnr)', async () => {
      setDirectAppServerEnv();
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 0,
        EV_MESSAGE: '',
        EV_RESULT: '{}',
      });
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(poolCtorCalls).toHaveLength(1);
      const p = poolCtorCalls[0].connectionParameters;
      expect(p.ashost).toBe('s4h.example.com');
      expect(p.sysnr).toBe('00');
      expect(p.client).toBe('100');
      expect(p.user).toBe('MCP_RFC');
      expect(p.passwd).toBe('secret');
      expect(p.lang).toBe('EN'); // default
      expect(p.mshost).toBeUndefined();
    });

    it('builds message-server params (mshost/sysid/group)', async () => {
      setMessageServerEnv();
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({ EV_SUBRC: 0, EV_RESULT: '{}' });
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      const p = poolCtorCalls[0].connectionParameters;
      expect(p.mshost).toBe('msrv.example.com');
      expect(p.sysid).toBe('S4H');
      expect(p.group).toBe('PUBLIC'); // default
      expect(p.ashost).toBeUndefined();
      expect(p.sysnr).toBeUndefined();
    });

    it('honours SAP_RFC_GROUP override and SAP_RFC_MSSERV when set', async () => {
      setMessageServerEnv();
      process.env.SAP_RFC_GROUP = 'PROD';
      process.env.SAP_RFC_MSSERV = 'sapms36';
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({ EV_SUBRC: 0, EV_RESULT: '{}' });
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      const p = poolCtorCalls[0].connectionParameters;
      expect(p.group).toBe('PROD');
      expect(p.msserv).toBe('sapms36');
    });

    it('honours SAP_RFC_LANG override', async () => {
      setDirectAppServerEnv();
      process.env.SAP_RFC_LANG = 'KO';
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({ EV_SUBRC: 0, EV_RESULT: '{}' });
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(poolCtorCalls[0].connectionParameters.lang).toBe('KO');
    });

    it('attaches full SNC block when SAP_RFC_SNC_QOP set', async () => {
      setDirectAppServerEnv();
      process.env.SAP_RFC_SNC_QOP = '8';
      process.env.SAP_RFC_SNC_MYNAME = 'p:CN=MCP';
      process.env.SAP_RFC_SNC_PARTNERNAME = 'p:CN=S4H';
      process.env.SAP_RFC_SNC_LIB = '/usr/sap/snc.so';
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({ EV_SUBRC: 0, EV_RESULT: '{}' });
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      const p = poolCtorCalls[0].connectionParameters;
      expect(p.snc_qop).toBe('8');
      expect(p.snc_myname).toBe('p:CN=MCP');
      expect(p.snc_partnername).toBe('p:CN=S4H');
      expect(p.snc_lib).toBe('/usr/sap/snc.so');
    });

    it('errors with the specific SAP_RFC_* key name when a required field is missing', async () => {
      // ASHOST set, but USER missing — error must name SAP_RFC_USER
      process.env.SAP_RFC_ASHOST = 's4h';
      process.env.SAP_RFC_SYSNR = '00';
      process.env.SAP_RFC_CLIENT = '100';
      process.env.SAP_RFC_PASSWD = 'x';
      const { callDispatch } = require('../../lib/nativeRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /SAP_RFC_USER is required/,
      );
    });

    it('errors when neither ASHOST nor MSHOST is set', async () => {
      process.env.SAP_RFC_CLIENT = '100';
      process.env.SAP_RFC_USER = 'x';
      process.env.SAP_RFC_PASSWD = 'x';
      const { callDispatch } = require('../../lib/nativeRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /SAP_RFC_ASHOST is required/,
      );
    });

    it('errors when MSHOST set but SYSID missing', async () => {
      process.env.SAP_RFC_MSHOST = 'msrv';
      process.env.SAP_RFC_CLIENT = '100';
      process.env.SAP_RFC_USER = 'x';
      process.env.SAP_RFC_PASSWD = 'x';
      const { callDispatch } = require('../../lib/nativeRfc');
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        /SAP_RFC_SYSID is required/,
      );
    });
  });

  describe('callDispatch', () => {
    beforeEach(setDirectAppServerEnv);

    it('forwards IV_ACTION and JSON-serialised IV_PARAMS to ZMCP_ADT_DISPATCH', async () => {
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 0,
        EV_MESSAGE: 'ok',
        EV_RESULT: '{"rows":3}',
      });
      const out = await callDispatch(FAKE_CONNECTION, 'CUA_FETCH', {
        program: 'Z_FOO',
      });
      expect(mockClient.call).toHaveBeenCalledWith('ZMCP_ADT_DISPATCH', {
        IV_ACTION: 'CUA_FETCH',
        IV_PARAMS: JSON.stringify({ program: 'Z_FOO' }),
      });
      expect(out).toEqual({ result: { rows: 3 }, subrc: 0, message: 'ok' });
    });

    it('releases the client even when the RFC call throws', async () => {
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockRejectedValueOnce(
        new Error('RFC_COMMUNICATION_FAILURE'),
      );
      await expect(callDispatch(FAKE_CONNECTION, 'PING', {})).rejects.toThrow(
        'RFC_COMMUNICATION_FAILURE',
      );
      expect(mockPool.release).toHaveBeenCalledWith(mockClient);
    });

    it('throws with subrc + message when EV_SUBRC is non-zero', async () => {
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 4,
        EV_MESSAGE: 'program not found',
        EV_RESULT: '{}',
      });
      await expect(
        callDispatch(FAKE_CONNECTION, 'CUA_FETCH', {}),
      ).rejects.toThrow(
        /ZMCP_ADT_DISPATCH error \(action=CUA_FETCH, subrc=4\): program not found/,
      );
    });

    it('falls back to raw string when EV_RESULT is not valid JSON', async () => {
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 0,
        EV_RESULT: 'NOT JSON',
      });
      const out = await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(out.result).toEqual({}); // fallback passed to tryParseJson
    });

    it('reuses the same pool across calls (Pool ctor invoked once)', async () => {
      const { callDispatch } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValue({ EV_SUBRC: 0, EV_RESULT: '{}' });
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      await callDispatch(FAKE_CONNECTION, 'PING', {});
      expect(poolCtorCalls).toHaveLength(1);
    });
  });

  describe('callTextpool', () => {
    beforeEach(setDirectAppServerEnv);

    it('READ — passes program/language and parses array result', async () => {
      const { callTextpool } = require('../../lib/nativeRfc');
      const rows = [{ ID: 'T', KEY: 'R', ENTRY: 'Hello', LENGTH: 5 }];
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 0,
        EV_RESULT: JSON.stringify(rows),
      });
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
        language: 'EN',
      });
      expect(mockClient.call).toHaveBeenCalledWith('ZMCP_ADT_TEXTPOOL', {
        IV_ACTION: 'READ',
        IV_PROGRAM: 'Z_FOO',
        IV_LANGUAGE: 'EN',
        IV_TEXTPOOL_JSON: '',
      });
      expect(out.result).toEqual(rows);
    });

    it('WRITE — forwards textpool_json payload', async () => {
      const { callTextpool } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 0,
        EV_RESULT: '[]',
      });
      await callTextpool(FAKE_CONNECTION, 'WRITE', {
        program: 'Z_FOO',
        language: 'EN',
        textpool_json: '[{"ID":"T","KEY":"R","ENTRY":"Hi","LENGTH":2}]',
      });
      expect(mockClient.call).toHaveBeenCalledWith(
        'ZMCP_ADT_TEXTPOOL',
        expect.objectContaining({
          IV_ACTION: 'WRITE',
          IV_PROGRAM: 'Z_FOO',
          IV_TEXTPOOL_JSON: '[{"ID":"T","KEY":"R","ENTRY":"Hi","LENGTH":2}]',
        }),
      );
    });

    it('defaults EV_RESULT to [] when missing', async () => {
      const { callTextpool } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({ EV_SUBRC: 0 });
      const out = await callTextpool(FAKE_CONNECTION, 'READ', {
        program: 'Z_FOO',
      });
      expect(out.result).toEqual([]);
    });

    it('throws with subrc + message when EV_SUBRC is non-zero', async () => {
      const { callTextpool } = require('../../lib/nativeRfc');
      mockClient.call.mockResolvedValueOnce({
        EV_SUBRC: 8,
        EV_MESSAGE: 'auth missing',
        EV_RESULT: '[]',
      });
      await expect(
        callTextpool(FAKE_CONNECTION, 'READ', { program: 'Z_FOO' }),
      ).rejects.toThrow(
        /ZMCP_ADT_TEXTPOOL error \(action=READ, subrc=8\): auth missing/,
      );
    });
  });
});
