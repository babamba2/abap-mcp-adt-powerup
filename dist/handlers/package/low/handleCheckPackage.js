"use strict";
/**
 * CheckPackage Handler - Syntax check for ABAP Package
 *
 * Uses AdtClient.checkPackage from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckPackage = handleCheckPackage;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckPackageLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Perform syntax check on an ABAP package. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_TEST_0002).',
            },
            super_package: {
                type: 'string',
                description: 'Super package (parent package) name (e.g., ZOK_PACKAGE). Required.',
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
 * Main handler for CheckPackage MCP tool
 *
 * Uses AdtClient.checkPackage - low-level single method call
 */
async function handleCheckPackage(context, args) {
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
        logger?.info(`Starting package check: ${packageName} in ${superPackage}`);
        try {
            // Check package
            const checkState = await client.getPackage().check({
                packageName: packageName,
                superPackage: superPackage,
            });
            const response = checkState.checkResult;
            if (!response) {
                throw new Error(`Check did not return a response for package ${packageName}`);
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckPackage completed: ${packageName}`);
            logger?.debug(`Status: ${checkResult.status} | Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    package_name: packageName,
                    super_package: superPackage,
                    check_result: checkResult,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Package ${packageName} has no syntax errors`
                        : `Package ${packageName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to check package: ${error.message || String(error)}`;
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
//# sourceMappingURL=handleCheckPackage.js.map