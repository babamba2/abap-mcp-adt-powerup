"use strict";
/**
 * DeleteScreen Handler (Low-level) - Delete an ABAP Screen via RFC
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteScreen = handleDeleteScreen;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteScreenLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Delete an ABAP Screen (Dynpro) from a program.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: { type: 'string', description: 'Parent program name.' },
            screen_number: {
                type: 'string',
                description: 'Screen number (e.g., 0100).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockScreenLow.',
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
        required: ['program_name', 'screen_number', 'lock_handle'],
    },
};
async function handleDeleteScreen(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, screen_number, lock_handle, session_id, session_state, } = args;
        if (!program_name || !screen_number || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name, screen_number, and lock_handle are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Deleting screen: ${programName} / ${screen_number}`);
        await (0, rfcBackend_1.callDispatch)(connection, 'DYNPRO_DELETE', {
            program: programName,
            dynpro: screen_number,
        });
        logger?.info(`✅ Screen deleted: ${programName}/${screen_number}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number,
                session_id: session_id || null,
                message: `Screen ${programName}/${screen_number} deleted successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error deleting screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to delete screen: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleDeleteScreen.js.map