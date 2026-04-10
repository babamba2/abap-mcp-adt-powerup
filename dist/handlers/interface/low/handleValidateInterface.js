"use strict";
/**
 * ValidateInterface Handler - Validate ABAP Interface Name
 *
 * Uses AdtClient.validateInterface from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateInterface = handleValidateInterface;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateInterfaceLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Validate an ABAP interface name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name to validate (e.g., Z_MY_PROGRAM).',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.',
            },
            description: {
                type: 'string',
                description: 'Interface description. Required for validation.',
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
        required: ['interface_name', 'package_name', 'description'],
    },
};
/**
 * Main handler for ValidateInterface MCP tool
 *
 * Uses AdtClient.validateInterface - low-level single method call
 */
async function handleValidateInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, package_name, description, session_id, session_state, } = args;
        // Validation
        if (!interface_name || !package_name || !description) {
            return (0, utils_1.return_error)(new Error('interface_name, package_name, and description are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Starting interface validation: ${interfaceName}`);
        try {
            // Validate interface
            const validationState = await client.getInterface().validate({
                interfaceName: interfaceName,
                packageName: package_name.toUpperCase(),
                description: description,
            });
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidateInterface completed: ${interfaceName} (valid=${result.valid})`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    interface_name: interfaceName,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `Interface name ${interfaceName} is valid and available`
                        : `Interface name ${interfaceName} validation failed: ${result.message}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating interface ${interfaceName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to validate interface: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Interface ${interfaceName} not found.`;
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
//# sourceMappingURL=handleValidateInterface.js.map