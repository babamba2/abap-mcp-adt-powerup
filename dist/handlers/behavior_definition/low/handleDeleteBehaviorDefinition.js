"use strict";
/**
 * DeleteBehaviorDefinition Handler - Delete ABAP Behavior Definition
 *
 * Uses AdtClient.deleteBehaviorDefinition from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteBehaviorDefinition = handleDeleteBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteBehaviorDefinitionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Delete an ABAP behavior definition from the SAP system via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'BehaviorDefinition name (e.g., ZI_MY_BDEF).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['name'],
    },
};
/**
 * Main handler for DeleteBehaviorDefinition MCP tool
 *
 * Uses AdtClient.deleteBehaviorDefinition - low-level single method call
 */
async function handleDeleteBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { name, transport_request } = args;
        // Validation
        if (!name) {
            return (0, utils_1.return_error)(new Error('name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const bdefName = name.toUpperCase();
        logger?.info(`Starting behavior definition deletion: ${bdefName}`);
        try {
            // Delete behavior definition - using types from adt-clients
            const deleteConfig = {
                name: bdefName,
                ...(transport_request && { transportRequest: transport_request }),
            };
            const deleteState = await client
                .getBehaviorDefinition()
                .delete(deleteConfig);
            const deleteResult = deleteState.deleteResult;
            if (!deleteResult) {
                throw new Error(`Delete did not return a response for behavior definition ${bdefName}`);
            }
            logger?.info(`✅ DeleteBehaviorDefinition completed successfully: ${bdefName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    name: bdefName,
                    transport_request: transport_request || null,
                    message: `BehaviorDefinition ${bdefName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting behavior definition ${bdefName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `BehaviorDefinition ${bdefName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `BehaviorDefinition ${bdefName} is locked by another user. Cannot delete.`;
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