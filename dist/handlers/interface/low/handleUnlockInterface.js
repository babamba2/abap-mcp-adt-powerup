"use strict";
/**
 * UnlockInterface Handler - Unlock ABAP Interface
 *
 * Uses AdtClient.unlockInterface from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockInterface = handleUnlockInterface;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockInterfaceLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock an ABAP interface after modification. Must use the same session_id and lock_handle from LockInterface operation.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name (e.g., Z_MY_PROGRAM).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockInterface operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockInterface operation. Must be the same as used in LockInterface.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockInterface (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['interface_name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockInterface MCP tool
 *
 * Uses AdtClient.unlockInterface - low-level single method call
 */
async function handleUnlockInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, lock_handle, session_id, session_state } = args;
        // Validation
        if (!interface_name || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('interface_name, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Starting interface unlock: ${interfaceName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock interface
            const unlockState = await client
                .getInterface()
                .unlock({ interfaceName: interfaceName }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for interface ${interfaceName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockInterface completed: ${interfaceName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    interface_name: interfaceName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Interface ${interfaceName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking interface ${interfaceName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock interface: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Interface ${interfaceName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockInterface.`;
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
//# sourceMappingURL=handleUnlockInterface.js.map