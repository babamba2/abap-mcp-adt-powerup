"use strict";
/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('odata' default, 'soap' /
 * 'native' / 'gateway' / 'zrfc' opt-in) and routes callDispatch / callTextpool
 * to the matching backend module on every call.
 *
 * Default changed 2026-04-22 from 'soap' to 'odata': hardened Gateway
 * installs increasingly disable the /sap/bc/soap/rfc ICF node, and the
 * OData path goes through standard Gateway authorization (S_SERVICE)
 * instead of S_RFC. Existing setups that explicitly set
 * SAP_RFC_BACKEND=soap are unaffected.
 *
 *   soap    — classic /sap/bc/soap/rfc HTTPS gateway (SAP built-in)
 *   native  — direct NW RFC SDK on this host (requires SDK + node-rfc)
 *   gateway — remote RFC Gateway middleware via HTTPS/JSON (no SDK here)
 *   odata   — SAP OData v2 service (ZMCP_ADT_SRV) via HTTPS (SEGW-free)
 *
 * Handlers import from this file, never directly from soapRfc.ts /
 * nativeRfc.ts / gatewayRfc.ts / odataRfc.ts, so switching backends is
 * a single env flip with no code change.
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
exports.callDdicDomaRead = exports.callDdicDtelRead = exports.callDdicTablRead = exports.callDdicBadi = exports.callDdicActivate = exports.callDdicDoma = exports.callDdicDtel = exports.callDdicTabl = exports.callTextpool = exports.callDispatch = void 0;
exports.getBackend = getBackend;
const gateway = __importStar(require("./gatewayRfc"));
const native = __importStar(require("./nativeRfc"));
const odata = __importStar(require("./odataRfc"));
const soap = __importStar(require("./soapRfc"));
const zrfc = __importStar(require("./zrfcProxy"));
function resolveBackend() {
    const v = (process.env.SAP_RFC_BACKEND ?? '').trim().toLowerCase();
    // Empty / unset → default. Default flipped from 'soap' to 'odata' 2026-04-22.
    if (v === '')
        return 'odata';
    if (v === 'native')
        return 'native';
    if (v === 'gateway')
        return 'gateway';
    if (v === 'odata')
        return 'odata';
    if (v === 'soap')
        return 'soap';
    if (v === 'zrfc')
        return 'zrfc';
    throw new Error(`SAP_RFC_BACKEND must be 'soap' | 'native' | 'gateway' | 'odata' | 'zrfc' (got '${v}'). ` +
        `Default is 'odata'. Set in .sc4sap/sap.env.`);
}
/** Returns the active backend resolved from current process.env. */
function getBackend() {
    return resolveBackend();
}
function pickModule(b) {
    switch (b) {
        case 'native':
            return native;
        case 'gateway':
            return gateway;
        case 'odata':
            return odata;
        case 'zrfc':
            return zrfc;
        default:
            return soap;
    }
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
 * DdicDoma / DdicActivate. They have no soap / native / gateway
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
    throw new Error(`${name} requires SAP_RFC_BACKEND=odata (current='${current}'). ` +
        `The ECC DDIC fallback is only implemented against the OData ZMCP_ADT_SRV ` +
        `service. Set SAP_RFC_BACKEND=odata in .sc4sap/sap.env or use S/4HANA (native ADT).`);
}
function lazyDdic(name, fn) {
    return ((...args) => {
        const b = resolveBackend();
        if (b !== 'odata')
            unsupportedDdic(name, b);
        return fn()(...args);
    });
}
exports.callDdicTabl = lazyDdic('callDdicTabl', () => odata.callDdicTabl);
exports.callDdicDtel = lazyDdic('callDdicDtel', () => odata.callDdicDtel);
exports.callDdicDoma = lazyDdic('callDdicDoma', () => odata.callDdicDoma);
exports.callDdicActivate = lazyDdic('callDdicActivate', () => odata.callDdicActivate);
exports.callDdicBadi = lazyDdic('callDdicBadi', () => odata.callDdicBadi);
exports.callDdicTablRead = lazyDdic('callDdicTablRead', () => odata.callDdicTablRead);
exports.callDdicDtelRead = lazyDdic('callDdicDtelRead', () => odata.callDdicDtelRead);
exports.callDdicDomaRead = lazyDdic('callDdicDomaRead', () => odata.callDdicDomaRead);
//# sourceMappingURL=rfcBackend.js.map