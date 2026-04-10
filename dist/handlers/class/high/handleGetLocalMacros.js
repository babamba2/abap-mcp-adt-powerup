"use strict";
/**
 * GetLocalMacros Handler - Read Local Macros via AdtClient
 *
 * Uses AdtClient.getLocalMacros().read() for high-level read operation.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetLocalMacros = handleGetLocalMacros;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetLocalMacros',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve local macros source code from a class (macros include). Supports reading active or inactive version. Note: Macros are supported in older ABAP versions but not in newer ones.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['class_name'],
    },
};
async function handleGetLocalMacros(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, version = 'active' } = args;
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Reading local macros for ${className}, version: ${version}`);
        try {
            const localMacros = client.getLocalMacros();
            const readResult = await localMacros.read({ className }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Local macros for ${className} not found`);
            }
            const sourceCode = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetLocalMacros completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    version,
                    macros_code: sourceCode,
                    status: readResult.readResult.status,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading local macros for ${className}: ${error?.message || error}`);
            let errorMessage = `Failed to read local macros: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Local macros for ${className} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Class ${className} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetLocalMacros.js.map