/**
 * Unit tests for src/lib/removedTransports.ts — transports removed in 4.10.0
 * must be refused with the fix, the supported ones must pass.
 */

import {
  assertSupportedTransport,
  findRemovedTransport,
} from '../../lib/removedTransports';

describe('removedTransports', () => {
  it.each(['native', 'gateway', 'zrfc', 'NATIVE', ' zrfc '])(
    'SAP_RFC_BACKEND=%p is refused with the migration message',
    (v) => {
      const msg = findRemovedTransport({ SAP_RFC_BACKEND: v });
      expect(msg).toMatch(/was removed in abap-mcp-adt-powerup 4\.10\.0/);
      expect(msg).toMatch(/SAP_RFC_BACKEND=odata \(default\) or soap/);
      expect(() => assertSupportedTransport({ SAP_RFC_BACKEND: v })).toThrow(
        /was removed/,
      );
    },
  );

  it.each(['rfc', 'RFC', ' rfc '])('SAP_CONNECTION_TYPE=%p is refused', (v) => {
    expect(findRemovedTransport({ SAP_CONNECTION_TYPE: v })).toMatch(
      /SAP_CONNECTION_TYPE=rfc .* was removed/,
    );
  });

  it.each([
    {},
    { SAP_RFC_BACKEND: 'odata' },
    { SAP_RFC_BACKEND: 'soap' },
    { SAP_RFC_BACKEND: '' },
    { SAP_CONNECTION_TYPE: 'http' },
    { SAP_CONNECTION_TYPE: '' },
  ])('supported env %p passes', (env) => {
    expect(findRemovedTransport(env)).toBeNull();
    expect(() => assertSupportedTransport(env)).not.toThrow();
  });

  it('--connection-type=rfc is refused by the argument parser', () => {
    const argv = process.argv;
    process.argv = ['node', 'launcher', '--connection-type=rfc'];
    try {
      jest.isolateModules(() => {
        const { ArgumentsParser } = require('../../lib/config/ArgumentsParser');
        expect(() => ArgumentsParser.parse()).toThrow(/was removed/);
      });
    } finally {
      process.argv = argv;
    }
  });
});
