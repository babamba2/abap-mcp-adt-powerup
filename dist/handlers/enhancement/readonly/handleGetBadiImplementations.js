"use strict";
/**
 * GetBadiImplementations — read-only BAdI implementation discovery.
 *
 * Use case: symptom analysis on standard SAP BAdIs. When an error
 * occurs in a standard transaction or BAPI that runs through a BAdI
 * (e.g. PO BAPI error → ME_PROCESS_PO_CUST), this handler returns the
 * customer (Z* and Y*) implementations registered against that BAdI def
 * — including the implementing class name — so the user can read the
 * impl source via GetClass and find the bug.
 *
 * Backend (current revision):
 *   ECC only — routes through the ZMCP_ADT_DDIC_BADI function module
 *   via the OData FunctionImport `DdicBadi`. The MCP server's ADT
 *   datapreview / ddic / enhsxsb endpoints are absent on legacy
 *   kernels (BASIS < 7.50), so the RFC bridge is the only viable
 *   path. S/4HANA path is planned but not implemented.
 *
 * Coverage:
 *   classic BAdI (SE18/SE19): full
 *   kernel BAdI (SE20): NOT covered — returns kind='unknown'
 *
 * Companion ABAP source: sc4sap/abap/zmcp_adt_ddic_badi_ecc.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetBadiImplementations = handleGetBadiImplementations;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetBadiImplementations',
    available_in: ['onprem', 'legacy'],
    description: "[read-only] Find implementations of a (classic) BAdI definition. Use during symptom analysis when a standard SAP BAdI is implicated — answers 'which Z class extends this standard BAdI?'. Example flow: PO BAPI error → ME_PROCESS_PO_CUST → list Z impls → read the impl class source via GetClass to find the bug. Currently ECC-only (routes through the ZMCP_ADT_DDIC_BADI bridge FM). Classic BAdI only; kernel BAdI returns kind='unknown'.",
    inputSchema: {
        type: 'object',
        properties: {
            badi_definition: {
                type: 'string',
                description: 'BAdI definition name (e.g., ME_PROCESS_PO_CUST). Will be uppercased.',
            },
            customer_only: {
                type: 'boolean',
                description: 'Restrict to Z*/Y* implementations. Default: true. Set false to include SAP-shipped implementations.',
                default: true,
            },
            active_only: {
                type: 'boolean',
                description: 'Restrict to active implementations only. Default: true.',
                default: true,
            },
            include_methods: {
                type: 'boolean',
                description: 'Include the list of redefined method names per implementation (from SXC_EXIT). Default: true.',
                default: true,
            },
        },
        required: ['badi_definition'],
    },
};
async function handleGetBadiImplementations(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.badi_definition) {
            return (0, utils_1.return_error)(new Error('badi_definition is required'));
        }
        if (process.env.SAP_VERSION?.toUpperCase() !== 'ECC') {
            return (0, utils_1.return_error)(new Error('GetBadiImplementations currently routes through the ECC bridge (ZMCP_ADT_DDIC_BADI via OData FunctionImport DdicBadi). Set SAP_VERSION=ECC in .sc4sap/sap.env, or wait for the S/4HANA native ADT path (planned).'));
        }
        const badi_definition = String(args.badi_definition).toUpperCase();
        const customer_only = args.customer_only !== false;
        const active_only = args.active_only !== false;
        const include_methods = args.include_methods !== false;
        logger?.info(`GetBadiImplementations: badi=${badi_definition}, customer_only=${customer_only}, active_only=${active_only}, include_methods=${include_methods}`);
        const fmResult = await (0, rfcBackend_1.callDdicBadi)(connection, {
            badi_definition,
            customer_only,
            active_only,
            include_methods,
        });
        if (fmResult.subrc !== 0) {
            return (0, utils_1.return_error)(new Error(`ZMCP_ADT_DDIC_BADI returned subrc=${fmResult.subrc}: ${fmResult.message}`));
        }
        const parsed = (fmResult.result ?? {});
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                path: 'ecc-odata-rfc',
                message: fmResult.message,
                badi_definition: parsed.badi_definition ?? badi_definition,
                kind: parsed.kind ?? 'unknown',
                interface: parsed.interface ?? '',
                multi_use: parsed.multi_use ?? false,
                filter_dependent: parsed.filter_dependent ?? false,
                total_implementations: parsed.implementations?.length ?? 0,
                implementations: parsed.implementations ?? [],
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`GetBadiImplementations error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleGetBadiImplementations.js.map