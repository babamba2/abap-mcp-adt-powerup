"use strict";
/**
 * UpdateBehaviorDefinition Handler - Update ABAP Behavior Definition Source Code
 *
 * Uses AdtClient.updateBehaviorDefinition from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateBehaviorDefinition = handleUpdateBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateBehaviorDefinitionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Update source code of an existing ABAP behavior definition. Requires lock handle from LockObject. - use UpdateBehaviorDefinition (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Behavior definition name (e.g., ZOK_C_TEST_0001). Behavior definition must already exist.',
            },
            source_code: {
                type: 'string',
                description: 'Complete behavior definition source code.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable packages).',
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
        required: ['name', 'source_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateBehaviorDefinition MCP tool
 *
 * Uses AdtClient.updateBehaviorDefinition - low-level single method call
 */
async function handleUpdateBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { name, source_code, lock_handle, transport_request, session_id, session_state, } = args;
        // Validation
        if (!name || !source_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('name, source_code, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const behaviorDefinitionName = name.toUpperCase();
        logger?.info(`Starting behavior definition update: ${behaviorDefinitionName}`);
        try {
            // Update behavior definition with source code - using types from adt-clients
            const updateConfig = {
                name: behaviorDefinitionName,
                sourceCode: source_code,
                transportRequest: transport_request,
            };
            const updateState = await client
                .getBehaviorDefinition()
                .update(updateConfig, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for behavior definition ${behaviorDefinitionName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateBehaviorDefinition completed: ${behaviorDefinitionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    name: behaviorDefinitionName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Behavior definition ${behaviorDefinitionName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating behavior definition ${behaviorDefinitionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Behavior definition ${behaviorDefinitionName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Behavior definition ${behaviorDefinitionName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateBehaviorDefinition.js.map