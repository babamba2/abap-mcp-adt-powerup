/**
 * Unit tests for src/lib/rfcBackend.ts
 *
 * Verifies the env-driven odata / soap switch and that the backends removed
 * in 4.10.0 (native / gateway / zrfc) fail with the migration message.
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

  it('is case-insensitive (SOAP → soap)', () => {
    process.env.SAP_RFC_BACKEND = 'SOAP';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('soap');
  });

  it('tolerates surrounding whitespace', () => {
    process.env.SAP_RFC_BACKEND = '  soap  ';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('soap');
  });

  it('throws on unknown backend value (lazy — at call time)', () => {
    process.env.SAP_RFC_BACKEND = 'grpc';
    const mod = require('../../lib/rfcBackend');
    expect(() => mod.getBackend()).toThrow(
      /SAP_RFC_BACKEND must be 'odata' | 'soap'/,
    );
    expect(() => mod.backend).toThrow();
  });

  it.each(['native', 'gateway', 'zrfc', ' ZRFC '])(
    'removed backend %p throws the migration message',
    (v) => {
      process.env.SAP_RFC_BACKEND = v;
      const mod = require('../../lib/rfcBackend');
      expect(() => mod.getBackend()).toThrow(/was removed in .*4.10.0/);
      expect(() => mod.getBackend()).toThrow(/SAP_RFC_BACKEND=odata/);
    },
  );

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

    process.env.SAP_RFC_BACKEND = 'odata';
    expect(mod.backend).toBe('odata');

    delete process.env.SAP_RFC_BACKEND;
    expect(mod.backend).toBe('odata');
  });

  describe('routing — call-time backend resolution', () => {
    /**
     * Mock both backend modules with sentinel callDispatch / callTextpool
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

    it('callDispatch throws for a removed backend', () => {
      setupMocks();
      process.env.SAP_RFC_BACKEND = 'native';
      const mod = require('../../lib/rfcBackend');
      expect(() => mod.callDispatch({} as any, 'PING', {})).toThrow(
        /was removed/,
      );
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
