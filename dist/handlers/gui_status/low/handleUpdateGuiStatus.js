"use strict";
/**
 * UpdateGuiStatus Handler - Update an ABAP GUI Status definition
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Accepts full CUA data as JSON
 * and writes it via RS_CUA_INTERNAL_WRITE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateGuiStatus = handleUpdateGuiStatus;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateGuiStatusLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Update an ABAP GUI Status definition. Provide full CUA data (from ReadGuiStatus) with modifications.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            cua_data: {
                type: 'string',
                description: 'Complete CUA data as JSON string (from ReadGuiStatus/GetGuiStatus). Modify and pass back.',
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
        required: ['program_name', 'cua_data', 'lock_handle'],
    },
};
async function handleUpdateGuiStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, cua_data, lock_handle, session_id, session_state } = args;
        if (!program_name || !cua_data || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name, cua_data, and lock_handle are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Updating GUI status data: ${programName}`);
        await (0, rfcBackend_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data,
        });
        logger?.info(`✅ GUI status updated: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                session_id: session_id || null,
                message: `GUI Status data for ${programName} updated successfully. Remember to unlock and activate.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error updating GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to update GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUpdateGuiStatus.js.map