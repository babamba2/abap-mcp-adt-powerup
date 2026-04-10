"use strict";
/**
 * CheckInterface Handler - Syntax check for ABAP Interface
 *
 * Uses AdtClient.checkInterface from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckInterface = handleCheckInterface;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckInterfaceLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Perform syntax check on an ABAP interface. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name (e.g., Z_MY_PROGRAM).',
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
        required: ['interface_name'],
    },
};
/**
 * Main handler for CheckInterface MCP tool
 *
 * Uses AdtClient.checkInterface - low-level single method call
 */
async function handleCheckInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, session_id, session_state } = args;
        // Validation
        if (!interface_name) {
            return (0, utils_1.return_error)(new Error('interface_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Starting interface check: ${interfaceName}`);
        try {
            // Check interface
            const checkState = await client
                .getInterface()
                .check({ interfaceName: interfaceName });
            const response = checkState.checkResult;
            if (!response) {
                throw new Error(`Check did not return a response for interface ${interfaceName}`);
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckInterface completed: ${interfaceName}`);
            logger?.debug(`Status: ${checkResult.status} | Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    interface_name: interfaceName,
                    check_result: checkResult,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Interface ${interfaceName} has no syntax errors`
                        : `Interface ${interfaceName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking interface ${interfaceName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to check interface: ${error.message || String(error)}`;
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
//# sourceMappingURL=handleCheckInterface.js.map