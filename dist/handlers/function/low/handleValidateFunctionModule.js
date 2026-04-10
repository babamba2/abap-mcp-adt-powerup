"use strict";
/**
 * ValidateFunctionModule Handler - Validate ABAP function module name via ADT API
 *
 * Uses validateFunctionModuleName from @mcp-abap-adt/adt-clients/core/functionModule for function module-specific validation.
 * Requires function group name.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateFunctionModule = handleValidateFunctionModule;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateFunctionModuleLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Validate an ABAP function module name before creation. Checks if the name is valid and available. Requires function group name. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            function_group_name: {
                type: 'string',
                description: 'Function group name (e.g., Z_FUGR_TEST_0001)',
            },
            function_module_name: {
                type: 'string',
                description: 'Function module name to validate (e.g., Z_TEST_FM)',
            },
            description: {
                type: 'string',
                description: 'Optional description for validation',
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
 * Main handler for ValidateFunctionModule MCP tool
 */
async function handleValidateFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_group_name, function_module_name, description, session_id, session_state, } = args;
        if (!function_group_name || !function_module_name) {
            return (0, utils_1.return_error)(new Error('function_group_name and function_module_name are required'));
        }
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const functionGroupName = function_group_name.toUpperCase();
        const functionModuleName = function_module_name.toUpperCase();
        logger?.info(`Starting function module validation: ${functionModuleName} in group ${functionGroupName}`);
        try {
            const client = (0, clients_1.createAdtClient)(connection);
            const validationState = await client.getFunctionModule().validate({
                functionModuleName: functionModuleName,
                functionGroupName: functionGroupName,
                packageName: undefined,
                description: description,
            });
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            if (!result) {
                throw new Error('Validation did not return a result');
            }
            // Get updated session state after validation
            logger?.info(`✅ ValidateFunctionModule completed: ${functionModuleName} (valid=${result.valid}, msg=${result.message || 'N/A'})`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    function_module_name: functionModuleName,
                    function_group_name: functionGroupName,
                    description: description || null,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `Function module name ${functionModuleName} is valid and available`
                        : `Function module name ${functionModuleName} validation failed: ${result.message || 'Unknown error'}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating function module ${functionModuleName}: ${error?.message || error}`);
            let errorMessage = `Failed to validate function module: ${error.message || String(error)}`;
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
//# sourceMappingURL=handleValidateFunctionModule.js.map