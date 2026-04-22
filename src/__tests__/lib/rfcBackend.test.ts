/**
 * Unit tests for src/lib/rfcBackend.ts
 *
 * Verifies the env-driven SOAP/native switch without loading node-rfc —
 * the module under test only imports from `./soapRfc` and `./nativeRfc`,
 * and nativeRfc defers `require('node-rfc')` to first use, so these
 * tests run on any host regardless of whether the NW RFC SDK is installed.
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

  it('throws on unknown backend value', () => {
    process.env.SAP_RFC_BACKEND = 'grpc';
    expect(() => require('../../lib/rfcBackend')).toThrow(
      /SAP_RFC_BACKEND must be 'soap' \| 'native' \| 'gateway' \| 'odata'/,
    );
  });

  it('selects gateway when SAP_RFC_BACKEND=gateway', () => {
    process.env.SAP_RFC_BACKEND = 'gateway';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('gateway');
  });

  it('binds callDispatch to gateway backend when SAP_RFC_BACKEND=gateway', () => {
    process.env.SAP_RFC_BACKEND = 'gateway';
    const gw = require('../../lib/gatewayRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callDispatch).toBe(gw.callDispatch);
  });

  it('binds callTextpool to gateway backend when SAP_RFC_BACKEND=gateway', () => {
    process.env.SAP_RFC_BACKEND = 'gateway';
    const gw = require('../../lib/gatewayRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callTextpool).toBe(gw.callTextpool);
  });

  it('selects odata when SAP_RFC_BACKEND=odata', () => {
    process.env.SAP_RFC_BACKEND = 'odata';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('odata');
  });

  it('binds callDispatch to odata backend when SAP_RFC_BACKEND=odata', () => {
    process.env.SAP_RFC_BACKEND = 'odata';
    const od = require('../../lib/odataRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callDispatch).toBe(od.callDispatch);
  });

  it('binds callTextpool to odata backend when SAP_RFC_BACKEND=odata', () => {
    process.env.SAP_RFC_BACKEND = 'odata';
    const od = require('../../lib/odataRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callTextpool).toBe(od.callTextpool);
  });

  it('binds callDispatch to odata backend by default', () => {
    const odata = require('../../lib/odataRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callDispatch).toBe(odata.callDispatch);
  });

  it('binds callTextpool to odata backend by default', () => {
    const odata = require('../../lib/odataRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callTextpool).toBe(odata.callTextpool);
  });

  it('selects soap when SAP_RFC_BACKEND=soap (explicit opt-in)', () => {
    process.env.SAP_RFC_BACKEND = 'soap';
    const mod = require('../../lib/rfcBackend');
    expect(mod.backend).toBe('soap');
  });

  it('binds callDispatch to soap backend when SAP_RFC_BACKEND=soap', () => {
    process.env.SAP_RFC_BACKEND = 'soap';
    const soap = require('../../lib/soapRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callDispatch).toBe(soap.callDispatch);
  });

  it('binds callDispatch to native backend when SAP_RFC_BACKEND=native', () => {
    process.env.SAP_RFC_BACKEND = 'native';
    const native = require('../../lib/nativeRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callDispatch).toBe(native.callDispatch);
  });

  it('binds callTextpool to native backend when SAP_RFC_BACKEND=native', () => {
    process.env.SAP_RFC_BACKEND = 'native';
    const native = require('../../lib/nativeRfc');
    const mod = require('../../lib/rfcBackend');
    expect(mod.callTextpool).toBe(native.callTextpool);
  });

  it('resolution is one-shot per module load (cached backend constant)', () => {
    process.env.SAP_RFC_BACKEND = 'native';
    const mod = require('../../lib/rfcBackend');
    // Mutating env after load must NOT change the already-resolved backend
    process.env.SAP_RFC_BACKEND = 'soap';
    expect(mod.backend).toBe('native');
  });
});
