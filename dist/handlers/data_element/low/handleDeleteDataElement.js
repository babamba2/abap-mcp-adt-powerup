"use strict";
/**
 * DeleteDataElement Handler - Delete ABAP DataElement
 *
 * Uses AdtClient.deleteDataElement from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteDataElement = handleDeleteDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Delete an ABAP data element from the SAP system via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'DataElement name (e.g., Z_MY_PROGRAM).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['data_element_name'],
    },
};
/**
 * Main handler for DeleteDataElement MCP tool
 *
 * Uses AdtClient.deleteDataElement - low-level single method call
 */
async function handleDeleteDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, transport_request } = args;
        // Validation
        if (!data_element_name) {
            return (0, utils_1.return_error)(new Error('data_element_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const dataElementName = data_element_name.toUpperCase();
        logger?.info(`Starting data element deletion: ${dataElementName}`);
        try {
            // Delete data element
            const deleteState = await client.getDataElement().delete({
                dataElementName: dataElementName,
                transportRequest: transport_request,
            });
            const deleteResult = deleteState.deleteResult;
            if (!deleteResult) {
                throw new Error(`Delete did not return a response for data element ${dataElementName}`);
            }
            logger?.info(`✅ DeleteDataElement completed successfully: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    transport_request: transport_request || null,
                    message: `DataElement ${dataElementName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `DataElement ${dataElementName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `DataElement ${dataElementName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteDataElement.js.map