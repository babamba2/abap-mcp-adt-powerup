/**
 * Unit tests for src/lib/secrets.ts
 *
 * Mocks `@napi-rs/keyring` so the suite runs without installing the native
 * module. The module-under-test caches the require() result, so tests call
 * `__resetKeychainCache()` between scenarios to exercise the load path.
 */

describe('secrets — keychain reference parsing', () => {
  const {
    parseKeychainRef,
    InvalidKeychainReferenceError,
  } = require('../../lib/secrets');

  it('returns null for plain strings', () => {
    expect(parseKeychainRef('plain-password')).toBeNull();
    expect(parseKeychainRef('')).toBeNull();
    expect(parseKeychainRef('SuperSecret!23')).toBeNull();
  });

  it('parses keychain:<service>/<account>', () => {
    expect(parseKeychainRef('keychain:sc4sap/HK-DEV/DEVELOPER')).toEqual({
      service: 'sc4sap',
      account: 'HK-DEV/DEVELOPER',
    });
  });

  it('parses keychain:<service>/<account> with simple account', () => {
    expect(parseKeychainRef('keychain:myapp/alice')).toEqual({
      service: 'myapp',
      account: 'alice',
    });
  });

  it('throws InvalidKeychainReferenceError when missing slash', () => {
    expect(() => parseKeychainRef('keychain:no-slash')).toThrow(
      InvalidKeychainReferenceError,
    );
  });

  it('throws when service is empty', () => {
    expect(() => parseKeychainRef('keychain:/account')).toThrow(
      InvalidKeychainReferenceError,
    );
  });

  it('throws when account is empty', () => {
    expect(() => parseKeychainRef('keychain:service/')).toThrow(
      InvalidKeychainReferenceError,
    );
  });
});

describe('secrets — resolveSecret passthrough and errors', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns plain strings unchanged', () => {
    const { resolveSecret } = require('../../lib/secrets');
    expect(resolveSecret('plaintext')).toBe('plaintext');
    expect(resolveSecret('')).toBe('');
  });

  it('throws KeychainUnavailableError when @napi-rs/keyring cannot be loaded', () => {
    jest.doMock(
      '@napi-rs/keyring',
      () => {
        throw new Error('module not installed');
      },
      { virtual: true },
    );
    const {
      resolveSecret,
      KeychainUnavailableError,
    } = require('../../lib/secrets');
    expect(() => resolveSecret('keychain:sc4sap/HK-DEV/DEV')).toThrow(
      KeychainUnavailableError,
    );
  });

  it('throws KeychainEntryNotFoundError when getPassword returns null', () => {
    jest.doMock(
      '@napi-rs/keyring',
      () => ({
        Entry: class {
          constructor(
            public service: string,
            public account: string,
          ) {}
          getPassword() {
            return null;
          }
          setPassword() {
            /* noop */
          }
          deletePassword() {
            return false;
          }
        },
      }),
      { virtual: true },
    );
    const {
      resolveSecret,
      KeychainEntryNotFoundError,
    } = require('../../lib/secrets');
    expect(() => resolveSecret('keychain:sc4sap/MISSING/USER')).toThrow(
      KeychainEntryNotFoundError,
    );
  });

  it('returns the stored password for a known keychain entry', () => {
    jest.doMock(
      '@napi-rs/keyring',
      () => ({
        Entry: class {
          private static store: Record<string, string> = {
            'sc4sap::HK-DEV/DEV': 'DevPass123',
          };
          constructor(
            public service: string,
            public account: string,
          ) {}
          private key() {
            return `${this.service}::${this.account}`;
          }
          getPassword() {
            return (this.constructor as typeof Entry).store[this.key()] ?? null;
          }
          setPassword(v: string) {
            (this.constructor as typeof Entry).store[this.key()] = v;
          }
          deletePassword() {
            return delete (this.constructor as typeof Entry).store[this.key()];
          }
        },
      }),
      { virtual: true },
    );
    // biome-ignore lint/correctness/noUnusedVariables: class ref for typeof
    class Entry {
      static store: Record<string, string> = {};
    }
    const { resolveSecret } = require('../../lib/secrets');
    expect(resolveSecret('keychain:sc4sap/HK-DEV/DEV')).toBe('DevPass123');
  });
});

describe('secrets — store/delete round trip', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('stores a secret and reads it back', () => {
    const store: Record<string, string> = {};
    jest.doMock(
      '@napi-rs/keyring',
      () => ({
        Entry: class {
          constructor(
            public service: string,
            public account: string,
          ) {}
          private key() {
            return `${this.service}::${this.account}`;
          }
          getPassword() {
            return store[this.key()] ?? null;
          }
          setPassword(v: string) {
            store[this.key()] = v;
          }
          deletePassword() {
            const had = this.key() in store;
            delete store[this.key()];
            return had;
          }
        },
      }),
      { virtual: true },
    );
    const {
      storeSecret,
      resolveSecret,
      deleteSecret,
    } = require('../../lib/secrets');
    const ref = { service: 'sc4sap', account: 'HK-QA/TESTER' };
    storeSecret(ref, 'QA_SECRET_42');
    expect(resolveSecret('keychain:sc4sap/HK-QA/TESTER')).toBe('QA_SECRET_42');
    expect(deleteSecret(ref)).toBe(true);
    expect(deleteSecret(ref)).toBe(false);
  });
});

describe('secrets — formatKeychainRef', () => {
  const { formatKeychainRef } = require('../../lib/secrets');

  it('serializes a reference back to canonical form', () => {
    expect(
      formatKeychainRef({ service: 'sc4sap', account: 'HK-DEV/DEVELOPER' }),
    ).toBe('keychain:sc4sap/HK-DEV/DEVELOPER');
  });
});
