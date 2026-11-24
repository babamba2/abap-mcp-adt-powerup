"use strict";
/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('odata' default, 'soap' / 'nco'
 * opt-in) and routes callDispatch / callTextpool to the matching backend
 * module on every call.
 *
 *   odata   — SAP OData v2 service (ZMCP_ADT_SRV) via HTTPS (default)
 *   soap    — classic /sap/bc/soap/rfc HTTPS gateway (SAP built-in)
 *   nco     — RFC through SAP .NET Connector (Windows; ./ncoRfc). Uses the
 *             odata module's functions, whose transport point switches to
 *             NCo, so every DDIC / usage helper works on it too.
 *
 * The 'native', 'gateway' and 'zrfc' backends were removed in 4.10.0; a
 * profile that still selects one fails with a message naming the fix
 * (see ./removedTransports).
 *
 * Handlers import from this file, never directly from soapRfc.ts /
 * odataRfc.ts, so switching backends is a single env flip with no code
 * change.
 *
 * Resolution is lazy (per-call) — required because:
 *   1. The sc4sap profile loader (lib/profile.ts activateProfile()) runs
 *      inside main() in launcher.ts, AFTER all handler imports complete.
 *      Handler imports transitively load this module, so eager top-level
 *      resolution would freeze the backend before sap.env was read.
 *   2. ReloadProfile (handlers/system/readonly/handleReloadProfile.ts)
 *      changes SAP_RFC_BACKEND at runtime; eager caching would defeat it.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.callWlJobUsage = exports.callWlTcodeUsage = exports.callDdicDomaRead = exports.callDdicDtelRead = exports.callDdicTablRead = exports.callDdicBadi = exports.callDdicActivate = exports.callDdicTtyp = exports.callDdicDoma = exports.callDdicDtel = exports.callDdicTabl = exports.callTextpool = exports.callDispatch = void 0;
exports.getBackend = getBackend;
exports.eccBridgePath = eccBridgePath;
exports.eccBridgeVia = eccBridgeVia;
const odata = __importStar(require("./odataRfc"));
const removedTransports_1 = require("./removedTransports");
const soap = __importStar(require("./soapRfc"));
function resolveBackend() {
    const v = (process.env.SAP_RFC_BACKEND ?? '').trim().toLowerCase();
    // Empty / unset → default. Default flipped from 'soap' to 'odata' 2026-04-22.
    if (v === '')
        return 'odata';
    if (v === 'odata')
        return 'odata';
    if (v === 'soap')
        return 'soap';
    if (v === 'nco')
        return 'nco';
    if (removedTransports_1.REMOVED_RFC_BACKENDS.includes(v)) {
        throw new Error((0, removedTransports_1.removedBackendMessage)(v));
    }
    throw new Error(`SAP_RFC_BACKEND must be 'odata' | 'soap' | 'nco' (got '${v}'). ` +
        `Default is 'odata'. Set in .sc4sap/sap.env.`);
}
/** Returns the active backend resolved from current process.env. */
function getBackend() {
    return resolveBackend();
}
function pickModule(b) {
    // nco reuses the odata functions (their transport switches to NCo).
    return b === 'soap' ? soap : odata;
}
const callDispatch = (...args) => pickModule(resolveBackend()).callDispatch(...args);
exports.callDispatch = callDispatch;
const callTextpool = (...args) => pickModule(resolveBackend()).callTextpool(...args);
exports.callTextpool = callTextpool;
// Live `backend` getter — preserves the existing read-only constant API
// while reflecting the *current* env (not the boot-time snapshot).
Object.defineProperty(module.exports, 'backend', {
    enumerable: true,
    configurable: false,
    get: resolveBackend,
});
/**
 * DDIC fallback helpers — ECC only, OData backend only.
 *
 * These route to the ZMCP_ADT_DDIC_TABL / DTEL / DOMA / ACTIVATE
 * function modules via the OData FunctionImports DdicTabl / DdicDtel /
 * DdicDoma / DdicActivate. They have no soap
 * equivalent — ECC fallback is intentionally only supported when the
 * environment has already chosen the OData path. Attempting to call
 * these with any other SAP_RFC_BACKEND raises a helpful error so the
 * user knows exactly which env var to change.
 *
 * Handlers typically gate on SAP_VERSION=ECC before reaching here. On
 * S/4HANA the native /sap/bc/adt/ddic/... REST endpoints are used and
 * these helpers are never invoked.
 */
function unsupportedDdic(name, current) {
    throw new Error(`${name} requires SAP_RFC_BACKEND=odata or nco (current='${current}'). ` +
        `The ECC DDIC fallback is only implemented against the OData ZMCP_ADT_SRV ` +
        `service. Set SAP_RFC_BACKEND=odata in .sc4sap/sap.env or use S/4HANA (native ADT).`);
}
function lazyDdic(name, fn) {
    return ((...args) => {
        const b = resolveBackend();
        if (b !== 'odata' && b !== 'nco')
            unsupportedDdic(name, b);
        return fn()(...args);
    });
}
/**
 * Read-only DDIC helpers also run over SOAP RFC (BASIS 7.31 has no SAP
 * Gateway, so the OData service cannot exist there). Same FMs, same result.
 */
function lazyDdicRead(name, odataFn, soapFn) {
    return ((...args) => {
        const b = resolveBackend();
        if (b === 'odata' || b === 'nco')
            return odataFn()(...args);
        if (b === 'soap')
            return soapFn()(...args);
        unsupportedDdic(name, b);
    });
}
exports.callDdicTabl = lazyDdic('callDdicTabl', () => odata.callDdicTabl);
exports.callDdicDtel = lazyDdic('callDdicDtel', () => odata.callDdicDtel);
exports.callDdicDoma = lazyDdic('callDdicDoma', () => odata.callDdicDoma);
exports.callDdicTtyp = lazyDdic('callDdicTtyp', () => odata.callDdicTtyp);
exports.callDdicActivate = lazyDdic('callDdicActivate', () => odata.callDdicActivate);
exports.callDdicBadi = lazyDdic('callDdicBadi', () => odata.callDdicBadi);
exports.callDdicTablRead = lazyDdicRead('callDdicTablRead', () => odata.callDdicTablRead, () => soap.callDdicTablRead);
exports.callDdicDtelRead = lazyDdicRead('callDdicDtelRead', () => odata.callDdicDtelRead, () => soap.callDdicDtelRead);
exports.callDdicDomaRead = lazyDdicRead('callDdicDomaRead', () => odata.callDdicDomaRead, () => soap.callDdicDomaRead);
exports.callWlTcodeUsage = lazyDdic('callWlTcodeUsage', () => odata.callWlTcodeUsage);
exports.callWlJobUsage = lazyDdic('callWlJobUsage', () => odata.callWlJobUsage);
/**
 * Response labels of the ECC function-module bridge. The OData labels stay
 * exactly as before ('ecc-odata-rfc', "via OData"); the NCo backend reports
 * its own path so a reply never claims a transport that was not used.
 */
function backendOrDefault() {
    try {
        return resolveBackend();
    }
    catch {
        return 'odata';
    }
}
function eccBridgePath() {
    return backendOrDefault() === 'nco' ? 'ecc-nco-rfc' : 'ecc-odata-rfc';
}
function eccBridgeVia() {
    return backendOrDefault() === 'nco' ? 'NCo RFC' : 'OData';
}
//# sourceMappingURL=rfcBackend.js.map