"use strict";
/**
 * LockDataElement Handler - Lock ABAP DataElement
 *
 * Uses AdtClient.lockDataElement from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockDataElement = handleLockDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Lock an ABAP data element for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'DataElement name (e.g., Z_MY_PROGRAM).',
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
        required: ['data_element_name'],
    },
};
/**
 * Main handler for LockDataElement MCP tool
 *
 * Uses AdtClient.lockDataElement - low-level single method call
 */
async function handleLockDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, session_id, session_state } = args;
        // Validation
        if (!data_element_name) {
            return (0, utils_1.return_error)(new Error('data_element_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const dataElementName = data_element_name.toUpperCase();
        logger?.info(`Starting data element lock: ${dataElementName}`);
        try {
            // Lock data element
            const lockHandle = await client
                .getDataElement()
                .lock({ dataElementName: dataElementName });
            if (!lockHandle) {
                logger?.error(`Lock did not return a lock handle for data element ${dataElementName}`);
                throw new Error(`Lock did not return a lock handle for data element ${dataElementName}`);
            }
            // Get updated session state after lock
            logger?.info(`✅ LockDataElement completed: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    session_id: session_id || null,
                    lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `DataElement ${dataElementName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `DataElement ${dataElementName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `DataElement ${dataElementName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockDataElement.js.map