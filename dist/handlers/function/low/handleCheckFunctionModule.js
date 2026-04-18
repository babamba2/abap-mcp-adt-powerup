"use strict";
/**
 * CheckFunctionModule Handler - Syntax check for ABAP function module via ADT API
 *
 * Uses checkFunctionModule from @babamba2/mcp-abap-adt-clients/core/functionModule for function module-specific checking.
 * Requires function group name.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckFunctionModule = handleCheckFunctionModule;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckFunctionModuleLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Perform syntax check on an ABAP function module. Returns syntax errors, warnings, and messages. Requires function group name. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            function_group_name: {
                type: 'string',
                description: 'Function group name (e.g., Z_FUGR_TEST_0001)',
            },
            function_module_name: {
                type: 'string',
                description: 'Function module name (e.g., Z_TEST_FM)',
            },
            version: {
                type: 'string',
                description: "Version to check: 'active' (last activated) or 'inactive' (current unsaved). Default: active",
                enum: ['active', 'inactive'],
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
        required: ['function_group_name', 'function_module_name'],
    },
};
/**
 * Main handler for CheckFunctionModule MCP tool
 */
async function handleCheckFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_group_name, function_module_name, version = 'active', session_id, session_state, } = args;
        if (!function_group_name || !function_module_name) {
            return (0, utils_1.return_error)(new Error('function_group_name and function_module_name are required'));
        }
        const checkVersion = version && ['active', 'inactive'].includes(version.toLowerCase())
            ? version.toLowerCase()
            : 'active';
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const functionGroupName = function_group_name.toUpperCase();
        const functionModuleName = function_module_name.toUpperCase();
        logger?.info(`Starting function module check: ${functionModuleName} in group ${functionGroupName} (version: ${checkVersion})`);
        try {
            const client = (0, clients_1.createAdtClient)(connection);
            const checkState = await client.getFunctionModule().check({
                functionModuleName: functionModuleName,
                functionGroupName: functionGroupName,
            }, checkVersion);
            const response = checkState.checkResult;
            if (!response) {
                throw new Error('Function module check did not return a response');
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckFunctionModule completed: ${functionModuleName}`);
            logger?.debug(`Status: ${checkResult.status} | Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    function_group_name: functionGroupName,
                    function_module_name: functionModuleName,
                    version: checkVersion,
                    check_result: checkResult,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Function module ${functionModuleName} has no syntax errors`
                        : `Function module ${functionModuleName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking function module ${functionModuleName}: ${error?.message || error}`);
            let errorMessage = `Failed to check function module: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Function module ${functionModuleName} not found.`;
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
//# sourceMappingURL=handleCheckFunctionModule.js.map