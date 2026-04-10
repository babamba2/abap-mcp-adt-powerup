"use strict";
/**
 * DeleteServiceDefinition Handler - Delete ABAP ServiceDefinition via AdtClient
 *
 * Uses AdtClient.getServiceDefinition().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteServiceDefinition = handleDeleteServiceDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteServiceDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Delete an ABAP service definition from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            service_definition_name: {
                type: 'string',
                description: 'ServiceDefinition name (e.g., Z_MY_SERVICEDEFINITION).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['service_definition_name'],
    },
};
/**
 * Main handler for DeleteServiceDefinition MCP tool
 *
 * Uses AdtClient.getServiceDefinition().delete() - high-level delete operation with deletion check
 */
async function handleDeleteServiceDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { service_definition_name, transport_request } = args;
        // Validation
        if (!service_definition_name) {
            return (0, utils_1.return_error)(new Error('service_definition_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const serviceDefinitionName = service_definition_name.toUpperCase();
        logger?.info(`Starting service definition deletion: ${serviceDefinitionName}`);
        try {
            // Delete service definition using AdtClient (includes deletion check)
            const serviceDefinitionObject = client.getServiceDefinition();
            const deleteResult = await serviceDefinitionObject.delete({
                serviceDefinitionName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for service definition ${serviceDefinitionName}`);
            }
            logger?.info(`✅ DeleteServiceDefinition completed successfully: ${serviceDefinitionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    service_definition_name: serviceDefinitionName,
                    transport_request: transport_request || null,
                    message: `ServiceDefinition ${serviceDefinitionName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting service definition ${serviceDefinitionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete service definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `ServiceDefinition ${serviceDefinitionName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `ServiceDefinition ${serviceDefinitionName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteServiceDefinition.js.map