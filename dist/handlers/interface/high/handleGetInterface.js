"use strict";
/**
 * GetInterface Handler - Read ABAP Interface via AdtClient
 *
 * Uses AdtClient.getInterface().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetInterface = handleGetInterface;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetInterface',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP interface definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name (e.g., Z_MY_INTERFACE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['interface_name'],
    },
};
/**
 * Main handler for GetInterface MCP tool
 *
 * Uses AdtClient.getInterface().read() - high-level read operation
 */
async function handleGetInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, version = 'active' } = args;
        // Validation
        if (!interface_name) {
            return (0, utils_1.return_error)(new Error('interface_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Reading interface ${interfaceName}, version: ${version}`);
        try {
            // Read interface using AdtClient
            const interfaceObject = client.getInterface();
            const readResult = await interfaceObject.read({ interfaceName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Interface ${interfaceName} not found`);
            }
            // Extract data from read result
            const interfaceData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetInterface completed successfully: ${interfaceName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    interface_name: interfaceName,
                    version,
                    interface_data: interfaceData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading interface ${interfaceName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read interface: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Interface ${interfaceName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Interface ${interfaceName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetInterface.js.map