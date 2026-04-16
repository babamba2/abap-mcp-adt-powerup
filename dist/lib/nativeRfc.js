"use strict";
/**
 * Native RFC backend — calls RFC-enabled Function Modules via SAP NW RFC SDK.
 *
 * Parallel to soapRfc.ts. Exposes the same public contract
 * (DispatchResult, TextpoolResult) so handlers can swap backends by
 * importing from ./rfcBackend instead of ./soapRfc.
 *
 * Connection parameters come from process.env (populated from .sc4sap/sap.env):
 *   SAP_RFC_ASHOST, SAP_RFC_SYSNR, SAP_RFC_CLIENT,
 *   SAP_RFC_USER,   SAP_RFC_PASSWD, SAP_RFC_LANG,
 *   SAP_RFC_MSHOST, SAP_RFC_SYSID,  SAP_RFC_GROUP,
 *   SAP_RFC_SNC_QOP, SAP_RFC_SNC_MYNAME, SAP_RFC_SNC_PARTNERNAME, SAP_RFC_SNC_LIB
 *
 * Requires: SAP NW RFC SDK 7.50+ installed on the host AND the
 * `node-rfc` optional dependency. If either is missing, the first call
 * throws a descriptive error; MCP boot does not crash because the
 * module is loaded lazily inside `getPool()`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.callDispatch = callDispatch;
exports.callTextpool = callTextpool;
let pool = null;
let loadErr = null;
/**
 * Lazily initialise the node-rfc pool on first use. Kept out of
 * module-top so MCP server boot does not require the native addon
 * when `SAP_RFC_BACKEND=soap` is active.
 */
function getPool() {
    if (pool)
        return pool;
    if (loadErr)
        throw loadErr;
    let nodeRfc;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        nodeRfc = require('node-rfc');
    }
    catch (e) {
        loadErr = new Error(`node-rfc module could not be loaded. Install the SAP NW RFC SDK 7.50+ ` +
            `and set SAPNWRFC_HOME, then re-run the sc4sap setup wizard. ` +
            `Original error: ${e.message}`);
        throw loadErr;
    }
    const params = readConnectionParams();
    try {
        pool = new nodeRfc.Pool({
            connectionParameters: params,
            poolOptions: { low: 0, high: 3, idleTimeout: 300 },
        });
    }
    catch (e) {
        loadErr = new Error(`node-rfc Pool could not be initialised. Check that libsapnwrfc ` +
            `is resolvable (SAPNWRFC_HOME) and that SAP_RFC_* credentials are ` +
            `complete in sap.env. Original error: ${e.message}`);
        throw loadErr;
    }
    return pool;
}
function readConnectionParams() {
    const mshost = process.env.SAP_RFC_MSHOST;
    const user = required('SAP_RFC_USER');
    const passwd = required('SAP_RFC_PASSWD');
    const client = required('SAP_RFC_CLIENT');
    const lang = process.env.SAP_RFC_LANG ?? 'EN';
    const base = { user, passwd, client, lang };
    if (mshost) {
        // Message-server / load-balanced connection
        base.mshost = mshost;
        base.sysid = required('SAP_RFC_SYSID');
        base.group = process.env.SAP_RFC_GROUP ?? 'PUBLIC';
        if (process.env.SAP_RFC_MSSERV)
            base.msserv = process.env.SAP_RFC_MSSERV;
    }
    else {
        // Direct application-server connection
        base.ashost = required('SAP_RFC_ASHOST');
        base.sysnr = required('SAP_RFC_SYSNR');
    }
    const sncQop = process.env.SAP_RFC_SNC_QOP;
    if (sncQop) {
        base.snc_qop = sncQop;
        base.snc_myname = required('SAP_RFC_SNC_MYNAME');
        base.snc_partnername = required('SAP_RFC_SNC_PARTNERNAME');
        if (process.env.SAP_RFC_SNC_LIB)
            base.snc_lib = process.env.SAP_RFC_SNC_LIB;
    }
    return base;
}
function required(key) {
    const v = process.env[key];
    if (!v) {
        throw new Error(`${key} is required for SAP_RFC_BACKEND=native but not set in sap.env`);
    }
    return v;
}
function tryParseJson(str, fallback) {
    try {
        return JSON.parse(str);
    }
    catch {
        return fallback;
    }
}
/**
 * Call ZMCP_ADT_DISPATCH via native RFC.
 *
 * `connection` is accepted for signature parity with soapRfc.callDispatch
 * but ignored — RFC credentials are sourced from process.env so the
 * pool remains stable across invocations.
 */
async function callDispatch(_connection, action, params) {
    const p = getPool();
    const client = await p.acquire();
    try {
        const out = await client.call('ZMCP_ADT_DISPATCH', {
            IV_ACTION: action,
            IV_PARAMS: JSON.stringify(params),
        });
        const subrc = Number(out.EV_SUBRC ?? 0);
        const message = String(out.EV_MESSAGE ?? '');
        const result = tryParseJson(String(out.EV_RESULT ?? '{}'), {});
        if (subrc !== 0) {
            throw new Error(`ZMCP_ADT_DISPATCH error (action=${action}, subrc=${subrc}): ${message}`);
        }
        return { result, subrc, message };
    }
    finally {
        await p.release(client);
    }
}
/**
 * Call ZMCP_ADT_TEXTPOOL via native RFC. Same semantics as
 * soapRfc.callTextpool — WRITE fully replaces the language pool,
 * so caller must fetch → modify → write back.
 */
async function callTextpool(_connection, action, params) {
    const p = getPool();
    const client = await p.acquire();
    try {
        const out = await client.call('ZMCP_ADT_TEXTPOOL', {
            IV_ACTION: action,
            IV_PROGRAM: params.program,
            IV_LANGUAGE: params.language ?? '',
            IV_TEXTPOOL_JSON: params.textpool_json ?? '',
        });
        const subrc = Number(out.EV_SUBRC ?? 0);
        const message = String(out.EV_MESSAGE ?? '');
        const result = tryParseJson(String(out.EV_RESULT ?? '[]'), []);
        if (subrc !== 0) {
            throw new Error(`ZMCP_ADT_TEXTPOOL error (action=${action}, subrc=${subrc}): ${message}`);
        }
        return { result, subrc, message };
    }
    finally {
        await p.release(client);
    }
}
//# sourceMappingURL=nativeRfc.js.map