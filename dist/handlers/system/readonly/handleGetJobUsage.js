"use strict";
/**
 * GetJobUsage — read-only: is each program set up as a background job step?
 *
 * Source: job overview TBTCO (header) + TBTCP (steps), read on the SAP side
 * by ZMCP_WL_JOB_USAGE. A program counts as used when it is a step of a job
 * that is scheduled now (released / ready / active) or that finished or was
 * cancelled inside the window. Dialog runs (SE38/SA38) do not count. No user
 * names leave SAP — the FM returns one boolean per program.
 *
 * Backend: ECC only — OData FunctionImport `WlJobUsage` on ZMCP_ADT_SRV.
 *
 * Companion ABAP source: sc4sap/abap/zmcp_wl_job_usage_ecc.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetJobUsage = handleGetJobUsage;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetJobUsage',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Check whether programs are used as background job steps (SM37 jobs, TBTCO/TBTCP): true when the program is a step of a job that is scheduled now (released/ready/active, incl. periodic) or that finished/was cancelled in the last N months. SE38/SA38 dialog runs do not count. `oldest` = start date of the oldest finished job still kept; job reorganization deletes older ones, so when `complete` is false a false means "no job since <oldest>". No user names are returned. ECC-only (ZMCP_WL_JOB_USAGE bridge FM).',
    inputSchema: {
        type: 'object',
        properties: {
            programs: {
                type: 'array',
                items: { type: 'string' },
                description: 'ABAP program names to check (e.g. ["ZMY_REPORT"]).',
            },
            months: {
                type: 'number',
                description: 'Months back including the current one (1-36). Default: 12.',
                default: 12,
            },
        },
        required: ['programs'],
    },
};
/** First day (YYYYMMDD) of the oldest month in the window — same as the FM. */
function windowStart(months) {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - (months - 1), 1);
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    return `${start.getFullYear()}${mm}01`;
}
async function handleGetJobUsage(context, args) {
    const { connection, logger } = context;
    try {
        const programs = (Array.isArray(args?.programs) ? args.programs : [])
            .map((p) => String(p).trim().toUpperCase())
            .filter((p) => p && !p.includes(','));
        if (programs.length === 0) {
            return (0, utils_1.return_error)(new Error('programs must list at least one program'));
        }
        if (process.env.SAP_VERSION?.toUpperCase() !== 'ECC') {
            return (0, utils_1.return_error)(new Error('GetJobUsage currently routes through the ECC bridge (ZMCP_WL_JOB_USAGE via OData FunctionImport WlJobUsage). Set SAP_VERSION=ECC in .sc4sap/sap.env.'));
        }
        const months = Math.min(36, Math.max(1, Math.trunc(Number(args.months ?? 12)) || 12));
        logger?.info(`GetJobUsage: ${programs.length} programs, months=${months}`);
        const fm = await (0, rfcBackend_1.callWlJobUsage)(connection, { programs, months });
        const used = programs.filter((p) => fm.result?.[p] === true);
        const unused = programs.filter((p) => fm.result?.[p] !== true);
        const start = windowStart(months);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: fm.subrc === 0,
                path: 'ecc-odata-rfc',
                message: fm.message,
                months,
                window_start: start,
                oldest: fm.oldest,
                complete: fm.oldest !== '' && fm.oldest <= start,
                used,
                unused,
                result: fm.result ?? {},
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`GetJobUsage error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleGetJobUsage.js.map