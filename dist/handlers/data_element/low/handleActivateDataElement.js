"use strict";
/**
 * ActivateDataElement Handler - Activate ABAP Data Element
 *
 * Uses AdtClient.activateDataElement from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateDataElement = handleActivateDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ActivateDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Activate an ABAP data element. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'Data element name (e.g., ZDT_MY_ELEMENT).',
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
 * Main handler for ActivateDataElement MCP tool
 *
 * Uses AdtClient.activateDataElement - low-level single method call
 */
async function handleActivateDataElement(context, args) {
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
        logger?.info(`Starting data element activation: ${dataElementName}`);
        try {
            // Activate data element
            const activateState = await client
                .getDataElement()
                .activate({ dataElementName: dataElementName });
            const response = activateState.activateResult;
            if (!response) {
                logger?.error(`Activation did not return a response for data element ${dataElementName}`);
                throw new Error(`Activation did not return a response for data element ${dataElementName}`);
            }
            // Parse activation response
            const activationResult = (0, utils_1.parseActivationResponse)(response.data);
            const success = activationResult.activated && activationResult.checked;
            // Get updated session state after activation
            logger?.info(`✅ ActivateDataElement completed: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success,
                    data_element_name: dataElementName,
                    activation: {
                        activated: activationResult.activated,
                        checked: activationResult.checked,
                        generated: activationResult.generated,
                    },
                    messages: activationResult.messages,
                    warnings: activationResult.messages.filter((m) => m.type === 'warning' || m.type === 'W'),
                    errors: activationResult.messages.filter((m) => m.type === 'error' || m.type === 'E'),
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: success
                        ? `Data element ${dataElementName} activated successfully`
                        : `Data element ${dataElementName} activation completed with ${activationResult.messages.length} message(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error activating data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to activate data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Data element ${dataElementName} not found.`;
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
//# sourceMappingURL=handleActivateDataElement.js.map