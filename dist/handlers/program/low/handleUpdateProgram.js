"use strict";
/**
 * UpdateProgram Handler - Update ABAP Program Source Code
 *
 * Uses AdtClient.updateProgram from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateProgram = handleUpdateProgram;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateProgramLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Update source code of an existing ABAP program. Requires lock handle from LockObject. - use UpdateProgram (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_TEST_PROGRAM). Program must already exist.',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP program source code.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
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
        required: ['program_name', 'source_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateProgram MCP tool
 *
 * Uses AdtClient.updateProgram - low-level single method call
 */
async function handleUpdateProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, source_code, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!program_name || !source_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name, source_code, and lock_handle are required'));
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
        const programName = program_name.toUpperCase();
        logger?.info(`Starting program update: ${programName}`);
        try {
            // Update program with source code
            await client
                .getProgram()
                .update({ programName: programName, sourceCode: source_code }, { lockHandle: lock_handle });
            // updateResult may be null for successful updates (program PUT returns 204 No Content)
            logger?.info(`✅ UpdateProgram completed: ${programName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    program_name: programName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Program ${programName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update program: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Program ${programName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Program ${programName} is locked by another user or lock handle is invalid.`;
            }
            else if (error.response?.data &&
                typeof error.response.data === 'string') {
                try {
                    const parser = new fast_xml_parser_1.XMLParser({
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
//# sourceMappingURL=handleUpdateProgram.js.map