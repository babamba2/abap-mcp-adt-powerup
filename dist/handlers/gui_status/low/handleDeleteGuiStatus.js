"use strict";
/**
 * DeleteGuiStatus Handler - Delete an ABAP GUI Status
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_DELETE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteGuiStatus = handleDeleteGuiStatus;
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteGuiStatusLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Delete an ABAP GUI Status from a program.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            status_name: {
                type: 'string',
                description: 'GUI Status name to delete. Use "*" to delete all.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockGuiStatusLow.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['program_name', 'status_name', 'lock_handle'],
    },
};
async function handleDeleteGuiStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, status_name, lock_handle, session_id, session_state, } = args;
        if (!program_name || !status_name || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name, status_name, and lock_handle are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        const statusName = status_name.toUpperCase();
        logger?.info(`Deleting GUI status: ${programName} / ${statusName}`);
        await (0, soapRfc_1.callDispatch)(connection, 'CUA_DELETE', {
            program: programName,
            status: statusName,
        });
        logger?.info(`✅ GUI status deleted: ${programName}/${statusName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                status_name: statusName,
                session_id: session_id || null,
                message: `GUI Status ${programName}/${statusName} deleted successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error deleting GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to delete GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleDeleteGuiStatus.js.map