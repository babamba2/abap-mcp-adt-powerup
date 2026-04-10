"use strict";
/**
 * LockInterface Handler - Lock ABAP Interface
 *
 * Uses AdtClient.lockInterface from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockInterface = handleLockInterface;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockInterfaceLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Lock an ABAP interface for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name (e.g., ZIF_MY_INTERFACE).',
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
        required: ['interface_name'],
    },
};
/**
 * Main handler for LockInterface MCP tool
 *
 * Uses AdtClient.lockInterface - low-level single method call
 */
async function handleLockInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, session_id, session_state } = args;
        // Validation
        if (!interface_name) {
            return (0, utils_1.return_error)(new Error('interface_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Starting interface lock: ${interfaceName}`);
        try {
            // Lock interface
            const lockHandle = await client
                .getInterface()
                .lock({ interfaceName: interfaceName });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for interface ${interfaceName}`);
            }
            // Get updated session state after lock
            logger?.info(`✅ LockInterface completed: ${interfaceName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    interface_name: interfaceName,
                    session_id: session_id || null,
                    lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Interface ${interfaceName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking interface ${interfaceName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock interface: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Interface ${interfaceName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Interface ${interfaceName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockInterface.js.map