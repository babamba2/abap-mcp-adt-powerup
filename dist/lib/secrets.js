"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidKeychainReferenceError = exports.KeychainEntryNotFoundError = exports.KeychainUnavailableError = void 0;
exports.__resetKeychainCache = __resetKeychainCache;
exports.parseKeychainRef = parseKeychainRef;
exports.resolveSecret = resolveSecret;
exports.storeSecret = storeSecret;
exports.deleteSecret = deleteSecret;
exports.formatKeychainRef = formatKeychainRef;
const KEYCHAIN_PREFIX = 'keychain:';
class KeychainUnavailableError extends Error {
    code = 'ERR_KEYCHAIN_UNAVAILABLE';
    constructor(cause) {
        super('@napi-rs/keyring is not installed or the platform keychain is unavailable. ' +
            'Install @napi-rs/keyring, or set SAP_PASSWORD_STORAGE=file to use the encrypted-file fallback.');
        this.cause = cause;
    }
}
exports.KeychainUnavailableError = KeychainUnavailableError;
class KeychainEntryNotFoundError extends Error {
    service;
    account;
    code = 'ERR_KEYCHAIN_NOT_FOUND';
    constructor(service, account) {
        super(`Keychain entry not found: service="${service}" account="${account}"`);
        this.service = service;
        this.account = account;
    }
}
exports.KeychainEntryNotFoundError = KeychainEntryNotFoundError;
class InvalidKeychainReferenceError extends Error {
    code = 'ERR_KEYCHAIN_REF_INVALID';
    constructor(value) {
        super(`Invalid keychain reference "${value}". Expected format: keychain:<service>/<account>`);
    }
}
exports.InvalidKeychainReferenceError = InvalidKeychainReferenceError;
// undefined = not yet loaded, null = load attempted and failed
let cachedEntryCtor;
function loadEntryCtor() {
    if (cachedEntryCtor !== undefined)
        return cachedEntryCtor;
    try {
        const mod = require('@napi-rs/keyring');
        cachedEntryCtor = mod.Entry;
    }
    catch {
        cachedEntryCtor = null;
    }
    return cachedEntryCtor;
}
/** Test-only cache reset. */
function __resetKeychainCache() {
    cachedEntryCtor = undefined;
}
/**
 * Parse a `keychain:<service>/<account>` string.
 * Returns `null` if the value is not a keychain reference.
 * Throws `InvalidKeychainReferenceError` if the prefix is present but malformed.
 */
function parseKeychainRef(value) {
    if (!value.startsWith(KEYCHAIN_PREFIX))
        return null;
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
function openEntry(ref) {
    const EntryCtor = loadEntryCtor();
    if (!EntryCtor) {
        throw new KeychainUnavailableError(new Error('@napi-rs/keyring not loaded'));
    }
    try {
        return new EntryCtor(ref.service, ref.account);
    }
    catch (err) {
        throw new KeychainUnavailableError(err);
    }
}
/**
 * Resolve a potentially-keychain-backed secret to its plaintext value.
 * Plain strings pass through unchanged.
 */
function resolveSecret(value) {
    const ref = parseKeychainRef(value);
    if (!ref)
        return value;
    const entry = openEntry(ref);
    const pwd = entry.getPassword();
    if (pwd === null) {
        throw new KeychainEntryNotFoundError(ref.service, ref.account);
    }
    return pwd;
}
/** Write a plaintext secret to the OS keychain. Used by profile add/edit. */
function storeSecret(ref, plaintext) {
    openEntry(ref).setPassword(plaintext);
}
/** Delete a secret from the OS keychain. Used by profile remove. */
function deleteSecret(ref) {
    return openEntry(ref).deletePassword();
}
/** Format a keychain reference back into canonical `keychain:<service>/<account>`. */
function formatKeychainRef(ref) {
    return `${KEYCHAIN_PREFIX}${ref.service}/${ref.account}`;
}
//# sourceMappingURL=secrets.js.map