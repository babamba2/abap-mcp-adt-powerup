"use strict";
/**
 * ValidatePackage Handler - Validate ABAP Package Name
 *
 * Uses AdtClient.validatePackage from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidatePackage = handleValidatePackage;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidatePackageLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Validate an ABAP package name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name to validate (e.g., Z_MY_PROGRAM).',
            },
            super_package: {
                type: 'string',
                description: 'Parent (super) package name. The new package will be created under this package.',
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
        required: ['package_name', 'super_package'],
    },
};
/**
 * Main handler for ValidatePackage MCP tool
 *
 * Uses AdtClient.validatePackage - low-level single method call
 */
async function handleValidatePackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, super_package, session_id, session_state } = args;
        // Validation
        if (!package_name || !super_package) {
            return (0, utils_1.return_error)(new Error('package_name and super_package are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const packageName = package_name.toUpperCase();
        const superPackage = super_package.toUpperCase();
        logger?.info(`Starting package validation: ${packageName} in ${superPackage}`);
        try {
            // Validate package
            const validationState = await client.getPackage().validate({
                packageName: packageName,
                superPackage: superPackage,
                description: undefined,
            });
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidatePackage completed: ${packageName} (valid=${result.valid})`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    package_name: packageName,
                    super_package: superPackage,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `Package name ${packageName} is valid and available`
                        : `Package name ${packageName} validation failed: ${result.message}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to validate package: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Package ${packageName} not found.`;
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
//# sourceMappingURL=handleValidatePackage.js.map