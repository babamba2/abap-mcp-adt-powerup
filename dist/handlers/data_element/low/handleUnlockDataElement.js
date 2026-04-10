"use strict";
/**
 * UnlockDataElement Handler - Unlock ABAP DataElement
 *
 * Uses AdtClient.unlockDataElement from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockDataElement = handleUnlockDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Unlock an ABAP data element after modification. Must use the same session_id and lock_handle from LockDataElement operation.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'DataElement name (e.g., Z_MY_PROGRAM).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockDataElement operation.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockDataElement operation. Must be the same as used in LockDataElement.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockDataElement (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['data_element_name', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockDataElement MCP tool
 *
 * Uses AdtClient.unlockDataElement - low-level single method call
 */
async function handleUnlockDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, lock_handle, session_id, session_state } = args;
        // Validation
        if (!data_element_name || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('data_element_name, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const dataElementName = data_element_name.toUpperCase();
        logger?.info(`Starting data element unlock: ${dataElementName}`);
        try {
            // Unlock data element
            const unlockState = await client
                .getDataElement()
                .unlock({ dataElementName: dataElementName }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                logger?.error(`Unlock did not return a response for data element ${dataElementName}`);
                throw new Error(`Unlock did not return a response for data element ${dataElementName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockDataElement completed: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `DataElement ${dataElementName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `DataElement ${dataElementName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockDataElement.`;
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
//# sourceMappingURL=handleUnlockDataElement.js.map