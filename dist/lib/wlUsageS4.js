"use strict";
/**
 * Workload / job usage on S/4HANA — GetTcodeUsage and GetJobUsage.
 *
 * ECC reaches ZMCP_WL_TCODE_USAGE / ZMCP_WL_JOB_USAGE through dedicated OData
 * function imports (WlTcodeUsage / WlJobUsage) that only exist in the ECC
 * Gateway model. On S/4HANA the same function modules (function group
 * ZMCP_WL, sc4sap abap/zmcp_wl_*_s4.abap) are called through the dispatcher
 * action FM_PROXY of ZMCP_ADT_DISPATCH. Both FM names are already on the
 * FM_PROXY allow list, so no dispatcher change is needed.
 *
 * The result types are the ECC ones: handlers build the same JSON on both.
 * FM_PROXY returns the FM's exports as one JSON object
 * {"EV_SUBRC":0,"EV_MESSAGE":"..","EV_RESULT":"<json string>",...}.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAP_VERSION_HINT = exports.S4_USAGE_PATH = exports.WL_JOB_FM = exports.WL_TCODE_FM = void 0;
exports.isEccSystem = isEccSystem;
exports.explainProxyError = explainProxyError;
exports.callWlTcodeUsageS4 = callWlTcodeUsageS4;
exports.callWlJobUsageS4 = callWlJobUsageS4;
const rfcBackend_1 = require("./rfcBackend");
exports.WL_TCODE_FM = 'ZMCP_WL_TCODE_USAGE';
exports.WL_JOB_FM = 'ZMCP_WL_JOB_USAGE';
/** Same switch the other ECC / S/4 handlers use: only SAP_VERSION=ECC is legacy. */
function isEccSystem(env = process.env) {
    return env.SAP_VERSION?.toUpperCase() === 'ECC';
}
/** Value of `path` in the handler reply when the S/4 route was used. */
exports.S4_USAGE_PATH = 's4-dispatch-fm-proxy';
function parseJson(text, fallback) {
    try {
        const v = JSON.parse(String(text ?? ''));
        return v && typeof v === 'object'
            ? v
            : fallback;
    }
    catch {
        return fallback;
    }
}
/** Appended when SAP_VERSION is unset: an ECC system must say so in sap.env. */
exports.SAP_VERSION_HINT = ' If this is an ECC system, set SAP_VERSION=ECC in .sc4sap/sap.env (SAP_VERSION is not set, so the S/4HANA route was used).';
/**
 * Turns a dispatcher refusal into a message that names the missing piece.
 * `env` is a seam for tests.
 */
function explainProxyError(fm, error, env = process.env) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = (env.SAP_VERSION ?? '').trim() === '' ? exports.SAP_VERSION_HINT : '';
    if (/Unknown action/i.test(msg)) {
        return new Error(`${msg} — the ZMCP_ADT_DISPATCH on this system predates FM_PROXY; reinstall it via /sc4sap:setup (Step 9a).${hint}`);
    }
    if (/not on the allow list/i.test(msg)) {
        return new Error(`${msg} — the ZMCP_ADT_DISPATCH on this system predates the ${fm} allow-list entry; reinstall it via /sc4sap:setup (Step 9a).${hint}`);
    }
    if (/is not installed on this system/i.test(msg)) {
        return new Error(`${msg} — create function group ZMCP_WL and install ${fm} from sc4sap abap/${fm.toLowerCase()}_s4.abap (/sc4sap:setup, Step 9a.3).${hint}`);
    }
    if (hint &&
        error instanceof Error &&
        /ZMCP_ADT_DISPATCH|FM_PROXY/.test(msg)) {
        return new Error(`${msg}${hint}`);
    }
    return error instanceof Error ? error : new Error(msg);
}
/** Calls one allow-listed FM through FM_PROXY and returns its exports. */
async function callFmProxy(connection, fm, params) {
    let out;
    try {
        out = await (0, rfcBackend_1.callDispatch)(connection, 'FM_PROXY', {
            fm,
            params: Object.entries(params).map(([name, value]) => ({
                name,
                value: value ?? '',
            })),
        });
    }
    catch (e) {
        throw explainProxyError(fm, e);
    }
    const r = typeof out.result === 'string' ? parseJson(out.result, {}) : out.result;
    if (!r || typeof r !== 'object') {
        throw new Error(`FM_PROXY ${fm}: the answer is not a JSON object`);
    }
    return r;
}
/**
 * Transaction usage from the ST03N monthly aggregates — S/4HANA route.
 * Same contract as odataRfc.callWlTcodeUsage.
 */
async function callWlTcodeUsageS4(connection, params) {
    const raw = await callFmProxy(connection, exports.WL_TCODE_FM, {
        IV_TCODES: params.tcodes.join(','),
        IV_MONTHS: String(params.months ?? 12),
        IV_RFCDEST: params.rfcdest ?? '',
    });
    const subrc = Number(raw.EV_SUBRC ?? 0);
    const message = String(raw.EV_MESSAGE ?? '');
    if (subrc >= 8) {
        throw new Error(`${exports.WL_TCODE_FM} error (subrc=${subrc}): ${message}`);
    }
    return {
        subrc,
        message,
        coverage: Number(raw.EV_COVERAGE ?? 0),
        result: parseJson(raw.EV_RESULT ?? '{}', {}),
        sysid: String(raw.EV_SYSID ?? ''),
    };
}
/**
 * Background-job usage of programs (TBTCO + TBTCP) — S/4HANA route.
 * Same contract as odataRfc.callWlJobUsage.
 */
async function callWlJobUsageS4(connection, params) {
    const raw = await callFmProxy(connection, exports.WL_JOB_FM, {
        IV_PROGRAMS: params.programs.join(','),
        IV_MONTHS: String(params.months ?? 12),
    });
    const subrc = Number(raw.EV_SUBRC ?? 0);
    const message = String(raw.EV_MESSAGE ?? '');
    if (subrc >= 8) {
        throw new Error(`${exports.WL_JOB_FM} error (subrc=${subrc}): ${message}`);
    }
    return {
        subrc,
        message,
        oldest: String(raw.EV_OLDEST ?? '').trim(),
        result: parseJson(raw.EV_RESULT ?? '{}', {}),
    };
}
//# sourceMappingURL=wlUsageS4.js.map