"use strict";
/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('odata' default, 'soap' /
 * 'native' / 'gateway' opt-in) and re-exports the matching
 * callDispatch / callTextpool implementation.
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
 * a single env flip with no code change. The resolution happens once
 * at module-load time — changing SAP_RFC_BACKEND at runtime requires
 * an MCP server restart, which is already required for any sap.env
 * edit.
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
exports.callDdicActivate = exports.callDdicDoma = exports.callDdicDtel = exports.callDdicTabl = exports.callTextpool = exports.callDispatch = exports.backend = void 0;
const gateway = __importStar(require("./gatewayRfc"));
const native = __importStar(require("./nativeRfc"));
const odata = __importStar(require("./odataRfc"));
const soap = __importStar(require("./soapRfc"));
function resolveBackend() {
    const v = (process.env.SAP_RFC_BACKEND ?? 'odata').trim().toLowerCase();
    if (v === 'native')
        return 'native';
    if (v === 'gateway')
        return 'gateway';
    if (v === 'odata')
        return 'odata';
    if (v === 'soap' || v === '')
        return 'soap';
    throw new Error(`SAP_RFC_BACKEND must be 'soap' | 'native' | 'gateway' | 'odata' (got '${v}'). ` +
        `Default is 'odata'. Set in .sc4sap/sap.env.`);
}
exports.backend = resolveBackend();
function pickDispatch() {
    switch (exports.backend) {
        case 'native':
            return native.callDispatch;
        case 'gateway':
            return gateway.callDispatch;
        case 'odata':
            return odata.callDispatch;
        default:
            return soap.callDispatch;
    }
}
function pickTextpool() {
    switch (exports.backend) {
        case 'native':
            return native.callTextpool;
        case 'gateway':
            return gateway.callTextpool;
        case 'odata':
            return odata.callTextpool;
        default:
            return soap.callTextpool;
    }
}
exports.callDispatch = pickDispatch();
exports.callTextpool = pickTextpool();
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
function unsupportedDdic(name) {
    throw new Error(`${name} requires SAP_RFC_BACKEND=odata (current='${exports.backend}'). ` +
        `The ECC DDIC fallback is only implemented against the OData ZMCP_ADT_SRV ` +
        `service. Set SAP_RFC_BACKEND=odata in .sc4sap/sap.env or use S/4HANA (native ADT).`);
}
function pickDdicTabl() {
    if (exports.backend === 'odata')
        return odata.callDdicTabl;
    return (() => unsupportedDdic('callDdicTabl'));
}
function pickDdicDtel() {
    if (exports.backend === 'odata')
        return odata.callDdicDtel;
    return (() => unsupportedDdic('callDdicDtel'));
}
function pickDdicDoma() {
    if (exports.backend === 'odata')
        return odata.callDdicDoma;
    return (() => unsupportedDdic('callDdicDoma'));
}
function pickDdicActivate() {
    if (exports.backend === 'odata')
        return odata.callDdicActivate;
    return (() => unsupportedDdic('callDdicActivate'));
}
exports.callDdicTabl = pickDdicTabl();
exports.callDdicDtel = pickDdicDtel();
exports.callDdicDoma = pickDdicDoma();
exports.callDdicActivate = pickDdicActivate();
//# sourceMappingURL=rfcBackend.js.map