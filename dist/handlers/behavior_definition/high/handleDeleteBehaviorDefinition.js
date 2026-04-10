"use strict";
/**
 * DeleteBehaviorDefinition Handler - Delete ABAP BehaviorDefinition via AdtClient
 *
 * Uses AdtClient.getBehaviorDefinition().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteBehaviorDefinition = handleDeleteBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteBehaviorDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Delete an ABAP behavior definition from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            behavior_definition_name: {
                type: 'string',
                description: 'BehaviorDefinition name (e.g., Z_MY_BEHAVIORDEFINITION).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['behavior_definition_name'],
    },
};
/**
 * Main handler for DeleteBehaviorDefinition MCP tool
 *
 * Uses AdtClient.getBehaviorDefinition().delete() - high-level delete operation with deletion check
 */
async function handleDeleteBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { behavior_definition_name, transport_request } = args;
        // Validation
        if (!behavior_definition_name) {
            return (0, utils_1.return_error)(new Error('behavior_definition_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const behaviorDefinitionName = behavior_definition_name.toUpperCase();
        logger?.info(`Starting behavior definition deletion: ${behaviorDefinitionName}`);
        try {
            // Delete behavior definition using AdtClient (includes deletion check)
            const behaviorDefinitionObject = client.getBehaviorDefinition();
            const deleteResult = await behaviorDefinitionObject.delete({
                name: behaviorDefinitionName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for behavior definition ${behaviorDefinitionName}`);
            }
            logger?.info(`✅ DeleteBehaviorDefinition completed successfully: ${behaviorDefinitionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    behavior_definition_name: behaviorDefinitionName,
                    transport_request: transport_request || null,
                    message: `BehaviorDefinition ${behaviorDefinitionName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting behavior definition ${behaviorDefinitionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `BehaviorDefinition ${behaviorDefinitionName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `BehaviorDefinition ${behaviorDefinitionName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteBehaviorDefinition.js.map