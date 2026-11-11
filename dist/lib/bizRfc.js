"use strict";
/**
 * Business-action transport — calls ZMCP_BIZ_EXECUTE (function group ZMCP_BIZ).
 *
 * Path per SAP_RFC_BACKEND:
 *   soap   — direct SOAP RFC call of ZMCP_BIZ_EXECUTE (no dispatcher needed)
 *   native — direct node-rfc call of ZMCP_BIZ_EXECUTE
 *   odata / gateway / zrfc — ZMCP_ADT_DISPATCH action BIZ_EXECUTE, which
 *            forwards to ZMCP_BIZ_EXECUTE and wraps its exports as JSON
 *            {subrc, message, token, result}. Needs the dispatcher release
 *            that contains the BIZ_EXECUTE branch.
 *
 * EV_SUBRC of ZMCP_BIZ_EXECUTE: 0 ok, 4 refused / failed, 8 blocked.
 * A non-zero subrc is returned to the caller (it is the business answer),
 * never thrown. Only transport failures throw.
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
exports.buildImports = buildImports;
exports.fromDispatch = fromDispatch;
exports.callBizExecute = callBizExecute;
const native = __importStar(require("./nativeRfc"));
const rfcBackend_1 = require("./rfcBackend");
const soap = __importStar(require("./soapRfc"));
const BIZ_FM = 'ZMCP_BIZ_EXECUTE';
function parseMaybeJson(value) {
    if (typeof value !== 'string')
        return value ?? null;
    const s = value.trim();
    if (s === '')
        return null;
    try {
        return JSON.parse(s);
    }
    catch {
        return s;
    }
}
function fromExports(raw) {
    const pick = (k) => raw[k] ?? raw[k.toLowerCase()];
    return {
        subrc: Number(pick('EV_SUBRC') ?? 0),
        message: String(pick('EV_MESSAGE') ?? ''),
        token: String(pick('EV_TOKEN') ?? ''),
        result: parseMaybeJson(pick('EV_RESULT')),
    };
}
/** Builds the IV_* import parameters (all strings). */
function buildImports(req) {
    return {
        IV_ACTION: (req.action ?? '').trim().toUpperCase(),
        IV_MODE: req.mode,
        IV_PARAMS: JSON.stringify(req.params ?? {}),
        IV_TOKEN: req.token ?? '',
        IV_IDEM_KEY: req.idemKey ?? '',
    };
}
/** Parses the dispatcher BIZ_EXECUTE result object. */
function fromDispatch(result) {
    const r = typeof result === 'string' ? parseMaybeJson(result) : result;
    const o = (r && typeof r === 'object' ? r : {});
    return {
        subrc: Number(o.subrc ?? 0),
        message: String(o.message ?? ''),
        token: String(o.token ?? ''),
        result: parseMaybeJson(o.result),
    };
}
async function callBizExecute(connection, req) {
    const imports = buildImports(req);
    const backend = (0, rfcBackend_1.getBackend)();
    if (backend === 'soap') {
        const { raw } = await soap.callSoapRfc(connection, BIZ_FM, imports);
        return fromExports(raw);
    }
    if (backend === 'native') {
        return fromExports(await native.callRfcFunction(BIZ_FM, imports));
    }
    const { result } = await (0, rfcBackend_1.callDispatch)(connection, 'BIZ_EXECUTE', {
        action: imports.IV_ACTION,
        mode: imports.IV_MODE,
        params: imports.IV_PARAMS,
        token: imports.IV_TOKEN,
        idem_key: imports.IV_IDEM_KEY,
    });
    return fromDispatch(result);
}
//# sourceMappingURL=bizRfc.js.map