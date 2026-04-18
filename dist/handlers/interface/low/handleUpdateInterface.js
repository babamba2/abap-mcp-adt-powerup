"use strict";
/**
 * UpdateInterface Handler - Update ABAP Interface Source Code
 *
 * Uses AdtClient.updateInterface from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateInterface = handleUpdateInterface;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateInterfaceLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Update source code of an existing ABAP interface. Requires lock handle from LockObject. - use UpdateInterface (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name (e.g., ZIF_TEST_INTERFACE). Interface must already exist.',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP interface source code.',
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
        required: ['interface_name', 'source_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateInterface MCP tool
 *
 * Uses AdtClient.updateInterface - low-level single method call
 */
async function handleUpdateInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, source_code, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!interface_name || !source_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('interface_name, source_code, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Starting interface update: ${interfaceName}`);
        try {
            // Update interface with source code
            const updateState = await client
                .getInterface()
                .update({ interfaceName: interfaceName, sourceCode: source_code }, { lockHandle: lock_handle });
            // updateResult may be null for successful updates (interface PUT returns 204 No Content)
            const updateResult = updateState.updateResult;
            // Get updated session state after update
            logger?.info(`✅ UpdateInterface completed: ${interfaceName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    interface_name: interfaceName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Interface ${interfaceName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating interface ${interfaceName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update interface: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Interface ${interfaceName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Interface ${interfaceName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateInterface.js.map