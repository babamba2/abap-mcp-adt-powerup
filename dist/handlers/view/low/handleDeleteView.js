"use strict";
/**
 * DeleteView Handler - Delete ABAP View
 *
 * Uses AdtClient.deleteView from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteView = handleDeleteView;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteViewLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Delete an ABAP view from the SAP system via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., Z_MY_PROGRAM).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['view_name'],
    },
};
/**
 * Main handler for DeleteView MCP tool
 *
 * Uses AdtClient.deleteView - low-level single method call
 */
async function handleDeleteView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, transport_request } = args;
        // Validation
        if (!view_name) {
            return (0, utils_1.return_error)(new Error('view_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const viewName = view_name.toUpperCase();
        logger?.info(`Starting view deletion: ${viewName}`);
        try {
            // Delete view
            const deleteState = await client.getView().delete({
                viewName: viewName,
                transportRequest: transport_request,
            });
            const deleteResult = deleteState.deleteResult;
            if (!deleteResult) {
                throw new Error(`Delete did not return a response for view ${viewName}`);
            }
            logger?.info(`✅ DeleteView completed successfully: ${viewName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    view_name: viewName,
                    transport_request: transport_request || null,
                    message: `View ${viewName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting view ${viewName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete view: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `View ${viewName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `View ${viewName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteView.js.map