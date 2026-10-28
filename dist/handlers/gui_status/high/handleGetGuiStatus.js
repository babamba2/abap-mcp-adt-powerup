"use strict";
/**
 * GetGuiStatus Handler - Get ABAP GUI Status definition
 *
 * High-level handler: retrieves GUI status definition with structured data.
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_INTERNAL_FETCH.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetGuiStatus = handleGetGuiStatus;
const cuaFilter_1 = require("../../../lib/cuaFilter");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetGuiStatus',
    available_in: ['onprem', 'legacy'],
    description: 'Get ABAP GUI Status definition including statuses, function codes, menus, toolbars, and titles. A large program interface is big: pass status_name and/or function_codes to narrow every table, and format="compact" for one line per function (code, text, icon, function key, toolbar).',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name (e.g., SAPMV45A).',
            },
            status_name: {
                type: 'string',
                description: 'Optional: one GUI Status name. Narrows every table to that status (its SET functions, FUN texts, PFK keys, BUT toolbar, ACT / MEN / MTX menus); TIT / DOC / BIV are left out. If omitted, returns all statuses.',
            },
            function_codes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: function codes to keep (e.g. ["SAVE", "CRPO"]). Narrows FUN / SET / PFK / BUT to them.',
            },
            format: {
                type: 'string',
                enum: ['full', 'compact'],
                description: 'full (default) = CUA tables; compact = { statuses: [{ code, type, functions: [{ code, text, icon?, fkey?, toolbar? }] }] }.',
            },
        },
        required: ['program_name'],
    },
};
async function handleGetGuiStatus(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name) {
        return (0, utils_1.return_error)(new Error('Missing required parameter: program_name'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
    }
    const programName = args.program_name.toUpperCase();
    const statusName = args.status_name?.toUpperCase();
    const functionCodes = (Array.isArray(args.function_codes)
        ? args.function_codes
        : String(args.function_codes ?? '').split(/[\s,]+/)).filter(Boolean);
    const compact = args.format === 'compact';
    logger?.info(`Getting GUI status: ${programName}${statusName ? ` / ${statusName}` : ''}`);
    try {
        const { result } = await (0, rfcBackend_1.callDispatch)(connection, 'CUA_FETCH', {
            program: programName,
        });
        // Narrow every table to the requested status / function codes.
        // /ui2/cl_json=>serialize default keeps ABAP field names UPPERCASE.
        const filteredResult = (0, cuaFilter_1.filterCua)(result, { statusName, functionCodes });
        const definition = compact ? (0, cuaFilter_1.compactCua)(filteredResult) : filteredResult;
        logger?.info(`✅ GetGuiStatus completed: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                status_name: statusName || null,
                ...(functionCodes.length ? { function_codes: functionCodes } : {}),
                type: 'CUAD',
                format: compact ? 'compact' : 'full',
                definition,
                steps_completed: ['get_definition'],
            }, null, compact ? undefined : 1),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error getting GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to get GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleGetGuiStatus.js.map