"use strict";
/**
 * GetFunctionModule Handler - Read ABAP FunctionModule via AdtClient
 *
 * Uses AdtClient.getFunctionModule().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetFunctionModule = handleGetFunctionModule;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetFunctionModule',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP function module definition. Supports reading active or inactive version.',
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
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['function_module_name', 'function_group_name'],
    },
};
/**
 * Main handler for GetFunctionModule MCP tool
 *
 * Uses AdtClient.getFunctionModule().read() - high-level read operation
 */
async function handleGetFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_module_name, function_group_name, version = 'active', } = args;
        // Validation
        if (!function_module_name || !function_group_name) {
            return (0, utils_1.return_error)(new Error('function_module_name and function_group_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const functionModuleName = function_module_name.toUpperCase();
        const functionGroupName = function_group_name.toUpperCase();
        logger?.info(`Reading function module ${functionModuleName} in ${functionGroupName}, version: ${version}`);
        try {
            // Read function module using AdtClient
            const functionModuleObject = client.getFunctionModule();
            const readResult = await functionModuleObject.read({ functionModuleName, functionGroupName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`FunctionModule ${functionModuleName} not found`);
            }
            // Extract data from read result
            let functionModuleData;
            if (typeof readResult.readResult.data === 'string') {
                functionModuleData = readResult.readResult.data;
            }
            else {
                try {
                    functionModuleData = JSON.stringify(readResult.readResult.data);
                }
                catch {
                    // Fallback for circular references (e.g. raw Axios response objects)
                    functionModuleData = String(readResult.readResult.data);
                }
            }
            logger?.info(`✅ GetFunctionModule completed successfully: ${functionModuleName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_module_name: functionModuleName,
                    function_group_name: functionGroupName,
                    version,
                    function_module_data: functionModuleData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading function module ${functionModuleName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read function module: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `FunctionModule ${functionModuleName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `FunctionModule ${functionModuleName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetFunctionModule.js.map