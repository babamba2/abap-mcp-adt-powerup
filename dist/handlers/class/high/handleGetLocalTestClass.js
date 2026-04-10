"use strict";
/**
 * GetLocalTestClass Handler - Read Local Test Class via AdtClient
 *
 * Uses AdtClient.getLocalTestClass().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetLocalTestClass = handleGetLocalTestClass;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetLocalTestClass',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve local test class source code from a class. Supports reading active or inactive version.',
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
/**
 * Main handler for GetLocalTestClass MCP tool
 *
 * Uses AdtClient.getLocalTestClass().read() - high-level read operation
 */
async function handleGetLocalTestClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, version = 'active' } = args;
        // Validation
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Reading local test class for ${className}, version: ${version}`);
        try {
            // Read local test class using AdtClient
            const localTestClass = client.getLocalTestClass();
            const readResult = await localTestClass.read({ className }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Local test class for ${className} not found`);
            }
            // Extract source code from read result
            const sourceCode = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetLocalTestClass completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    version,
                    test_class_code: sourceCode,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading local test class for ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read local test class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Local test class for ${className} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Class ${className} is locked by another user.`;
            }
            else if (error.response?.status === 406) {
                errorMessage = `Local test class read not supported on this system (HTTP 406).`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetLocalTestClass.js.map