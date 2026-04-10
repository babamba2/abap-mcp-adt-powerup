"use strict";
/**
 * DeleteMetadataExtension Handler - Delete ABAP MetadataExtension via AdtClient
 *
 * Uses AdtClient.getMetadataExtension().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteMetadataExtension = handleDeleteMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteMetadataExtension',
    available_in: ['onprem', 'cloud'],
    description: 'Delete an ABAP metadata extension from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            metadata_extension_name: {
                type: 'string',
                description: 'MetadataExtension name (e.g., Z_MY_METADATAEXTENSION).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['metadata_extension_name'],
    },
};
/**
 * Main handler for DeleteMetadataExtension MCP tool
 *
 * Uses AdtClient.getMetadataExtension().delete() - high-level delete operation with deletion check
 */
async function handleDeleteMetadataExtension(context, args) {
    const { connection, logger } = context;
    try {
        const { metadata_extension_name, transport_request } = args;
        // Validation
        if (!metadata_extension_name) {
            return (0, utils_1.return_error)(new Error('metadata_extension_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const metadataExtensionName = metadata_extension_name.toUpperCase();
        logger?.info(`Starting metadata extension deletion: ${metadataExtensionName}`);
        try {
            // Delete metadata extension using AdtClient (includes deletion check)
            const metadataExtensionObject = client.getMetadataExtension();
            const deleteResult = await metadataExtensionObject.delete({
                name: metadataExtensionName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for metadata extension ${metadataExtensionName}`);
            }
            logger?.info(`✅ DeleteMetadataExtension completed successfully: ${metadataExtensionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    metadata_extension_name: metadataExtensionName,
                    transport_request: transport_request || null,
                    message: `MetadataExtension ${metadataExtensionName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting metadata extension ${metadataExtensionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete metadata extension: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `MetadataExtension ${metadataExtensionName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `MetadataExtension ${metadataExtensionName} is locked by another user. Cannot delete.`;
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