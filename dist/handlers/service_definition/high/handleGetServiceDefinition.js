"use strict";
/**
 * GetServiceDefinition Handler - Read ABAP ServiceDefinition via AdtClient
 *
 * Uses AdtClient.getServiceDefinition().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetServiceDefinition = handleGetServiceDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetServiceDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP service definition definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            service_definition_name: {
                type: 'string',
                description: 'ServiceDefinition name (e.g., Z_MY_SERVICEDEFINITION).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['service_definition_name'],
    },
};
/**
 * Main handler for GetServiceDefinition MCP tool
 *
 * Uses AdtClient.getServiceDefinition().read() - high-level read operation
 */
async function handleGetServiceDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { service_definition_name, version = 'active' } = args;
        // Validation
        if (!service_definition_name) {
            return (0, utils_1.return_error)(new Error('service_definition_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const serviceDefinitionName = service_definition_name.toUpperCase();
        logger?.info(`Reading service definition ${serviceDefinitionName}, version: ${version}`);
        try {
            // Read service definition using AdtClient
            const serviceDefinitionObject = client.getServiceDefinition();
            const readResult = await serviceDefinitionObject.read({ serviceDefinitionName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`ServiceDefinition ${serviceDefinitionName} not found`);
            }
            // Extract data from read result
            const serviceDefinitionData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetServiceDefinition completed successfully: ${serviceDefinitionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    service_definition_name: serviceDefinitionName,
                    version,
                    service_definition_data: serviceDefinitionData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading service definition ${serviceDefinitionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read service definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `ServiceDefinition ${serviceDefinitionName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `ServiceDefinition ${serviceDefinitionName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetServiceDefinition.js.map