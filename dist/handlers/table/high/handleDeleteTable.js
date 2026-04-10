"use strict";
/**
 * DeleteTable Handler - Delete ABAP Table via AdtClient
 *
 * Uses AdtClient.getTable().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteTable = handleDeleteTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteTable',
    available_in: ['onprem', 'cloud'],
    description: 'Delete an ABAP table from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., Z_MY_TABLE).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['table_name'],
    },
};
/**
 * Main handler for DeleteTable MCP tool
 *
 * Uses AdtClient.getTable().delete() - high-level delete operation with deletion check
 */
async function handleDeleteTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, transport_request } = args;
        // Validation
        if (!table_name) {
            return (0, utils_1.return_error)(new Error('table_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table deletion: ${tableName}`);
        try {
            // Delete table using AdtClient (includes deletion check)
            const tableObject = client.getTable();
            const deleteResult = await tableObject.delete({
                tableName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for table ${tableName}`);
            }
            logger?.info(`✅ DeleteTable completed successfully: ${tableName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    transport_request: transport_request || null,
                    message: `Table ${tableName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting table ${tableName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete table: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Table ${tableName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Table ${tableName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteTable.js.map