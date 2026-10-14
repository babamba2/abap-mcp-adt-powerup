"use strict";
/**
 * Explains the invalid-lock-handle failure of ADT source writes on old BASIS.
 *
 * An ADT write is lock → PUT → unlock, and the lock lives in the stateful
 * ABAP session of the LOCK request. Some BASIS 7.31 systems never hand out a
 * `sap-contextid` cookie, so no stateful ADT session exists and the lock is
 * gone before the PUT arrives. The PUT then fails with HTTP 423
 * ExceptionResourceInvalidLockHandle in every session mode — a client-side
 * header cannot fix it. Without a hint the error reads like a lock held by
 * someone else.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_LOCK_HINT = void 0;
exports.withLegacyLockHint = withLegacyLockHint;
const LOCK_HANDLE_PATTERN = /ExceptionResourceInvalidLockHandle|invalid lock handle|is not locked/i;
exports.LEGACY_LOCK_HINT = 'Hint: this system runs BASIS < 7.40, where the ADT lock does not survive ' +
    'until the write (no stateful ADT session — the server never sends a ' +
    'sap-contextid cookie). ADT source writes (Update*/Create* with source) ' +
    'cannot work here from any client. Edit the source in SE38 / SE24 / SE37 ' +
    'instead; reads are not affected.';
function isOldBasis() {
    const release = parseInt(process.env.ABAP_RELEASE || '', 10);
    return !Number.isNaN(release) && release < 740;
}
/** Appends LEGACY_LOCK_HINT to an invalid-lock-handle error on BASIS < 7.40. */
function withLegacyLockHint(text) {
    if (!isOldBasis() || !LOCK_HANDLE_PATTERN.test(text))
        return text;
    if (text.includes(exports.LEGACY_LOCK_HINT))
        return text;
    return `${text}\n\n${exports.LEGACY_LOCK_HINT}`;
}
//# sourceMappingURL=legacyLockHint.js.map