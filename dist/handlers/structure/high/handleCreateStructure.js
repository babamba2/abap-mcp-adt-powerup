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
exports.buildEccStructurePayload = buildEccStructurePayload;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
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
                description: 'Transport request. Required for transportable packages.',
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
                        reference_table: {
                            type: 'string',
                            description: 'Reference table for a CURR / QUAN field (ECC path; defaults to this structure when reference_field is set).',
                        },
                        reference_field: {
                            type: 'string',
                            description: 'Reference field (currency key / unit) for a CURR / QUAN field (ECC path), e.g. WAERS.',
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
        // ECC fallback: ADT on BASIS < 7.50 has no /sap/bc/adt/ddic/structures.
        // A structure is a DD02V row with TABCLASS=INTTAB plus DD03P rows, so
        // it goes through the same ZMCP_ADT_DDIC_TABL FM as tables
        // (DDIF_TABL_PUT), then ZMCP_ADT_DDIC_ACTIVATE type TABL.
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            return await handleCreateStructureEcc(context, createStructureArgs, structureName);
        }
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
/** Default DDIC lengths of built-in types that need no explicit length. */
const ECC_FIXED_LENGTHS = {
    DATS: 8,
    TIMS: 6,
    INT1: 3,
    INT2: 5,
    INT4: 10,
    INT8: 19,
    CLNT: 3,
    LANG: 1,
};
/**
 * Builds the DD02V + DD03P payload for ZMCP_ADT_DDIC_TABL (ECC).
 * Exported for unit tests.
 */
function buildEccStructurePayload(args, structureName) {
    if (args.includes && args.includes.length > 0) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'CreateStructure on ECC does not support "includes" yet. List the fields explicitly or type a field with structure_ref.');
    }
    const pad4 = (n) => String(n).padStart(4, '0');
    const pad6 = (n) => String(n).padStart(6, '0');
    const dd02v = {
        TABNAME: structureName,
        DDLANGUAGE: 'E',
        TABCLASS: 'INTTAB',
        DDTEXT: args.description || structureName,
        MASTERLANG: 'E',
        EXCLASS: '1',
    };
    const dd03p = args.fields.map((field, index) => {
        const fieldName = field.name.toUpperCase();
        const row = {
            TABNAME: structureName,
            FIELDNAME: fieldName,
            POSITION: pad4(index + 1),
            DDLANGUAGE: 'E',
        };
        if (field.data_element) {
            row.ROLLNAME = field.data_element.toUpperCase();
            row.COMPTYPE = 'E';
        }
        else if (field.structure_ref) {
            row.ROLLNAME = field.structure_ref.toUpperCase();
            row.COMPTYPE = 'S';
        }
        else if (field.table_ref) {
            row.ROLLNAME = field.table_ref.toUpperCase();
            row.COMPTYPE = 'L';
        }
        else if (field.data_type) {
            const dataType = field.data_type.toUpperCase();
            const length = field.length ?? ECC_FIXED_LENGTHS[dataType];
            if (!length) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Field ${fieldName}: data_type ${dataType} needs a length.`);
            }
            row.DATATYPE = dataType;
            row.LENG = pad6(length);
            row.DECIMALS = pad6(field.decimals ?? 0);
            if (field.description)
                row.DDTEXT = field.description;
        }
        else if (field.domain) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Field ${fieldName}: a structure component cannot be typed with a domain (${field.domain}). Use its data element or data_type + length.`);
        }
        else {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Field ${fieldName}: give data_element, structure_ref, table_ref or data_type.`);
        }
        if (field.reference_field) {
            row.REFTABLE = (field.reference_table || structureName).toUpperCase();
            row.REFFIELD = field.reference_field.toUpperCase();
        }
        return row;
    });
    return { dd02v, dd03p };
}
/**
 * ECC fallback path for CreateStructure (SAP_VERSION=ECC).
 * Same return shape as the ADT path, plus `path: 'ecc-odata-rfc'`.
 */
async function handleCreateStructureEcc(context, args, structureName) {
    const { connection, logger } = context;
    const shouldActivate = args.activate !== false;
    const payload_json = JSON.stringify(buildEccStructurePayload(args, structureName));
    try {
        logger?.info(`ECC: creating structure ${structureName} via ZMCP_ADT_DDIC_TABL`);
        const putRes = await (0, rfcBackend_1.callDdicTabl)(connection, 'CREATE', {
            name: structureName,
            devclass: args.package_name,
            transport: args.transport_request,
            payload_json,
        });
        logger?.debug(`DdicTabl CREATE → ${putRes.message}`);
        let activationRc = 0;
        let activationMessage = '';
        if (shouldActivate) {
            const actRes = await (0, rfcBackend_1.callDdicActivate)(connection, 'TABL', structureName);
            activationRc = actRes.subrc;
            activationMessage = actRes.message;
            logger?.debug(`DdicActivate TABL → rc=${actRes.subrc} ${actRes.message}`);
        }
        const warn = activationRc === 4 ? ' with warnings (rc=4)' : '';
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                structure_name: structureName,
                package_name: args.package_name,
                transport_request: args.transport_request || 'local',
                activated: shouldActivate,
                activation_rc: shouldActivate ? activationRc : null,
                activation_message: activationMessage || undefined,
                message: `Structure ${structureName} created${shouldActivate ? ` and activated${warn}` : ' (inactive)'} (ECC fallback via OData)`,
                path: 'ecc-odata-rfc',
            }),
        });
    }
    catch (error) {
        logger?.error(`ECC CreateStructure error for ${structureName}: ${error?.message || error}`);
        throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create structure ${structureName} (ECC fallback): ${error?.message || String(error)}`);
    }
}
//# sourceMappingURL=handleCreateStructure.js.map