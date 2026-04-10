"use strict";
/**
 * LockStructure Handler - Lock ABAP Structure
 *
 * Uses AdtClient.lockStructure from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockStructure = handleLockStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockStructureLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Lock an ABAP structure for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., Z_MY_PROGRAM).',
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
        required: ['structure_name'],
    },
};
/**
 * Main handler for LockStructure MCP tool
 *
 * Uses AdtClient.lockStructure - low-level single method call
 */
async function handleLockStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, session_id, session_state } = args;
        // Validation
        if (!structure_name) {
            return (0, utils_1.return_error)(new Error('structure_name is required'));
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
        logger?.info(`Starting structure lock: ${structureName}`);
        try {
            // Lock structure
            const lockHandle = await client
                .getStructure()
                .lock({ structureName: structureName });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for structure ${structureName}`);
            }
            // Get updated session state after lock
            logger?.info(`✅ LockStructure completed: ${structureName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    structure_name: structureName,
                    session_id: session_id || null,
                    lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Structure ${structureName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking structure ${structureName}:`, error);
            // Parse error message
            let errorMessage = `Failed to lock structure: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Structure ${structureName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Structure ${structureName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockStructure.js.map