"use strict";
/**
 * NCo RFC backend — SAP_RFC_BACKEND=nco.
 *
 * Calls the sc4sap helper function modules over RFC through SAP .NET
 * Connector (nco-bridge.exe from @babamba2/mcp-abap-connection), so neither
 * the OData service ZMCP_ADT_SRV nor the SOAP RFC ICF node is needed.
 * Windows only; NCo 3.x must be installed (see ensureNcoBridge).
 *
 * The OData backend (./odataRfc) names every call by its FunctionImport and
 * passes the FM's own parameter names (IV_*), so odataRfc delegates its
 * single transport point here when SAP_RFC_BACKEND=nco — callDispatch,
 * callTextpool and every DDIC / usage helper then work unchanged.
 *
 *   - remote-enabled FMs are called directly;
 *   - the others go through ZMCP_ADT_DISPATCH action FM_PROXY (allow list in
 *     the dispatcher), which needs a dispatcher with that action.
 *
 * Connection parameters (process.env, i.e. the active sc4sap profile):
 *   SAP_NCO_ASHOST  (default: host of SAP_URL)
 *   SAP_NCO_SYSNR   (default: derived from the SAP_URL port 80XX → XX)
 *   SAP_CLIENT, SAP_USERNAME, SAP_PASSWORD
 *   SAP_NCO_LANG    (default: SAP_LANGUAGE or EN)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNcoBackend = isNcoBackend;
exports.ncoParamsFromEnv = ncoParamsFromEnv;
exports.__setNcoClientFactory = __setNcoClientFactory;
exports.resetNcoClient = resetNcoClient;
exports.callNcoFunction = callNcoFunction;
exports.ncoFunctionImport = ncoFunctionImport;
const mcp_abap_connection_1 = require("@babamba2/mcp-abap-connection");
const profileEvents_1 = require("./profileEvents");
/** FunctionImport → remote-enabled FM, called directly. */
const DIRECT_FM = {
    Dispatch: 'ZMCP_ADT_DISPATCH',
    Textpool: 'ZMCP_ADT_TEXTPOOL',
    DdicTabl: 'ZMCP_ADT_DDIC_TABL',
    DdicDtel: 'ZMCP_ADT_DDIC_DTEL',
    DdicDoma: 'ZMCP_ADT_DDIC_DOMA',
    DdicActivate: 'ZMCP_ADT_DDIC_ACTIVATE',
};
/** FunctionImport → FM that is not remote-enabled, called via FM_PROXY. */
const PROXIED_FM = {
    DdicTtyp: 'ZMCP_ADT_DDIC_TTYP',
    DdicBadi: 'ZMCP_ADT_DDIC_BADI',
    DdicTablRead: 'ZMCP_ADT_DDIC_TABL_READ',
    DdicDtelRead: 'ZMCP_ADT_DDIC_DTEL_READ',
    DdicDomaRead: 'ZMCP_ADT_DDIC_DOMA_READ',
    WlTcodeUsage: 'ZMCP_WL_TCODE_USAGE',
    WlJobUsage: 'ZMCP_WL_JOB_USAGE',
};
function isNcoBackend(env = process.env) {
    return (env.SAP_RFC_BACKEND ?? '').trim().toLowerCase() === 'nco';
}
/** Builds the NCo logon parameters from the active profile env. */
function ncoParamsFromEnv(env = process.env) {
    let host = '';
    let sysnr = '';
    if (env.SAP_URL) {
        try {
            const u = new URL(env.SAP_URL);
            host = u.hostname;
            const port = Number.parseInt(u.port || '8000', 10);
            if (port >= 8000 && port <= 8099) {
                sysnr = String(port - 8000).padStart(2, '0');
            }
        }
        catch {
            /* fall through to the explicit keys */
        }
    }
    const ashost = env.SAP_NCO_ASHOST?.trim() || host;
    const sys = env.SAP_NCO_SYSNR?.trim() || sysnr;
    const missing = [];
    if (!ashost)
        missing.push('SAP_NCO_ASHOST (or SAP_URL)');
    if (!sys)
        missing.push('SAP_NCO_SYSNR (SAP_URL port is not 80XX)');
    if (!env.SAP_CLIENT)
        missing.push('SAP_CLIENT');
    if (!env.SAP_USERNAME)
        missing.push('SAP_USERNAME');
    if (!env.SAP_PASSWORD)
        missing.push('SAP_PASSWORD');
    if (missing.length > 0) {
        throw new Error(`NCo RFC backend: missing ${missing.join(', ')}`);
    }
    return {
        ashost,
        sysnr: sys,
        client: String(env.SAP_CLIENT),
        user: String(env.SAP_USERNAME),
        passwd: String(env.SAP_PASSWORD),
        lang: env.SAP_NCO_LANG?.trim() || env.SAP_LANGUAGE?.trim() || 'EN',
    };
}
let factory = (p) => new mcp_abap_connection_1.NcoRfcClient(p);
let client = null;
let opening = null;
/** Test seam: replace the client factory (and drop the open client). */
function __setNcoClientFactory(f) {
    void resetNcoClient();
    factory = f ?? ((p) => new mcp_abap_connection_1.NcoRfcClient(p));
}
async function resetNcoClient() {
    const c = client;
    client = null;
    opening = null;
    if (c)
        await c.close().catch(() => undefined);
}
// The client logged on with the previous profile's credentials.
(0, profileEvents_1.registerProfileChangeHook)(() => {
    void resetNcoClient();
});
async function getClient() {
    if (client?.alive)
        return client;
    if (!opening) {
        opening = (async () => {
            const c = factory(ncoParamsFromEnv());
            await c.open();
            client = c;
            return c;
        })().finally(() => {
            opening = null;
        });
    }
    return opening;
}
/** Calls any remote-enabled FM on the NCo connection (node-rfc value shapes). */
async function callNcoFunction(fm, params) {
    const c = await getClient();
    return c.call(fm, params);
}
/**
 * Transport for odataRfc when SAP_RFC_BACKEND=nco: same FunctionImport name
 * and IV_* parameters, returns the FM's exports (EV_SUBRC / EV_MESSAGE /
 * EV_RESULT, ...).
 */
async function ncoFunctionImport(functionImport, params) {
    const direct = DIRECT_FM[functionImport];
    if (direct)
        return callNcoFunction(direct, params);
    const proxied = PROXIED_FM[functionImport];
    if (!proxied) {
        throw new Error(`NCo RFC backend: no function module mapped for '${functionImport}'`);
    }
    const r = await callNcoFunction('ZMCP_ADT_DISPATCH', {
        IV_ACTION: 'FM_PROXY',
        IV_PARAMS: JSON.stringify({
            fm: proxied,
            params: Object.entries(params).map(([name, value]) => ({
                name,
                value: value ?? '',
            })),
        }),
    });
    const subrc = Number(r.EV_SUBRC ?? 0);
    const message = String(r.EV_MESSAGE ?? '');
    if (subrc !== 0) {
        const hint = /Unknown action/i.test(message)
            ? ' — the ZMCP_ADT_DISPATCH on this system predates FM_PROXY; reinstall it via /sc4sap:setup (Step 9a).'
            : '';
        throw new Error(`ZMCP_ADT_DISPATCH FM_PROXY ${proxied}: ${message}${hint}`);
    }
    try {
        return JSON.parse(String(r.EV_RESULT ?? '{}'));
    }
    catch {
        throw new Error(`ZMCP_ADT_DISPATCH FM_PROXY ${proxied}: result is not JSON: ${String(r.EV_RESULT).slice(0, 200)}`);
    }
}
//# sourceMappingURL=ncoRfc.js.map