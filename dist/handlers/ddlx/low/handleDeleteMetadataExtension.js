"use strict";
/**
 * DeleteMetadataExtension Handler - Delete ABAP MetadataExtension
 *
 * Uses AdtClient.deleteMetadataExtension from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteMetadataExtension = handleDeleteMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteMetadataExtensionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Delete an ABAP metadata extension from the SAP system via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'MetadataExtension name (e.g., ZI_MY_DDLX).',
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
 * Main handler for DeleteMetadataExtension MCP tool
 *
 * Uses AdtClient.deleteMetadataExtension - low-level single method call
 */
async function handleDeleteMetadataExtension(context, args) {
    const { connection, logger } = context;
    try {
        const { name, transport_request } = args;
        // Validation
        if (!name) {
            return (0, utils_1.return_error)(new Error('name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const ddlxName = name.toUpperCase();
        logger?.info(`Starting metadata extension deletion: ${ddlxName}`);
        try {
            // Delete metadata extension
            const deleteState = await client.getMetadataExtension().delete({
                name: ddlxName,
                transportRequest: transport_request,
            });
            const deleteResult = deleteState.deleteResult;
            if (!deleteResult) {
                throw new Error(`Delete did not return a response for metadata extension ${ddlxName}`);
            }
            logger?.info(`✅ DeleteMetadataExtension completed successfully: ${ddlxName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    ddlxName: ddlxName,
                    transport_request: transport_request || null,
                    message: `MetadataExtension ${ddlxName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting metadata extension ${ddlxName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete metadata extension: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `MetadataExtension ${ddlxName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `MetadataExtension ${ddlxName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteMetadataExtension.js.map