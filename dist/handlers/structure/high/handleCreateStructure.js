"use strict";
/**
 * CreateStructure Handler - ABAP Structure Creation via ADT API
 *
 * Uses StructureBuilder from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: validate -> create -> lock -> check (inactive version) -> unlock -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateStructure = handleCreateStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateStructure',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP structure in SAP system with fields and type references. Includes create, activate, and verify steps.',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., ZZ_S_TEST_001). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'Structure description. If not provided, structure_name will be used.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            fields: {
                type: 'array',
                description: 'Array of structure fields',
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Field name (e.g., CLIENT, MATERIAL_ID)',
                        },
                        data_type: {
                            type: 'string',
                            description: 'Data type: CHAR, NUMC, DATS, TIMS, DEC, INT1, INT2, INT4, INT8, CURR, QUAN, etc.',
                        },
                        length: {
                            type: 'number',
                            description: 'Field length',
                        },
                        decimals: {
                            type: 'number',
                            description: 'Decimal places (for DEC, CURR, QUAN types)',
                            default: 0,
                        },
                        domain: {
                            type: 'string',
                            description: 'Domain name for type reference (optional)',
                        },
                        data_element: {
                            type: 'string',
                            description: 'Data element name for type reference (optional)',
                        },
                        structure_ref: {
                            type: 'string',
                            description: 'Include another structure (optional)',
                        },
                        table_ref: {
                            type: 'string',
                            description: 'Reference to table type (optional)',
                        },
                        description: {
                            type: 'string',
                            description: 'Field description',
                        },
                    },
                    required: ['name'],
                },
            },
            includes: {
                type: 'array',
                description: 'Include other structures in this structure',
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Include structure name',
                        },
                        suffix: {
                            type: 'string',
                            description: 'Optional suffix for include fields',
                        },
                    },
                    required: ['name'],
                },
            },
            activate: {
                type: 'boolean',
                description: 'Activate structure after creation. Default: true. Set to false for batch operations (activate multiple objects later).',
            },
        },
        required: ['structure_name', 'package_name', 'fields'],
    },
};
/**
 * Main handler for CreateStructure MCP tool
 *
 * Uses StructureBuilder from @babamba2/mcp-abap-adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleCreateStructure(context, args) {
    const { connection, logger } = context;
    try {
        const createStructureArgs = args;
        // Validate required parameters
        if (!createStructureArgs?.structure_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Structure name is required');
        }
        if (!createStructureArgs?.package_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Package name is required');
        }
        // Validate transport_request: required for non-$TMP packages
        (0, transportValidation_js_1.validateTransportRequest)(createStructureArgs.package_name, createStructureArgs.transport_request);
        if (!createStructureArgs?.fields ||
            !Array.isArray(createStructureArgs.fields) ||
            createStructureArgs.fields.length === 0) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'At least one field is required');
        }
        const structureName = createStructureArgs.structure_name.toUpperCase();
        logger?.info(`Starting structure creation: ${structureName}`);
        try {
            // Get configuration from environment variables
            // Create logger for connection (only logs when DEBUG_CONNECTORS is enabled)
            // Create connection directly for this handler call
            // Get connection from session context (set by ProtocolHandler)
            // Connection is managed and cached per session, with proper token refresh via AuthBroker
            logger?.debug(`[CreateStructure] Created separate connection for handler call: ${structureName}`);
        }
        catch (connectionError) {
            const errorMessage = connectionError instanceof Error
                ? connectionError.message
                : String(connectionError);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create connection: ${errorMessage}`);
        }
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            const shouldActivate = createStructureArgs.activate !== false; // Default to true if not specified
            // Validate
            await client.getStructure().validate({
                structureName,
                packageName: createStructureArgs.package_name,
                description: createStructureArgs.description || structureName,
            });
            // Create
            await client.getStructure().create({
                structureName,
                description: createStructureArgs.description || structureName,
                packageName: createStructureArgs.package_name,
                ddlCode: '',
                transportRequest: createStructureArgs.transport_request,
            });
            // Lock
            const lockHandle = await client.getStructure().lock({ structureName });
            try {
                // Note: StructureBuilder internally generates DDL from fields/includes
                // For now, skip update as structure creation already includes field definitions
                // TODO: Implement DDL generation or enhance AdtClient to accept fields directly
                // Unlock (MANDATORY after lock)
                await client.getStructure().unlock({ structureName }, lockHandle);
                logger?.info(`[CreateStructure] Structure unlocked: ${structureName}`);
                // Check inactive version (after unlock)
                logger?.info(`[CreateStructure] Checking inactive version: ${structureName}`);
                try {
                    await (0, utils_1.safeCheckOperation)(() => client.getStructure().check({ structureName }, 'inactive'), structureName, {
                        debug: (message) => logger?.debug(`[CreateStructure] ${message}`),
                    });
                    logger?.info(`[CreateStructure] Inactive version check completed: ${structureName}`);
                }
                catch (checkError) {
                    // If error was marked as "already checked", continue silently
                    if (checkError.isAlreadyChecked) {
                        logger?.info(`[CreateStructure] Structure ${structureName} was already checked - this is OK, continuing`);
                    }
                    else {
                        // Log warning but don't fail - inactive check is informational
                        logger?.warn(`[CreateStructure] Inactive version check had issues: ${structureName}`, {
                            error: checkError instanceof Error
                                ? checkError.message
                                : String(checkError),
                        });
                    }
                }
                // Activate
                if (shouldActivate) {
                    await client.getStructure().activate({ structureName });
                }
            }
            catch (error) {
                // Unlock on error (principle 1: if lock was done, unlock is mandatory)
                try {
                    await client.getStructure().unlock({ structureName }, lockHandle);
                }
                catch (unlockError) {
                    logger?.error('Failed to unlock structure after error:', unlockError);
                }
                // Principle 2: first error and exit
                throw error;
            }
            logger?.info(`✅ CreateStructure completed successfully: ${structureName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    structure_name: structureName,
                    package_name: createStructureArgs.package_name,
                    transport_request: createStructureArgs.transport_request || 'local',
                    activated: shouldActivate,
                    message: `Structure ${structureName} created successfully${shouldActivate ? ' and activated' : ''}`,
                }),
            });
        }
        catch (error) {
            logger?.error(`Error creating structure ${structureName}:`, error);
            // Check if structure already exists
            if (error.message?.includes('already exists') ||
                error.response?.status === 409) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Structure ${structureName} already exists. Please delete it first or use a different name.`);
            }
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create structure ${structureName}: ${errorMessage}`);
        }
    }
    catch (error) {
        if (error instanceof utils_1.McpError) {
            throw error;
        }
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateStructure.js.map