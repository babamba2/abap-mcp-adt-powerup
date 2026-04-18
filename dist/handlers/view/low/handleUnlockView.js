"use strict";
/**
 * UnlockView Handler - Unlock ABAP View
 *
 * Uses AdtClient.unlockView from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockView = handleUnlockView;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockViewLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock an ABAP view after modification. Must use the same session_id and lock_handle from LockView operation.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., Z_MY_PROGRAM).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockView operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockView operation. Must be the same as used in LockView.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockView (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['view_name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockView MCP tool
 *
 * Uses AdtClient.unlockView - low-level single method call
 */
async function handleUnlockView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, lock_handle, session_id, session_state } = args;
        // Validation
        if (!view_name || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('view_name, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const viewName = view_name.toUpperCase();
        logger?.info(`Starting view unlock: ${viewName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock view
            const unlockState = await client
                .getView()
                .unlock({ viewName: viewName }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for view ${viewName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockView completed: ${viewName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    view_name: viewName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `View ${viewName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking view ${viewName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock view: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `View ${viewName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockView.`;
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
//# sourceMappingURL=handleUnlockView.js.map