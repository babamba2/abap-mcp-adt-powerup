"use strict";
/**
 * UpdateFunctionModule Handler - Update ABAP Function Module Source Code
 *
 * Uses AdtClient.updateFunctionModule from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateFunctionModule = handleUpdateFunctionModule;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateFunctionModuleLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Update source code of an existing ABAP function module. Requires lock handle from LockObject and function group name. - use UpdateFunctionModule (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            function_module_name: {
                type: 'string',
                description: 'Function module name (e.g., Z_TEST_FM). Function module must already exist.',
            },
            function_group_name: {
                type: 'string',
                description: 'Function group name containing the function module (e.g., Z_TEST_FG).',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP function module source code.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects locked in a request.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockFunctionModule. Required for update operation.',
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
        required: [
            'function_module_name',
            'function_group_name',
            'source_code',
            'lock_handle',
        ],
    },
};
/**
 * Main handler for UpdateFunctionModule MCP tool
 *
 * Uses AdtClient.updateFunctionModule - low-level single method call
 */
async function handleUpdateFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_module_name, function_group_name, source_code, transport_request, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!function_module_name ||
            !function_group_name ||
            !source_code ||
            !lock_handle) {
            return (0, utils_1.return_error)(new Error('function_module_name, function_group_name, source_code, and lock_handle are required'));
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
        logger?.info(`Starting function module update: ${functionModuleName} in ${functionGroupName}`);
        try {
            // Update function module with source code
            const updateState = await client.getFunctionModule().update({
                functionModuleName: functionModuleName,
                functionGroupName: functionGroupName,
                sourceCode: source_code,
                transportRequest: transport_request,
            }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for function module ${functionModuleName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateFunctionModule completed: ${functionModuleName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_module_name: functionModuleName,
                    function_group_name: functionGroupName,
                    transport_request: transport_request || null,
                    lock_handle: lock_handle,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Function module ${functionModuleName} updated successfully. Remember to unlock using UnlockFunctionModule.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating function module ${functionModuleName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update function module: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Function module ${functionModuleName} not found.`;
            }
            else if (error.response?.status === 400 && !transport_request) {
                errorMessage = `Update failed for ${functionModuleName}. The object may be assigned to a transport request. Pass transport_request explicitly.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Function module ${functionModuleName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateFunctionModule.js.map