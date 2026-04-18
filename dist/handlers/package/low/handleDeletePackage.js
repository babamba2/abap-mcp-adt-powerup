"use strict";
/**
 * DeletePackage Handler - Delete ABAP Package
 *
 * Uses AdtClient.deletePackage from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeletePackage = handleDeletePackage;
const mcp_abap_connection_1 = require("@babamba2/mcp-abap-connection");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeletePackageLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Delete an ABAP package from the SAP system via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name (e.g., Z_MY_PROGRAM).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
            force_new_connection: {
                type: 'boolean',
                description: 'Force creation of a new connection (bypass cache). Useful when package was locked/unlocked and needs to be deleted in a fresh session. Default: false.',
            },
            connection_config: {
                type: 'object',
                description: 'Optional SAP connection config to create a fresh connection for deletion. Useful when the existing connection config is unavailable.',
            },
        },
        required: ['package_name'],
    },
};
/**
 * Main handler for DeletePackage MCP tool
 *
 * Uses AdtClient.deletePackage - low-level single method call
 */
async function handleDeletePackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, transport_request, force_new_connection = false, connection_config, } = args;
        // Validation
        if (!package_name) {
            return (0, utils_1.return_error)(new Error('package_name is required'));
        }
        const packageName = package_name.toUpperCase();
        let deleteConnection = connection;
        if (force_new_connection) {
            const connectionConfig = connection_config ||
                connection.getConfig?.() ||
                connection.config;
            if (!connectionConfig) {
                logger?.warn(`DeletePackage requested fresh connection, but connection config is unavailable; falling back to existing connection for ${packageName}`);
            }
            else {
                try {
                    deleteConnection = (0, mcp_abap_connection_1.createAbapConnection)(connectionConfig, logger || null);
                    // RFC connections require explicit connect() — createAbapConnection does not connect automatically
                    const deleteConnectionAny = deleteConnection;
                    if (typeof deleteConnectionAny.connect === 'function') {
                        await deleteConnectionAny.connect();
                    }
                    logger?.info(`DeletePackage using fresh connection for ${packageName} (force_new_connection=true)`);
                }
                catch (createError) {
                    logger?.warn(`DeletePackage failed to create fresh connection for ${packageName}, falling back to existing connection: ${createError?.message || createError}`);
                    deleteConnection = connection;
                }
            }
        }
        const client = (0, clients_1.createAdtClient)(deleteConnection);
        logger?.info(`Starting package deletion: ${packageName}`);
        try {
            // Delete package
            const deleteState = await client.getPackage().delete({
                packageName: packageName,
                transportRequest: transport_request,
            });
            const deleteResult = deleteState.deleteResult;
            if (!deleteResult) {
                throw new Error(`Delete did not return a response for package ${packageName}`);
            }
            logger?.info(`✅ DeletePackage completed successfully: ${packageName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    package_name: packageName,
                    transport_request: transport_request || null,
                    message: `Package ${packageName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete package: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Package ${packageName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Package ${packageName} is locked by another user. Cannot delete.`;
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
//# sourceMappingURL=handleDeletePackage.js.map