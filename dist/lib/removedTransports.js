"use strict";
/**
 * Transports removed in 4.10.0.
 *
 *   SAP_RFC_BACKEND = native | gateway | zrfc   (node-rfc / RFC gateway middleware / ZRFC ICF handler)
 *   SAP_CONNECTION_TYPE = rfc                    (ADT over node-rfc + NW RFC SDK)
 *
 * A profile that still sets one of them must fail loudly at boot (and on
 * ReloadProfile) instead of silently running over another path.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMOVED_RFC_BACKENDS = void 0;
exports.removedBackendMessage = removedBackendMessage;
exports.removedConnectionTypeMessage = removedConnectionTypeMessage;
exports.findRemovedTransport = findRemovedTransport;
exports.assertSupportedTransport = assertSupportedTransport;
exports.REMOVED_RFC_BACKENDS = ['native', 'gateway', 'zrfc'];
function removedBackendMessage(value) {
    return (`SAP_RFC_BACKEND='${value}' was removed in abap-mcp-adt-powerup 4.10.0 ` +
        `(native / gateway / zrfc are no longer supported). ` +
        `Set SAP_RFC_BACKEND=odata (default) or soap in the profile sap.env, then restart.`);
}
function removedConnectionTypeMessage() {
    return (`SAP_CONNECTION_TYPE=rfc (ADT over node-rfc + NW RFC SDK) was removed in ` +
        `abap-mcp-adt-powerup 4.10.0. Remove SAP_CONNECTION_TYPE from the profile sap.env ` +
        `(the HTTP connection is the default), then restart.`);
}
/** Returns the error message for a removed transport in `env`, or null. */
function findRemovedTransport(env = process.env) {
    const backend = (env.SAP_RFC_BACKEND ?? '').trim().toLowerCase();
    if (exports.REMOVED_RFC_BACKENDS.includes(backend)) {
        return removedBackendMessage(backend);
    }
    const connType = (env.SAP_CONNECTION_TYPE ?? '').trim().toLowerCase();
    if (connType === 'rfc')
        return removedConnectionTypeMessage();
    return null;
}
/** Throws when `env` selects a removed transport. */
function assertSupportedTransport(env = process.env) {
    const msg = findRemovedTransport(env);
    if (msg)
        throw new Error(msg);
}
//# sourceMappingURL=removedTransports.js.map