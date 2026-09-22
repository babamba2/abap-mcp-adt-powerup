/**
 * Unit tests for src/lib/rfcBackend.ts
 *
 * Verifies the env-driven SOAP/native/gateway/odata switch without loading
 * node-rfc — the module under test only imports from `./soapRfc`,
 * `./nativeRfc`, `./gatewayRfc`, and `./odataRfc`. nativeRfc defers
 * `require('node-rfc')` to first use, so these tests run on any host
 * regardless of whether the NW RFC SDK is installed.
 *
 * Backend resolution is lazy (per-call) since the sc4sap profile loader
 * runs after handler imports complete in the launcher. The tests below
 * verify both the live `mod.backend` getter AND that callDispatch /
 * callTextpool route to the resolved backend at call time.
 */

describe('rfcBackend — SAP_RFC_BACKEND switch', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SAP_RFC_BACKEND;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to odata when SAP_RFC_BACKEND is unset', () => {
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('odata');
    expect(mod.getBackend()).toBe('odata');
  });

  it('defaults to odata when SAP_RFC_BACKEND is empty string', () => {
    process.env.SAP_RFC_BACKEND = '';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('odata');
  });

  it('selects native when SAP_RFC_BACKEND=native', () => {
    process.env.SAP_RFC_BACKEND = 'native';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('native');
  });

  it('is case-insensitive (NATIVE → native)', () => {
    process.env.SAP_RFC_BACKEND = 'NATIVE';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('native');
  });

  it('tolerates surrounding whitespace', () => {
    process.env.SAP_RFC_BACKEND = '  native  ';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('native');
  });

  it('throws on unknown backend value (lazy — at call time)', () => {
    process.env.SAP_RFC_BACKEND = 'grpc';
    const mod = require('../../lib/rfcBackend');
    expect(() => mod.getBackend()).toThrow(
      /SAP_RFC_BACKEND must be 'soap' \| 'native' \| 'gateway' \| 'odata'/,
    );
    expect(() => mod.backend).toThrow();
  });

  it('selects zrfc when SAP_RFC_BACKEND=zrfc', () => {
    process.env.SAP_RFC_BACKEND = 'zrfc';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('zrfc');
    expect(mod.getBackend()).toBe('zrfc');
  });

  it('selects gateway when SAP_RFC_BACKEND=gateway', () => {
    process.env.SAP_RFC_BACKEND = 'gateway';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('gateway');
  });

  it('selects odata when SAP_RFC_BACKEND=odata', () => {
    process.env.SAP_RFC_BACKEND = 'odata';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('odata');
  });

  it('selects soap when SAP_RFC_BACKEND=soap (explicit opt-in)', () => {
    process.env.SAP_RFC_BACKEND = 'soap';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('soap');
  });

  it('resolution is lazy — `backend` reflects env at access time, not module-load', () => {
    // Module load BEFORE setting env: backend is observed under default.
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('odata');

    // Now flip env. The same module instance must reflect the new value.
    process.env.SAP_RFC_BACKEND = 'soap';
    expect(mod.backend).toBe('soap');

    process.env.SAP_RFC_BACKEND = 'native';
    expect(mod.backend).toBe('native');

    delete process.env.SAP_RFC_BACKEND;
    expect(mod.backend).toBe('odata');
  });

  describe('routing — call-time backend resolution', () => {
    /**
     * Mock all four backend modules with sentinel callDispatch / callTextpool
     * stubs. Verifies that rfcBackend's lazy wrappers route to the module
     * matching the *current* SAP_RFC_BACKEND, even when env was unset at
     * module-load time.
     */
    const setupMocks = () => {
      jest.doMock('../../lib/soapRfc', () => ({
        callDispatch: jest.fn(async () => ({
          result: { backend: 'soap' },
          subrc: 0,
          message: '',
        })),
        callTextpool: jest.fn(async () => ({
          result: 'soap',
          subrc: 0,
          message: '',
        })),
      }));
      jest.doMock('../../lib/odataRfc', () => ({
        callDispatch: jest.fn(async () => ({
          result: { backend: 'odata' },
          subrc: 0,
          message: '',
        })),
        callTextpool: jest.fn(async () => ({
          result: 'odata',
          subrc: 0,
          message: '',
        })),
        callDdicTabl: jest.fn(async () => ({ subrc: 0 })),
        callDdicDtel: jest.fn(async () => ({ subrc: 0 })),
        callDdicDoma: jest.fn(async () => ({ subrc: 0 })),
        callDdicActivate: jest.fn(async () => ({ subrc: 0 })),
        callDdicBadi: jest.fn(async () => ({ subrc: 0 })),
        callDdicTablRead: jest.fn(async () => ({ subrc: 0 })),
        callDdicDtelRead: jest.fn(async () => ({ subrc: 0 })),
        callDdicDomaRead: jest.fn(async () => ({ subrc: 0 })),
      }));
      jest.doMock('../../lib/nativeRfc', () => ({
        callDispatch: jest.fn(async () => ({
          result: { backend: 'native' },
          subrc: 0,
          message: '',
        })),
        callTextpool: jest.fn(async () => ({
          result: 'native',
          subrc: 0,
          message: '',
        })),
      }));
      jest.doMock('../../lib/gatewayRfc', () => ({
        callDispatch: jest.fn(async () => ({
          result: { backend: 'gateway' },
          subrc: 0,
          message: '',
        })),
        callTextpool: jest.fn(async () => ({
          result: 'gateway',
          subrc: 0,
          message: '',
        })),
      }));
    };

    it('callDispatch routes to soap when SAP_RFC_BACKEND=soap', async () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'soap';
      const mod = require('../../lib/rfcBackend');
      const result = await mod.callDispatch({} as any, 'PING', {});
      expect(result.result.backend).toBe('soap');
    });

    it('callDispatch routes to odata when SAP_RFC_BACKEND=odata', async () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'odata';
      const mod = require('../../lib/rfcBackend');
      const result = await mod.callDispatch({} as any, 'PING', {});
      expect(result.result.backend).toBe('odata');
    });

    it('callDispatch routes to native when SAP_RFC_BACKEND=native', async () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'native';
      const mod = require('../../lib/rfcBackend');
      const result = await mod.callDispatch({} as any, 'PING', {});
      expect(result.result.backend).toBe('native');
    });

    it('callDispatch routes to gateway when SAP_RFC_BACKEND=gateway', async () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'gateway';
      const mod = require('../../lib/rfcBackend');
      const result = await mod.callDispatch({} as any, 'PING', {});
      expect(result.result.backend).toBe('gateway');
    });

    it('callDispatch defaults to odata when SAP_RFC_BACKEND is unset', async () => {
      setupMocks();
      const mod = require('../../lib/rfcBackend');
      const result = await mod.callDispatch({} as any, 'PING', {});
      expect(result.result.backend).toBe('odata');
    });

    it('callTextpool routes by current env, even after import', async () => {
      setupMocks();
      // Import with env unset → default odata wrapper.
      const mod = require('../../lib/rfcBackend');
      // Flip env *after* import.
      process.env.SAP_RFC_BACKEND = 'soap';
      const result = await mod.callTextpool({} as any, 'READ', {
        program: 'X',
      });
      expect(result.result).toBe('soap');
    });

    it('callDdicTabl throws when SAP_RFC_BACKEND is not odata', () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'soap';
      const mod = require('../../lib/rfcBackend');
      expect(() => mod.callDdicTabl({} as any, 'CREATE', {})).toThrow(
        /requires SAP_RFC_BACKEND=odata \(current='soap'\)/,
      );
    });

    it('callDdicTabl forwards to odata when SAP_RFC_BACKEND=odata', async () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'odata';
      const mod = require('../../lib/rfcBackend');
      // Should not throw and should resolve to the mocked odata stub.
      await expect(mod.callDdicTabl({} as any, 'CREATE', {})).resolves.toEqual({
        subrc: 0,
      });
    });
  });
});
