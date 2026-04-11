"use strict";
/**
 * CheckDataElement Handler - Syntax check for ABAP DataElement
 *
 * Uses AdtClient.checkDataElement from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckDataElement = handleCheckDataElement;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Perform syntax check on an ABAP data element. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.',
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
 * Main handler for CheckDataElement MCP tool
 *
 * Uses AdtClient.checkDataElement - low-level single method call
 */
async function handleCheckDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, session_id, session_state } = args;
        // Validation
        if (!data_element_name) {
            return (0, utils_1.return_error)(new Error('data_element_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const dataElementName = data_element_name.toUpperCase();
        logger?.info(`Starting data element check: ${dataElementName}`);
        try {
            // Check data element
            const checkState = await client
                .getDataElement()
                .check({ dataElementName: dataElementName });
            const response = checkState.checkResult;
            if (!response) {
                throw new Error(`Check did not return a response for data element ${dataElementName}`);
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckDataElement completed: ${dataElementName}`);
            logger?.debug(`Status: ${checkResult.status} | Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    data_element_name: dataElementName,
                    check_result: checkResult,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `DataElement ${dataElementName} has no syntax errors`
                        : `DataElement ${dataElementName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to check data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `DataElement ${dataElementName} not found.`;
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
//# sourceMappingURL=handleCheckDataElement.js.map