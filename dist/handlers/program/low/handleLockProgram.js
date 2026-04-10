"use strict";
/**
 * LockProgram Handler - Lock ABAP Program
 *
 * Uses AdtClient.lockProgram from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockProgram = handleLockProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockProgramLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Lock an ABAP program for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_MY_PROGRAM).',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['program_name'],
    },
};
/**
 * Main handler for LockProgram MCP tool
 *
 * Uses AdtClient.lockProgram - low-level single method call
 */
async function handleLockProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, session_id, session_state } = args;
        // Validation
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        // Check if cloud - programs are not available on cloud systems
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Starting program lock: ${programName}`);
        try {
            // Lock program
            const lockHandle = await client.getProgram().lock({
                programName: programName,
            });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for program ${programName}`);
            }
            // Get updated session state after lock
            logger?.info(`✅ LockProgram completed: ${programName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    program_name: programName,
                    session_id: session_id || null,
                    lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Program ${programName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock program: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Program ${programName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Program ${programName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockProgram.js.map