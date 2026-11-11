"use strict";
/**
 * CreateTable Handler - ABAP Table Creation via ADT API
 *
 * Workflow: validate -> create (object in initial state)
 * DDL code is set via UpdateTable handler.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateTable = handleCreateTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
const handleCreateTableEcc_1 = require("./handleCreateTableEcc");
exports.TOOL_DEFINITION = {
    name: 'CreateTable',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP table. S/4HANA: creates the table object in initial state via ADT; use UpdateTable to set DDL code afterwards. ECC (SAP_VERSION=ECC): pass "fields" (+ optional "includes") and the table is created and activated in one call through ZMCP_ADT_DDIC_TABL (needs the ECC DDIC FMs from setup and SAP_RFC_BACKEND=odata).',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., ZZ_TEST_TABLE_001). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'Table description for validation and creation.',
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
                description: 'ECC only (SAP_VERSION=ECC): the full field list. ECC has no DDL source, so the table is created from these rows (DD03P) in one call and activated. First field must be a key (MANDT for client tables). Ignored on S/4HANA — use UpdateTable with DDL there.',
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Field name (max 16 characters)',
                        },
                        key: { type: 'boolean', description: 'Key field (keys first)' },
                        not_null: {
                            type: 'boolean',
                            description: 'Initial values flag (keys always set)',
                        },
                        data_element: {
                            type: 'string',
                            description: 'Data element (preferred)',
                        },
                        data_type: {
                            type: 'string',
                            description: 'Built-in type (CHAR, NUMC, DATS, QUAN, …) when no data element fits',
                        },
                        length: { type: 'number' },
                        decimals: { type: 'number' },
                        description: {
                            type: 'string',
                            description: 'Short text for data_type fields',
                        },
                        reference_table: {
                            type: 'string',
                            description: 'Reference table for a QUAN / CURR field (defaults to this table)',
                        },
                        reference_field: {
                            type: 'string',
                            description: 'Reference field (unit / currency key) for a QUAN / CURR field, e.g. VRKME',
                        },
                    },
                    required: ['name'],
                },
            },
            includes: {
                type: 'array',
                description: 'ECC only. Structures appended as .INCLUDE rows after the fields (e.g. a create/change info structure).',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Include structure name' },
                    },
                    required: ['name'],
                },
            },
            delivery_class: {
                type: 'string',
                description: 'ECC only. Delivery class (default A).',
            },
            enhancement_category: {
                type: 'string',
                description: 'ECC only. EXCLASS: 1 cannot be enhanced, 2 character-like, 3 character-like or numeric, 4 deep. Default 4 when "includes" are given, else 1.',
            },
            data_class: {
                type: 'string',
                description: 'ECC only. Data class TABART (default APPL1). Some systems enforce a customer class (e.g. USER / USER1) — the SAP message says so.',
            },
            size_category: {
                type: 'string',
                description: 'ECC only. Size category TABKAT (default 0).',
            },
            activate: {
                type: 'boolean',
                description: 'ECC only. Activate after create (default true).',
            },
        },
        required: ['table_name', 'package_name'],
    },
};
/**
 * Main handler for CreateTable MCP tool
 */
async function handleCreateTable(context, args) {
    const { connection, logger } = context;
    try {
        const createTableArgs = args;
        // Validate required parameters
        if (!createTableArgs?.table_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Table name is required');
        }
        if (!createTableArgs?.package_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Package name is required');
        }
        // Validate transport_request: required for non-$TMP packages
        (0, transportValidation_js_1.validateTransportRequest)(createTableArgs.package_name, createTableArgs.transport_request);
        const tableName = createTableArgs.table_name.toUpperCase();
        // ECC: no ADT DDIC endpoint and no DDL source. The table is built
        // from the `fields` list as DD02V/DD03P/DD09L rows and written by
        // ZMCP_ADT_DDIC_TABL (OData DdicTabl), then activated.
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            return await (0, handleCreateTableEcc_1.handleCreateTableEcc)(context, createTableArgs);
        }
        logger?.info(`Starting table creation: ${tableName}`);
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            // Validate
            await client.getTable().validate({
                tableName,
                packageName: createTableArgs.package_name,
                description: createTableArgs.description || tableName,
            });
            // Create
            await client.getTable().create({
                tableName,
                packageName: createTableArgs.package_name,
                description: createTableArgs.description || tableName,
                ddlCode: '',
                transportRequest: createTableArgs.transport_request,
            });
            logger?.info(`Table created: ${tableName}`);
            // Replace SAP backend's auto-generated CDS-style skeleton (`key client : abap.clnt`)
            // with the correct transparent-table skeleton using the MANDT data element.
            // Without this follow-up, first-time users hit `ExceptionResourceAlreadyExists`
            // (SBD_MESSAGES/007) on UpdateTable when their DDL uses `mandt : mandt` —
            // the normal transparent-table pattern used by every standard SAP table
            // (MARA, T001, VBAK, …). CDS views use `abap.clnt`; transparent tables don't.
            const labelText = (createTableArgs.description || tableName).replace(/'/g, "''");
            const defaultDdl = `@EndUserText.label : '${labelText}'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table ${tableName.toLowerCase()} {
  key mandt : mandt not null;
}`;
            let skeletonApplied = false;
            try {
                const lockHandle = await client.getTable().lock({ tableName });
                try {
                    await client.getTable().update({
                        tableName,
                        ddlCode: defaultDdl,
                        transportRequest: createTableArgs.transport_request,
                    }, { lockHandle });
                    skeletonApplied = true;
                    logger?.info(`[CreateTable] Applied MANDT-based transparent-table skeleton: ${tableName}`);
                }
                finally {
                    try {
                        await client.getTable().unlock({ tableName }, lockHandle);
                    }
                    catch (unlockError) {
                        logger?.warn(`[CreateTable] Failed to unlock ${tableName} after skeleton apply: ${unlockError?.message || unlockError}`);
                    }
                }
            }
            catch (skelError) {
                // Non-fatal: the table exists and works; user's UpdateTable must then
                // preserve SAP's default `client : abap.clnt` skeleton instead.
                logger?.warn(`[CreateTable] Failed to apply MANDT skeleton for ${tableName} — leaving SAP default (abap.clnt). UpdateTable DDL must use 'key client : abap.clnt not null' + '#RESTRICTED' + '#NOT_EXTENSIBLE'. Error: ${skelError?.message || skelError}`);
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    package_name: createTableArgs.package_name,
                    transport_request: createTableArgs.transport_request || 'local',
                    skeleton: skeletonApplied ? 'mandt' : 'client-fallback',
                    message: skeletonApplied
                        ? `Table ${tableName} created with MANDT skeleton. Use UpdateTable to add fields (preserve #NOT_EXTENSIBLE, #RESTRICTED, and 'key mandt : mandt not null').`
                        : `Table ${tableName} created (MANDT skeleton apply FAILED — SAP default 'key client : abap.clnt' applies). Use UpdateTable carefully preserving the CDS-style skeleton.`,
                }),
            });
        }
        catch (error) {
            logger?.error(`Error creating table ${tableName}: ${error?.message || error}`);
            // Check if table already exists
            if (error.message?.includes('already exists') ||
                error.response?.status === 409) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Table ${tableName} already exists. Please delete it first or use a different name.`);
            }
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create table ${tableName}: ${errorMessage}`);
        }
    }
    catch (error) {
        if (error instanceof utils_1.McpError) {
            throw error;
        }
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateTable.js.map