"use strict";
/**
 * UnlockFunctionModule Handler - Unlock ABAP Function Module
 *
 * Uses AdtClient.unlockFunctionModule from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockFunctionModule = handleUnlockFunctionModule;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockFunctionModuleLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock an ABAP function module after modification. Must use the same session_id and lock_handle from LockFunctionModule operation.',
    inputSchema: {
        type: 'object',
        properties: {
            function_module_name: {
                type: 'string',
                description: 'Function module name (e.g., Z_MY_FUNCTION).',
            },
            function_group_name: {
                type: 'string',
                description: 'Function group name (e.g., ZFG_MY_GROUP).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockFunctionModule operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockFunctionModule operation. Must be the same as used in LockFunctionModule.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockFunctionModule (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: [
            'function_module_name',
            'function_group_name',
            'lock_handle',
            'session_id',
        ],
    },
};
/**
 * Main handler for UnlockFunctionModule MCP tool
 *
 * Uses AdtClient.unlockFunctionModule - low-level single method call
 */
async function handleUnlockFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_module_name, function_group_name, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!function_module_name ||
            !function_group_name ||
            !lock_handle ||
            !session_id) {
            return (0, utils_1.return_error)(new Error('function_module_name, function_group_name, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const functionModuleName = function_module_name.toUpperCase();
        const functionGroupName = function_group_name.toUpperCase();
        logger?.info(`Starting function module unlock: ${functionModuleName} in ${functionGroupName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock function module
            // Note: unlock() doesn't throw if successful, so if we reach here, unlock succeeded
            await client.getFunctionModule().unlock({
                functionModuleName: functionModuleName,
                functionGroupName: functionGroupName,
            }, lock_handle);
            // Get updated session state after unlock
            logger?.info(`✅ UnlockFunctionModule completed: ${functionModuleName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_module_name: functionModuleName,
                    function_group_name: functionGroupName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Function module ${functionModuleName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking function module ${functionModuleName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock function module: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Function module ${functionModuleName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockFunctionModule.`;
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
//# sourceMappingURL=handleUnlockFunctionModule.js.map