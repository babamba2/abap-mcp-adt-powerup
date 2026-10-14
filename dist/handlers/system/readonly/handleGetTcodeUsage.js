"use strict";
/**
 * GetTcodeUsage — read-only: was each transaction used in the last N months?
 *
 * Source: workload monitor (ST03N) monthly aggregates, read on the SAP side
 * by ZMCP_WL_TCODE_USAGE (SWNC_COLLECTOR_GET_AGGREGATES, USERTCODE). User
 * names never leave SAP — the FM returns one boolean per transaction.
 *
 * Backend: ECC only — OData FunctionImport `WlTcodeUsage` on ZMCP_ADT_SRV.
 *
 * Other system: `destination` (or SAP_USAGE_RFCDEST from the profile sap.env)
 * names an SM59 destination on the connected system; the FM then reads that
 * system's aggregates over RFC (DEV profile → QA / PRD business usage). The
 * destination is site-specific — it is never defaulted by the plugin.
 *
 * Companion ABAP source: sc4sap/abap/zmcp_wl_tcode_usage_ecc.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetTcodeUsage = handleGetTcodeUsage;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetTcodeUsage',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Check whether transactions were used in the last N months, from the ST03N workload monthly aggregates. Returns one boolean per transaction plus `coverage` = months that actually hold workload data; when coverage < months, false means "not used in the last <coverage> months". No user names are returned. ECC-only (ZMCP_WL_TCODE_USAGE bridge FM).',
    inputSchema: {
        type: 'object',
        properties: {
            tcodes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Transaction codes to check (e.g. ["VA01","ZMY_TCODE"]).',
            },
            months: {
                type: 'number',
                description: 'Months back including the current one (1-36). Default: 12.',
                default: 12,
            },
            destination: {
                type: 'string',
                description: 'SM59 RFC destination (on the connected system) of the system to measure, e.g. the QA or PRD system. Omitted → SAP_USAGE_RFCDEST from the profile sap.env, else the connected system. "" or "LOCAL" → the connected system.',
            },
        },
        required: ['tcodes'],
    },
};
async function handleGetTcodeUsage(context, args) {
    const { connection, logger } = context;
    try {
        const tcodes = (Array.isArray(args?.tcodes) ? args.tcodes : [])
            .map((t) => String(t).trim().toUpperCase())
            .filter((t) => t && !t.includes(','));
        if (tcodes.length === 0) {
            return (0, utils_1.return_error)(new Error('tcodes must list at least one transaction'));
        }
        if (process.env.SAP_VERSION?.toUpperCase() !== 'ECC') {
            return (0, utils_1.return_error)(new Error('GetTcodeUsage currently routes through the ECC bridge (ZMCP_WL_TCODE_USAGE via OData FunctionImport WlTcodeUsage). Set SAP_VERSION=ECC in .sc4sap/sap.env.'));
        }
        const months = Math.min(36, Math.max(1, Math.trunc(Number(args.months ?? 12)) || 12));
        const rawDest = args.destination !== undefined
            ? String(args.destination)
            : (process.env.SAP_USAGE_RFCDEST ?? '');
        const destination = rawDest.trim().toUpperCase() === 'LOCAL' ? '' : rawDest.trim();
        logger?.info(`GetTcodeUsage: ${tcodes.length} tcodes, months=${months}, destination=${destination || '(local)'}`);
        const fm = await (0, rfcBackend_1.callWlTcodeUsage)(connection, {
            tcodes,
            months,
            rfcdest: destination,
        });
        const used = tcodes.filter((t) => fm.result?.[t] === true);
        const unused = tcodes.filter((t) => fm.result?.[t] !== true);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: fm.subrc === 0,
                path: 'ecc-odata-rfc',
                system: fm.sysid || null,
                destination: destination || null,
                message: fm.message,
                months,
                coverage: fm.coverage,
                complete: fm.coverage >= months,
                usage_known: fm.subrc === 0,
                used,
                unused,
                result: fm.result ?? {},
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`GetTcodeUsage error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleGetTcodeUsage.js.map