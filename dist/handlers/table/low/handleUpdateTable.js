"use strict";
/**
 * UpdateTable Handler - Update ABAP Table DDL Source
 *
 * Uses AdtClient.updateTable from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateTable = handleUpdateTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateTableLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Update DDL source code of an existing ABAP table. Requires lock handle from LockObject. - use CreateTable for full workflow with lock/unlock.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., ZOK_T_TEST_0001). Table must already exist.',
            },
            ddl_code: {
                type: 'string',
                description: 'Complete DDL source code for the table definition.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Optional if object is local or already in transport.',
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
        required: ['table_name', 'ddl_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateTable MCP tool
 *
 * Uses AdtClient.updateTable - low-level single method call
 */
async function handleUpdateTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, ddl_code, lock_handle, transport_request, session_id, session_state, } = args;
        // Validation
        if (!table_name || !ddl_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('table_name, ddl_code, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table update: ${tableName}`);
        try {
            // Update table with DDL code
            const updateState = await client.getTable().update({
                tableName: tableName,
                ddlCode: ddl_code,
                transportRequest: transport_request,
            }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for table ${tableName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateTable completed: ${tableName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Table ${tableName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating table ${tableName}:`, error);
            // Parse error message
            let errorMessage = `Failed to update table: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Table ${tableName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Table ${tableName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateTable.js.map