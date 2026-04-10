"use strict";
/**
 * UpdateStructure Handler - Update ABAP Structure DDL Source
 *
 * Uses AdtClient.updateStructure from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateStructure = handleUpdateStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateStructureLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Update DDL source code of an existing ABAP structure. Requires lock handle from LockObject. - use UpdateStructureSource for full workflow with lock/unlock.',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., ZZ_S_TEST_001). Structure must already exist.',
            },
            ddl_code: {
                type: 'string',
                description: 'Complete DDL source code for the structure definition.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
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
        required: ['structure_name', 'ddl_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateStructure MCP tool
 *
 * Uses AdtClient.updateStructure - low-level single method call
 */
async function handleUpdateStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, ddl_code, lock_handle, session_id, session_state } = args;
        // Validation
        if (!structure_name || !ddl_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('structure_name, ddl_code, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const structureName = structure_name.toUpperCase();
        logger?.info(`Starting structure update: ${structureName}`);
        try {
            // Update structure with DDL code
            const updateState = await client
                .getStructure()
                .update({ structureName: structureName, ddlCode: ddl_code }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for structure ${structureName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateStructure completed: ${structureName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    structure_name: structureName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Structure ${structureName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating structure ${structureName}:`, error);
            // Parse error message
            let errorMessage = `Failed to update structure: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Structure ${structureName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Structure ${structureName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateStructure.js.map