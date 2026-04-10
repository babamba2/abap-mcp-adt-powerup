"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadFunctionModule = handleReadFunctionModule;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadFunctionModule',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Read ABAP function module source code and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            function_module_name: {
                type: 'string',
                description: 'Function module name (e.g., Z_MY_FM).',
            },
            function_group_name: {
                type: 'string',
                description: 'Function group name containing the function module (e.g., Z_MY_FG).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['function_module_name', 'function_group_name'],
    },
};
async function handleReadFunctionModule(context, args) {
    const { connection, logger } = context;
    try {
        const { function_module_name, function_group_name, version = 'active', } = args;
        if (!function_module_name || !function_group_name)
            return (0, utils_1.return_error)(new Error('function_module_name and function_group_name are required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const functionModuleName = function_module_name.toUpperCase();
        const functionGroupName = function_group_name.toUpperCase();
        const obj = client.getFunctionModule();
        let source_code = null;
        try {
            const readResult = await obj.read({ functionModuleName, functionGroupName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${functionModuleName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({
                functionModuleName,
                functionGroupName,
            });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${functionModuleName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                function_module_name: functionModuleName,
                function_group_name: functionGroupName,
                version,
                source_code,
                metadata,
            }, null, 2),
        });
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
function safeStringify(data) {
    try {
        return JSON.stringify(data);
    }
    catch {
        return String(data);
    }
}
//# sourceMappingURL=handleReadFunctionModule.js.map