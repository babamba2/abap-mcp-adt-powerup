/**
 * Keychain-backed secret resolution for multi-profile SAP connections.
 *
 * Profile env files may contain `SAP_PASSWORD=keychain:<service>/<account>`
 * references instead of plaintext. This module resolves those references
 * against the OS keychain (Windows Credential Manager, macOS Keychain,
 * Linux libsecret) via `@napi-rs/keyring`.
 *
 * The keychain module is loaded lazily via `require` so that headless
 * environments (Docker, CI) without the native dependency can still load
 * the rest of the server — they just cannot resolve `keychain:` references.
 */

const KEYCHAIN_PREFIX = 'keychain:';

export class KeychainUnavailableError extends Error {
  public readonly code = 'ERR_KEYCHAIN_UNAVAILABLE';
  constructor(cause: unknown) {
    super(
      '@napi-rs/keyring is not installed or the platform keychain is unavailable. ' +
        'Install @napi-rs/keyring, or set SAP_PASSWORD_STORAGE=file to use the encrypted-file fallback.',
    );
    (this as Error & { cause?: unknown }).cause = cause;
  }
}

export class KeychainEntryNotFoundError extends Error {
  public readonly code = 'ERR_KEYCHAIN_NOT_FOUND';
  constructor(
    public readonly service: string,
    public readonly account: string,
  ) {
    super(
      `Keychain entry not found: service="${service}" account="${account}"`,
    );
  }
}

export class InvalidKeychainReferenceError extends Error {
  public readonly code = 'ERR_KEYCHAIN_REF_INVALID';
  constructor(value: string) {
    super(
      `Invalid keychain reference "${value}". Expected format: keychain:<service>/<account>`,
    );
  }
}

export interface KeychainReference {
  service: string;
  account: string;
}

interface KeyringEntry {
  getPassword(): string | null;
  setPassword(value: string): void;
  deletePassword(): boolean;
}

type KeyringEntryCtor = new (service: string, account: string) => KeyringEntry;

// undefined = not yet loaded, null = load attempted and failed
let cachedEntryCtor: KeyringEntryCtor | null | undefined;

function loadEntryCtor(): KeyringEntryCtor | null {
  if (cachedEntryCtor !== undefined) return cachedEntryCtor;
  try {
    const mod = require('@napi-rs/keyring') as { Entry: KeyringEntryCtor };
    cachedEntryCtor = mod.Entry;
  } catch {
    cachedEntryCtor = null;
  }
  return cachedEntryCtor;
}

/** Test-only cache reset. */
export function __resetKeychainCache(): void {
  cachedEntryCtor = undefined;
}

/**
 * Parse a `keychain:<service>/<account>` string.
 * Returns `null` if the value is not a keychain reference.
 * Throws `InvalidKeychainReferenceError` if the prefix is present but malformed.
 */
export function parseKeychainRef(value: string): KeychainReference | null {
  if (!value.startsWith(KEYCHAIN_PREFIX)) return null;
  const payload = value.slice(KEYCHAIN_PREFIX.length);
  const slash = payload.indexOf('/');
  if (slash <= 0 || slash === payload.length - 1) {
    throw new InvalidKeychainReferenceError(value);
  }
  return {
    service: payload.slice(0, slash),
    account: payload.slice(slash + 1),
  };
}

function openEntry(ref: KeychainReference): KeyringEntry {
  const EntryCtor = loadEntryCtor();
  if (!EntryCtor) {
    throw new KeychainUnavailableError(
      new Error('@napi-rs/keyring not loaded'),
    );
  }
  try {
    return new EntryCtor(ref.service, ref.account);
  } catch (err) {
    throw new KeychainUnavailableError(err);
  }
}

/**
 * Resolve a potentially-keychain-backed secret to its plaintext value.
 * Plain strings pass through unchanged.
 */
export function resolveSecret(value: string): string {
  const ref = parseKeychainRef(value);
  if (!ref) return value;
  const entry = openEntry(ref);
  const pwd = entry.getPassword();
  if (pwd === null) {
    throw new KeychainEntryNotFoundError(ref.service, ref.account);
  }
  return pwd;
}

/** Write a plaintext secret to the OS keychain. Used by profile add/edit. */
export function storeSecret(ref: KeychainReference, plaintext: string): void {
  openEntry(ref).setPassword(plaintext);
}

/** Delete a secret from the OS keychain. Used by profile remove. */
export function deleteSecret(ref: KeychainReference): boolean {
  return openEntry(ref).deletePassword();
}

/** Format a keychain reference back into canonical `keychain:<service>/<account>`. */
export function formatKeychainRef(ref: KeychainReference): string {
  return `${KEYCHAIN_PREFIX}${ref.service}/${ref.account}`;
}
