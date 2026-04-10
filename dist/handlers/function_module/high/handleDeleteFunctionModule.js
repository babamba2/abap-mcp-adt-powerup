"use strict";
/**
 * DeleteFunctionModule Handler - Delete ABAP FunctionModule via AdtClient
 *
 * Uses AdtClient.getFunctionModule().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteFunctionModule = handleDeleteFunctionModule;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteFunctionModule',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Delete an ABAP function module from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            function_module_name: {
                type: 'string',
                description: 'FunctionModule name (e.g., Z_MY_FUNCTIONMODULE).',
            },
            function_group_name: {
                type: 'string',
                description: 'FunctionGroup name containing the function module (e.g., Z_MY_FUNCTIONGROUP).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['function_module_name', 'function_group_name'],
    },
};
/**
 * Main handler for DeleteFunctionModule MCP tool
 *
 * Uses AdtClient.getFunctionModule().delete() - high-level delete operation with deletion check
 */
async function handleDeleteFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_module_name, function_group_name, transport_request } = args;
        // Validation
        if (!function_module_name || !function_group_name) {
            return (0, utils_1.return_error)(new Error('function_module_name and function_group_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const functionModuleName = function_module_name.toUpperCase();
        const functionGroupName = function_group_name.toUpperCase();
        logger?.info(`Starting function module deletion: ${functionModuleName} in ${functionGroupName}`);
        try {
            // Delete function module using AdtClient (includes deletion check)
            const functionModuleObject = client.getFunctionModule();
            const deleteResult = await functionModuleObject.delete({
                functionModuleName,
                functionGroupName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for function module ${functionModuleName}`);
            }
            logger?.info(`✅ DeleteFunctionModule completed successfully: ${functionModuleName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_module_name: functionModuleName,
                    function_group_name: functionGroupName,
                    transport_request: transport_request || null,
                    message: `FunctionModule ${functionModuleName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting function module ${functionModuleName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete function module: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `FunctionModule ${functionModuleName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `FunctionModule ${functionModuleName} is locked by another user. Cannot delete.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Bad request. Check if transport request is required and valid.`;
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
//# sourceMappingURL=handleDeleteFunctionModule.js.map