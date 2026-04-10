"use strict";
/**
 * GetClass Handler - Read ABAP Class via AdtClient
 *
 * Uses AdtClient.getClass().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetClass = handleGetClass;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetClass',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP class source code. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS).',
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
 * Main handler for GetClass MCP tool
 *
 * Uses AdtClient.getClass().read() - high-level read operation
 */
async function handleGetClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, version = 'active' } = args;
        // Validation
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Reading class ${className}, version: ${version}`);
        try {
            // Read class using AdtClient
            const classObject = client.getClass();
            const readResult = await classObject.read({ className }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Class ${className} not found`);
            }
            // Extract source code from read result
            const sourceCode = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetClass completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    version,
                    source_code: sourceCode,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading class ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Class ${className} not found.`;
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
//# sourceMappingURL=handleGetClass.js.map