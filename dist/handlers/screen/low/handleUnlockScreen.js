"use strict";
/**
 * UnlockScreen Handler - Unlock parent program after Screen modification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockScreen = handleUnlockScreen;
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockScreenLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Unlock a program after Screen modification.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: { type: 'string', description: 'Parent program name.' },
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
        required: ['program_name', 'lock_handle'],
    },
};
async function handleUnlockScreen(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, lock_handle, session_id, session_state } = args;
        if (!program_name || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name and lock_handle are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
        const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
        logger?.info(`Unlocking program for screen: ${programName}`);
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lock_handle)}`, 'POST', 'default');
        logger?.info(`✅ Program unlocked: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                session_id: session_id || null,
                message: `Program ${programName} unlocked successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error unlocking for screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to unlock: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUnlockScreen.js.map