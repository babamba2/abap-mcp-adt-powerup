"use strict";
/**
 * DeleteFunctionGroup Handler - Delete ABAP FunctionGroup via AdtClient
 *
 * Uses AdtClient.getFunctionGroup().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteFunctionGroup = handleDeleteFunctionGroup;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteFunctionGroup',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Delete an ABAP function group from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            function_group_name: {
                type: 'string',
                description: 'FunctionGroup name (e.g., Z_MY_FUNCTIONGROUP).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['function_group_name'],
    },
};
/**
 * Main handler for DeleteFunctionGroup MCP tool
 *
 * Uses AdtClient.getFunctionGroup().delete() - high-level delete operation with deletion check
 */
async function handleDeleteFunctionGroup(context, args) {
    const { connection, logger } = context;
    try {
        const { function_group_name, transport_request } = args;
        // Validation
        if (!function_group_name) {
            return (0, utils_1.return_error)(new Error('function_group_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const functionGroupName = function_group_name.toUpperCase();
        logger?.info(`Starting function group deletion: ${functionGroupName}`);
        try {
            // Delete function group using AdtClient (includes deletion check)
            const functionGroupObject = client.getFunctionGroup();
            const deleteResult = await functionGroupObject.delete({
                functionGroupName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for function group ${functionGroupName}`);
            }
            logger?.info(`✅ DeleteFunctionGroup completed successfully: ${functionGroupName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    function_group_name: functionGroupName,
                    transport_request: transport_request || null,
                    message: `FunctionGroup ${functionGroupName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting function group ${functionGroupName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete function group: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `FunctionGroup ${functionGroupName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `FunctionGroup ${functionGroupName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteFunctionGroup.js.map