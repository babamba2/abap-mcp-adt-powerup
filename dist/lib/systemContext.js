"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSystemContext = resolveSystemContext;
exports.getSystemContext = getSystemContext;
exports.resetSystemContextCache = resetSystemContextCache;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const connectionEvents_1 = require("./connectionEvents");
// Singleton cache is sufficient: one MCP session always maps to one SAP system.
// For HTTP/SSE the cache is reset before each request as a safety measure.
let cached;
/**
 * Detect whether the connected system is legacy (BASIS < 7.50 / pre-S/4HANA).
 *
 * Prior versions conflated two orthogonal dimensions into SAP_SYSTEM_TYPE:
 *   deployment (onprem|cloud) vs system generation (ECC|S/4HANA).
 * That made it impossible to express, e.g., an ECC system running on cloud
 * (RISE with SAP ECC on HEC), and silently routed ECC 7.40 backends through
 * the modern AdtClient — which fails on DDIC endpoints that don't exist on
 * BASIS < 7.50.
 *
 * Resolution order (first hit wins):
 *   1. SAP_SYSTEM_TYPE=legacy        → legacy (back-compat with pre-refactor profiles)
 *   2. SAP_VERSION=ECC                → legacy (ECC is always BASIS 7.xx / pre-S/4)
 *   3. ABAP_RELEASE numeric < 750     → legacy (any BASIS < 7.50)
 *   4. otherwise                      → modern (S/4HANA or S/4HANA Cloud)
 *
 * SAP_SYSTEM_TYPE is now purely a deployment axis: `onprem | cloud`.
 * The `legacy` value is accepted for backward compatibility but should not
 * be written by new profiles — wizard + CLI emit only `onprem`/`cloud`.
 */
function detectLegacy() {
    if (process.env.SAP_SYSTEM_TYPE?.toLowerCase() === 'legacy')
        return true;
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC')
        return true;
    const release = parseInt(process.env.ABAP_RELEASE || '', 10);
    if (Number.isFinite(release) && release < 750)
        return true;
    return false;
}
async function resolveSystemContext(connection, overrides) {
    // Priority 1: explicit overrides (from HTTP headers)
    if (overrides && (overrides.masterSystem || overrides.responsible)) {
        cached = {
            masterSystem: overrides.masterSystem,
            responsible: overrides.responsible,
            isLegacy: cached?.isLegacy ?? detectLegacy(),
        };
        return cached;
    }
    if (cached)
        return cached;
    // Detect legacy from SAP_SYSTEM_TYPE (default: cloud → not legacy)
    const isLegacy = detectLegacy();
    // Priority 2: env vars (on-prem or explicitly configured)
    const masterSystem = process.env.SAP_MASTER_SYSTEM;
    const responsible = process.env.SAP_RESPONSIBLE || process.env.SAP_USERNAME;
    if (masterSystem || responsible) {
        cached = { masterSystem, responsible, isLegacy };
        return cached;
    }
    // Cloud: try getSystemInformation API
    try {
        const info = await (0, mcp_abap_adt_clients_1.getSystemInformation)(connection);
        cached = {
            masterSystem: info?.systemID,
            responsible: info?.userName,
            client: info?.client,
            isLegacy,
        };
    }
    catch {
        cached = { isLegacy };
    }
    return cached;
}
function getSystemContext() {
    return cached || {};
}
function resetSystemContextCache() {
    cached = undefined;
}
(0, connectionEvents_1.registerConnectionResetHook)(resetSystemContextCache);
//# sourceMappingURL=systemContext.js.map