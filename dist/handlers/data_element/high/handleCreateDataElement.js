"use strict";
/**
 * CreateDataElement Handler - ABAP Data Element Creation via ADT API
 *
 * Uses DataElementBuilder from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: create -> activate -> verify
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateDataElement = handleCreateDataElement;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateDataElement',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP data element in SAP system with all required steps: create, activate, and verify.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'Data element name (e.g., ZZ_E_TEST_001). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'Data element description. If not provided, data_element_name will be used.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            data_type: {
                type: 'string',
                description: "Data type (e.g., CHAR, NUMC) or domain name when type_kind is 'domain'.",
                default: 'CHAR',
            },
            length: {
                type: 'number',
                description: 'Data type length. Usually inherited from domain.',
                default: 100,
            },
            decimals: {
                type: 'number',
                description: 'Decimal places. Usually inherited from domain.',
                default: 0,
            },
            short_label: {
                type: 'string',
                description: 'Short field label (max 10 chars). Applied during update step after creation.',
            },
            medium_label: {
                type: 'string',
                description: 'Medium field label (max 20 chars). Applied during update step after creation.',
            },
            long_label: {
                type: 'string',
                description: 'Long field label (max 40 chars). Applied during update step after creation.',
            },
            heading_label: {
                type: 'string',
                description: 'Heading field label (max 55 chars). Applied during update step after creation.',
            },
            type_kind: {
                type: 'string',
                description: "Type kind: 'domain' (default), 'predefinedAbapType', 'refToPredefinedAbapType', 'refToDictionaryType', 'refToClifType'. If not specified, defaults to 'domain'.",
                enum: [
                    'domain',
                    'predefinedAbapType',
                    'refToPredefinedAbapType',
                    'refToDictionaryType',
                    'refToClifType',
                ],
                default: 'domain',
            },
            type_name: {
                type: 'string',
                description: "Type name: domain name (when type_kind is 'domain'), data element name (when type_kind is 'refToDictionaryType'), or class name (when type_kind is 'refToClifType')",
            },
            search_help: {
                type: 'string',
                description: 'Search help name. Applied during update step after creation.',
            },
            search_help_parameter: {
                type: 'string',
                description: 'Search help parameter. Applied during update step after creation.',
            },
            set_get_parameter: {
                type: 'string',
                description: 'Set/Get parameter ID. Applied during update step after creation.',
            },
        },
        required: ['data_element_name', 'package_name'],
    },
};
/**
 * Main handler for CreateDataElement MCP tool
 *
 * Uses DataElementBuilder from @babamba2/mcp-abap-adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleCreateDataElement(context, args) {
    const { connection, logger } = context;
    try {
        // Validate required parameters
        if (!args?.data_element_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Data element name is required');
        }
        if (!args?.package_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Package name is required');
        }
        // Validate transport_request: required for non-$TMP packages
        (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
        const typedArgs = args;
        const dataElementName = typedArgs.data_element_name.toUpperCase();
        // ECC fallback — ADT /sap/bc/adt/ddic/dataelements is absent on
        // BASIS < 7.50. Route through ZMCP_ADT_DDIC_DTEL OData FI.
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            return handleCreateDataElementEcc(context, typedArgs, dataElementName);
        }
        logger?.info(`Starting data element creation: ${dataElementName}`);
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const shouldActivate = typedArgs.activate !== false;
        const typeKind = typedArgs.type_kind || 'domain';
        let lockHandle;
        try {
            // Validate
            await client.getDataElement().validate({
                dataElementName,
                packageName: typedArgs.package_name,
                description: typedArgs.description || dataElementName,
            });
            // Create (registers bare object in SAP)
            await client.getDataElement().create({
                dataElementName,
                description: typedArgs.description || dataElementName,
                packageName: typedArgs.package_name,
                typeKind: typeKind,
                dataType: typedArgs.data_type,
                typeName: typedArgs.type_name,
                length: typedArgs.length,
                decimals: typedArgs.decimals,
                transportRequest: typedArgs.transport_request,
            });
            // Lock
            lockHandle = await client.getDataElement().lock({ dataElementName });
            // Update with read-modify-write: reads current XML from SAP, patches with properties, PUTs back
            await client.getDataElement().update({
                dataElementName,
                packageName: typedArgs.package_name,
                description: typedArgs.description || dataElementName,
                dataType: typedArgs.data_type || 'CHAR',
                length: typedArgs.length || 100,
                decimals: typedArgs.decimals || 0,
                shortLabel: typedArgs.short_label,
                mediumLabel: typedArgs.medium_label,
                longLabel: typedArgs.long_label,
                headingLabel: typedArgs.heading_label,
                typeKind: typeKind,
                typeName: typedArgs.type_name,
                searchHelp: typedArgs.search_help,
                searchHelpParameter: typedArgs.search_help_parameter,
                setGetParameter: typedArgs.set_get_parameter,
                transportRequest: typedArgs.transport_request,
            }, { lockHandle });
            // Unlock
            await client.getDataElement().unlock({ dataElementName }, lockHandle);
            lockHandle = undefined;
            // Check
            try {
                await (0, utils_1.safeCheckOperation)(() => client.getDataElement().check({ dataElementName }), dataElementName, {
                    debug: (message) => logger?.debug(message),
                });
            }
            catch (checkError) {
                if (!checkError.isAlreadyChecked) {
                    throw checkError;
                }
            }
            // Activate if requested
            if (shouldActivate) {
                await client.getDataElement().activate({ dataElementName });
            }
            logger?.info(`✅ CreateDataElement completed: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    package: typedArgs.package_name,
                    transport_request: typedArgs.transport_request,
                    data_type: typedArgs.data_type || null,
                    status: shouldActivate ? 'active' : 'inactive',
                    message: `Data element ${dataElementName} created${shouldActivate ? ' and activated' : ''} successfully`,
                }, null, 2),
            });
        }
        catch (error) {
            if (lockHandle) {
                try {
                    await client.getDataElement().unlock({ dataElementName }, lockHandle);
                }
                catch (_unlockError) {
                    // Ignore unlock errors during cleanup
                }
            }
            logger?.error(`Error creating data element ${dataElementName}: ${error?.message || error}`);
            if (error.message?.includes('already exists') ||
                error.response?.data?.includes('ExceptionResourceAlreadyExists')) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Data element ${dataElementName} already exists. Please delete it first or use a different name.`);
            }
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : String(error.response.data).substring(0, 500)
                : error.message || String(error);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create data element ${dataElementName}: ${errorMessage}`);
        }
    }
    catch (error) {
        if (error instanceof utils_1.McpError) {
            throw error;
        }
        return (0, utils_1.return_error)(error);
    }
}
/**
 * ECC fallback for CreateDataElement.
 *
 * Supports type_kind='domain' (most common). Other type_kinds fall back
 * to an error until we need them — the ECC RFC FM could be extended to
 * cover them later by exposing more DD04V fields.
 */
