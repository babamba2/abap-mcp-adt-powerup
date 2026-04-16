"use strict";
/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('soap' default, 'native' /
 * 'gateway' / 'odata' opt-in) and re-exports the matching
 * callDispatch / callTextpool implementation.
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
exports.callTextpool = exports.callDispatch = exports.backend = void 0;
const gateway = __importStar(require("./gatewayRfc"));
const native = __importStar(require("./nativeRfc"));
const odata = __importStar(require("./odataRfc"));
const soap = __importStar(require("./soapRfc"));
function resolveBackend() {
    const v = (process.env.SAP_RFC_BACKEND ?? 'soap').trim().toLowerCase();
    if (v === 'native')
        return 'native';
    if (v === 'gateway')
        return 'gateway';
    if (v === 'odata')
        return 'odata';
    if (v === 'soap' || v === '')
        return 'soap';
    throw new Error(`SAP_RFC_BACKEND must be 'soap' | 'native' | 'gateway' | 'odata' (got '${v}'). ` +
        `Default is 'soap'. Set in .sc4sap/sap.env.`);
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
//# sourceMappingURL=rfcBackend.js.map