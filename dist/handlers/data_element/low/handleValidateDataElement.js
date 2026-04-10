"use strict";
/**
 * ValidateDataElement Handler - Validate ABAP DataElement Name
 *
 * Uses AdtClient.validateDataElement from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateDataElement = handleValidateDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Validate an ABAP data element name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'DataElement name to validate (e.g., Z_MY_PROGRAM).',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.',
            },
            description: {
                type: 'string',
                description: 'DataElement description. Required for validation.',
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
        required: ['data_element_name', 'package_name', 'description'],
    },
};
/**
 * Main handler for ValidateDataElement MCP tool
 *
 * Uses AdtClient.validateDataElement - low-level single method call
 */
async function handleValidateDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, description, package_name, session_id, session_state, } = args;
        // Validation
        if (!data_element_name || !package_name || !description) {
            return (0, utils_1.return_error)(new Error('data_element_name, package_name, and description are required'));
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
        logger?.info(`Starting data element validation: ${dataElementName}`);
        try {
            // Validate data element
            let validationResponse;
            try {
                const validationState = await client.getDataElement().validate({
                    dataElementName: dataElementName,
                    packageName: package_name.toUpperCase(),
                    description: description,
                });
                validationResponse = validationState.validationResponse;
            }
            catch (validateError) {
                // If validation throws an error with response, use it
                if (validateError.response) {
                    validationResponse = validateError.response;
                }
                else {
                    throw validateError;
                }
            }
            if (!validationResponse) {
                logger?.error(`Validation did not return a result for data element ${dataElementName}`);
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidateDataElement completed: ${dataElementName} (valid=${result.valid})`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    data_element_name: dataElementName,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `DataElement name ${dataElementName} is valid and available`
                        : `DataElement name ${dataElementName} validation failed: ${result.message}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating data element ${dataElementName}: ${error?.message || error}`);
            // If validation endpoint returns 400, try to parse it as validation response
            if (error.response?.status === 400) {
                try {
                    const result = (0, utils_1.parseValidationResponse)(error.response);
                    return (0, utils_1.return_response)({
                        data: JSON.stringify({
                            success: result.valid,
                            data_element_name: dataElementName,
                            validation_result: result,
                            session_id: session_id || null,
                            session_state: null, // Session state management is now handled by auth-broker,
                            message: result.valid
                                ? `DataElement name ${dataElementName} is valid and available`
                                : `DataElement name ${dataElementName} validation failed: ${result.message}`,
                        }, null, 2),
                    });
                }
                catch (_parseError) {
                    // If parsing fails, continue with error handling
                }
            }
            // Parse error message
            let errorMessage = `Failed to validate data element: ${error.message || String(error)}`;
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
//# sourceMappingURL=handleValidateDataElement.js.map