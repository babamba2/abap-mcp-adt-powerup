"use strict";
/**
 * UnlockTable Handler - Unlock ABAP Table
 *
 * Uses AdtClient.unlockTable from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockTable = handleUnlockTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockTableLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Unlock an ABAP table after modification. Must use the same session_id and lock_handle from LockTable operation.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., Z_MY_PROGRAM).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockTable operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockTable operation. Must be the same as used in LockTable.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockTable (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['table_name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockTable MCP tool
 *
 * Uses AdtClient.unlockTable - low-level single method call
 */
async function handleUnlockTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, lock_handle, session_id, session_state } = args;
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table unlock: ${tableName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock table
            const unlockState = await client
                .getTable()
                .unlock({ tableName: tableName }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for table ${tableName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockTable completed: ${tableName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Table ${tableName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking table ${tableName}:`, error);
            // Parse error message
            let errorMessage = `Failed to unlock table: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Table ${tableName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockTable.`;
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
//# sourceMappingURL=handleUnlockTable.js.map