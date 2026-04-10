"use strict";
/**
 * UnlockProgram Handler - Unlock ABAP Program
 *
 * Uses AdtClient.unlockProgram from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockProgram = handleUnlockProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockProgramLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Unlock an ABAP program after modification. Must use the same session_id and lock_handle from LockProgram operation.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_MY_PROGRAM).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockProgram operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockProgram operation. Must be the same as used in LockProgram.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockProgram (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['program_name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockProgram MCP tool
 *
 * Uses AdtClient.unlockProgram - low-level single method call
 */
async function handleUnlockProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, lock_handle, session_id, session_state } = args;
        // Validation
        if (!program_name || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('program_name, lock_handle, and session_id are required'));
        }
        // Check if cloud - programs are not available on cloud systems
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Starting program unlock: ${programName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock program
            const unlockState = await client
                .getProgram()
                .unlock({ programName: programName }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for program ${programName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockProgram completed: ${programName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    program_name: programName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Program ${programName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock program: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Program ${programName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockProgram.`;
            }
            else if (error.response?.data &&
                typeof error.response.data === 'string') {
                try {
                    const { XMLParser } = require('fast-xml-parser');
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    const errorData = parser.parse(error.response.data);
                    const errorMsg = errorData['exc:exception']?.message?.['#text'] ||
                        errorData['exc:exception']?.message;
                    if (errorMsg) {
                        errorMessage = `SAP Error: ${errorMsg}`;
                    }
                }
                catch (_parseError) {
                    // Ignore parse errors
                }
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUnlockProgram.js.map