async function handleCreateDataElementEcc(context, args, dataElementName) {
    const { connection, logger } = context;
    const shouldActivate = args.activate !== false;
    const typeKind = args.type_kind || 'domain';
    if (typeKind !== 'domain') {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `ECC CreateDataElement fallback currently supports only type_kind='domain' (got '${typeKind}'). ` +
            `Extend ZMCP_ADT_DDIC_DTEL FM if you need predefinedAbapType / refTo* support.`);
    }
    if (!args.type_name) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `ECC CreateDataElement (type_kind='domain') requires type_name = domain name`);
    }
    const domName = args.type_name.toUpperCase();
    const dd04v = {
        ROLLNAME: dataElementName,
        DDLANGUAGE: 'E',
        DOMNAME: domName,
        HEADLEN: '55',
        SCRLEN1: '10',
        SCRLEN2: '20',
        SCRLEN3: '40',
        DDTEXT: args.description || dataElementName,
        REPTEXT: args.medium_label || args.description || dataElementName,
        SCRTEXT_S: args.short_label || dataElementName.substring(0, 10),
        SCRTEXT_M: args.medium_label || args.description || dataElementName,
        SCRTEXT_L: args.long_label || args.description || dataElementName,
    };
    if (args.heading_label) {
        dd04v.REPTEXT = args.heading_label;
    }
    const payload_json = JSON.stringify({ dd04v });
    try {
        logger?.info(`ECC: creating data element ${dataElementName} via ZMCP_ADT_DDIC_DTEL`);
        await (0, rfcBackend_1.callDdicDtel)(connection, 'CREATE', {
            name: dataElementName,
            devclass: args.package_name,
            transport: args.transport_request,
            payload_json,
        });
        if (shouldActivate) {
            await (0, rfcBackend_1.callDdicActivate)(connection, 'DTEL', dataElementName);
        }
        logger?.info(`✅ CreateDataElement (ECC) completed: ${dataElementName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                data_element_name: dataElementName,
                package: args.package_name,
                transport_request: args.transport_request,
                data_type: args.data_type || null,
                status: shouldActivate ? 'active' : 'inactive',
                message: `Data element ${dataElementName} created${shouldActivate ? ' and activated' : ''} successfully (ECC fallback via OData)`,
                path: 'ecc-odata-rfc',
            }, null, 2),
        });
    }
    catch (error) {
        logger?.error(`ECC CreateDataElement error for ${dataElementName}: ${error?.message || error}`);
        throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create data element ${dataElementName} (ECC fallback): ${error?.message || String(error)}`);
    }
}
//# sourceMappingURL=handleCreateDataElement.js.map