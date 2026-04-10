"use strict";
/**
 * DeleteDomain Handler - Delete ABAP Domain
 *
 * Uses AdtClient.deleteDomain from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteDomain = handleDeleteDomain;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteDomainLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Delete an ABAP domain from the SAP system via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name (e.g., Z_MY_PROGRAM).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['domain_name'],
    },
};
/**
 * Main handler for DeleteDomain MCP tool
 *
 * Uses AdtClient.deleteDomain - low-level single method call
 */
async function handleDeleteDomain(context, args) {
    const { connection, logger } = context;
    try {
        const { domain_name, transport_request } = args;
        // Validation
        if (!domain_name) {
            return (0, utils_1.return_error)(new Error('domain_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const domainName = domain_name.toUpperCase();
        logger?.info(`Starting domain deletion: ${domainName}`);
        try {
            // Delete domain
            const deleteState = await client.getDomain().delete({
                domainName: domainName,
                transportRequest: transport_request,
            });
            const deleteResult = deleteState.deleteResult;
            if (!deleteResult) {
                throw new Error(`Delete did not return a response for domain ${domainName}`);
            }
            logger?.info(`✅ DeleteDomain completed successfully: ${domainName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    domain_name: domainName,
                    transport_request: transport_request || null,
                    message: `Domain ${domainName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting domain ${domainName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete domain: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Domain ${domainName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Domain ${domainName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeleteDomain.js.map