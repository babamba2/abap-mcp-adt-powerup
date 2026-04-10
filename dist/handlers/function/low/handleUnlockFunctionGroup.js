"use strict";
/**
 * UnlockFunctionGroup Handler - Unlock ABAP FunctionGroup
 *
 * Uses AdtClient.unlockFunctionGroup from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockFunctionGroup = handleUnlockFunctionGroup;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockFunctionGroupLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock an ABAP function group after modification. Must use the same session_id and lock_handle from LockFunctionGroup operation.',
    inputSchema: {
        type: 'object',
        properties: {
            function_group_name: {
                type: 'string',
                description: 'FunctionGroup name (e.g., Z_MY_PROGRAM).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockFunctionGroup operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockFunctionGroup operation. Must be the same as used in LockFunctionGroup.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockFunctionGroup (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['function_group_name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockFunctionGroup MCP tool
 *
 * Uses AdtClient.unlockFunctionGroup - low-level single method call
 */
async function handleUnlockFunctionGroup(context, args) {
    const { connection, logger } = context;
    try {
        const { function_group_name, lock_handle, session_id, session_state } = args;
        // Validation
        if (!function_group_name || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('function_group_name, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const functionGroupName = function_group_name.toUpperCase();
        logger?.info(`Starting function group unlock: ${functionGroupName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock function group
            const unlockState = await client
                .getFunctionGroup()
                .unlock({ functionGroupName: functionGroupName }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for function group ${functionGroupName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockFunctionGroup completed: ${functionGroupName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_group_name: functionGroupName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `FunctionGroup ${functionGroupName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking function group ${functionGroupName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock function group: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `FunctionGroup ${functionGroupName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockFunctionGroup.`;
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
//# sourceMappingURL=handleUnlockFunctionGroup.js.map