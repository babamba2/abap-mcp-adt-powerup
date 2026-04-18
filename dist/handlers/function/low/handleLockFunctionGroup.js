"use strict";
/**
 * LockFunctionGroup Handler - Lock ABAP FunctionGroup
 *
 * Uses AdtClient.lockFunctionGroup from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockFunctionGroup = handleLockFunctionGroup;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockFunctionGroupLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Lock an ABAP function group for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            function_group_name: {
                type: 'string',
                description: 'FunctionGroup name (e.g., Z_MY_PROGRAM).',
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
        required: ['function_group_name'],
    },
};
/**
 * Main handler for LockFunctionGroup MCP tool
 *
 * Uses AdtClient.lockFunctionGroup - low-level single method call
 */
async function handleLockFunctionGroup(context, args) {
    const { connection, logger } = context;
    try {
        const { function_group_name, session_id, session_state } = args;
        // Validation
        if (!function_group_name) {
            return (0, utils_1.return_error)(new Error('function_group_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const functionGroupName = function_group_name.toUpperCase();
        logger?.info(`Starting function group lock: ${functionGroupName}`);
        try {
            // Lock function group
            const lockHandle = await client
                .getFunctionGroup()
                .lock({ functionGroupName: functionGroupName });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for function group ${functionGroupName}`);
            }
            // Get updated session state after lock
            const actualSessionId = connection.getSessionId() || session_id || null;
            // Session state is passed through from input - auth-broker manages it
            const actualSessionState = session_state || null;
            logger?.info(`✅ LockFunctionGroup completed: ${functionGroupName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_group_name: functionGroupName,
                    session_id: actualSessionId,
                    lock_handle: lockHandle,
                    session_state: actualSessionState,
                    message: `FunctionGroup ${functionGroupName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking function group ${functionGroupName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock function group: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `FunctionGroup ${functionGroupName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `FunctionGroup ${functionGroupName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockFunctionGroup.js.map