"use strict";
/**
 * ReadGuiStatus Handler - Read ABAP GUI Status definition
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_INTERNAL_FETCH.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadGuiStatus = handleReadGuiStatus;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadGuiStatus',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Read ABAP GUI Status definition (statuses, function codes, menus, toolbars, titles) for a program.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name (e.g., SAPMV45A).',
            },
        },
        required: ['program_name'],
    },
};
async function handleReadGuiStatus(context, args) {
    const { connection, logger } = context;
    try {
        if (!args.program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
        }
        const programName = args.program_name.toUpperCase();
        logger?.info(`Reading GUI status data for program: ${programName}`);
        const { result } = await (0, rfcBackend_1.callDispatch)(connection, 'CUA_FETCH', {
            program: programName,
        });
        logger?.info(`✅ ReadGuiStatus completed: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                definition: result,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error reading GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleReadGuiStatus.js.map