"use strict";
/**
 * UnlockBehaviorDefinition Handler - Unlock ABAP Behavior Definition
 *
 * Uses AdtClient.unlockBehaviorDefinition from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockBehaviorDefinition = handleUnlockBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockBehaviorDefinitionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Unlock an ABAP behavior definition after modification. Must use the same session_id and lock_handle from LockBehaviorDefinition operation.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'BehaviorDefinition name (e.g., ZI_MY_BDEF).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockBehaviorDefinition operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockBehaviorDefinition operation. Must be the same as used in LockBehaviorDefinition.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockBehaviorDefinition (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockBehaviorDefinition MCP tool
 *
 * Uses AdtClient.unlockBehaviorDefinition - low-level single method call
 */
async function handleUnlockBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { name, lock_handle, session_id, session_state } = args;
        // Validation
        if (!name || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('name, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const bdefName = name.toUpperCase();
        logger?.info(`Starting behavior definition unlock: ${bdefName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock behavior definition - using types from adt-clients
            const unlockConfig = {
                name: bdefName,
            };
            const unlockState = await client
                .getBehaviorDefinition()
                .unlock(unlockConfig, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for behavior definition ${bdefName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockBehaviorDefinition completed: ${bdefName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    name: bdefName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `BehaviorDefinition ${bdefName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking behavior definition ${bdefName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `BehaviorDefinition ${bdefName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockBehaviorDefinition.`;
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
//# sourceMappingURL=handleUnlockBehaviorDefinition.js.map