"use strict";
/**
 * UpdateDataElement Handler - Update Existing ABAP Data Element
 *
 * Uses DataElementBuilder from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: lock -> update -> check -> unlock -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateDataElement = handleUpdateDataElement;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'UpdateDataElement',
    available_in: ['onprem', 'cloud'],
    description: `Update an existing ABAP data element in SAP system.

Workflow:
1. Gets domain info (if type_kind is 'domain') to extract dataType/length/decimals
2. Acquires lock on the data element
3. Updates data element with provided parameters (complete replacement)
4. Unlocks data element
5. Optionally activates data element (default: true)
6. Returns updated data element details

Supported type_kind values:
- domain: Based on ABAP domain (requires type_name = domain name)
- predefinedAbapType: Direct ABAP type (requires data_type, length, decimals)
- refToPredefinedAbapType: Reference to ABAP type (requires data_type, length, decimals)
- refToDictionaryType: Reference to another data element (requires type_name = data element name)
- refToClifType: Reference to class (requires type_name = class name)

Note: All provided parameters completely replace existing values. Field labels are truncated to max lengths (10/20/40/55).`,
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'Data element name to update (e.g., ZZ_TEST_DTEL_01)',
            },
            description: {
                type: 'string',
                description: 'New data element description',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            type_kind: {
                type: 'string',
                description: 'Type kind: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType',
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
                description: 'Type name: domain name, data element name, or class name (depending on type_kind)',
            },
            data_type: {
                type: 'string',
                description: 'Data type (CHAR, NUMC, etc.) - for predefinedAbapType or refToPredefinedAbapType',
            },
            length: {
                type: 'number',
                description: 'Length - for predefinedAbapType or refToPredefinedAbapType',
            },
            decimals: {
                type: 'number',
                description: 'Decimals - for predefinedAbapType or refToPredefinedAbapType',
            },
            field_label_short: {
                type: 'string',
                description: 'Short field label (max 10 chars)',
            },
            field_label_medium: {
                type: 'string',
                description: 'Medium field label (max 20 chars)',
            },
            field_label_long: {
                type: 'string',
                description: 'Long field label (max 40 chars)',
            },
            field_label_heading: {
                type: 'string',
                description: 'Heading field label (max 55 chars)',
            },
            search_help: {
                type: 'string',
                description: 'Search help name',
            },
            search_help_parameter: {
                type: 'string',
                description: 'Search help parameter',
            },
            set_get_parameter: {
                type: 'string',
                description: 'Set/Get parameter ID',
            },
            activate: {
                type: 'boolean',
                description: 'Activate data element after update (default: true)',
                default: true,
            },
        },
        required: ['data_element_name', 'package_name'],
    },
};
/**
 * Main handler for UpdateDataElement tool
 *
 * Uses DataElementBuilder from @babamba2/mcp-abap-adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleUpdateDataElement(context, args) {
    const { connection, logger } = context;
    try {
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
        // ECC fallback — see handleCreateDataElement.
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            return handleUpdateDataElementEcc(context, typedArgs, dataElementName);
        }
        logger?.info(`Starting data element update: ${dataElementName}`);
        try {
            const rawTypeKind = (typedArgs.type_kind || 'domain')
                .toString()
                .toLowerCase();
            const typeKindMap = {
                domain: 'domain',
                builtin: 'predefinedAbapType',
                predefinedabaptype: 'predefinedAbapType',
                reftopredefinedabaptype: 'refToPredefinedAbapType',
                reftodictionarytype: 'refToDictionaryType',
                reftocliftype: 'refToClifType',
            };
            const typeKind = typeKindMap[rawTypeKind] || 'domain';
            // Create client
            const client = (0, clients_1.createAdtClient)(connection, logger);
            const shouldActivate = typedArgs.activate !== false; // Default to true if not specified
            // Validate (for update, "already exists" is expected - object must exist)
            let updateState;
            try {
                await client.getDataElement().validate({
                    dataElementName,
                    packageName: typedArgs.package_name,
                    description: typedArgs.description || dataElementName,
                });
            }
            catch (validateError) {
                // For update operations, "already exists" is expected - object must exist
                if (!(0, utils_1.isAlreadyExistsError)(validateError)) {
                    // Real validation error - rethrow
                    throw validateError;
                }
                // "Already exists" is OK for update - continue
                logger?.info(`Data element ${dataElementName} already exists - this is expected for update operation`);
            }
            // Lock
            let lockHandle;
            try {
                lockHandle = await client
                    .getDataElement()
                    .lock({ dataElementName: dataElementName });
                // Update with properties
                const properties = {
                    dataType: typedArgs.data_type,
                    length: typedArgs.length,
                    decimals: typedArgs.decimals,
                    shortLabel: typedArgs.field_label_short,
                    mediumLabel: typedArgs.field_label_medium,
                    longLabel: typedArgs.field_label_long,
                    headingLabel: typedArgs.field_label_heading,
                    typeKind: typeKind,
                    typeName: typedArgs.type_name?.toUpperCase(),
                    searchHelp: typedArgs.search_help,
                    searchHelpParameter: typedArgs.search_help_parameter,
                    setGetParameter: typedArgs.set_get_parameter,
                };
                updateState = await client.getDataElement().update({
                    dataElementName,
                    packageName: typedArgs.package_name,
                    transportRequest: typedArgs.transport_request,
                    description: typedArgs.description || dataElementName,
                    ...properties,
                }, { lockHandle });
                // Check
                try {
                    await (0, utils_1.safeCheckOperation)(() => client.getDataElement().check({ dataElementName }), dataElementName, {
                        debug: (message) => logger?.debug(message),
                    });
                }
                catch (checkError) {
                    // If error was marked as "already checked", continue silently
                    if (!checkError.isAlreadyChecked) {
                        // Real check error - rethrow
                        throw checkError;
                    }
                }
            }
            finally {
                if (lockHandle) {
                    try {
                        await client
                            .getDataElement()
                            .unlock({ dataElementName }, lockHandle);
                        logger?.info(`Data element unlocked: ${dataElementName}`);
                    }
                    catch (unlockError) {
                        logger?.warn(`Failed to unlock data element ${dataElementName}: ${unlockError?.message || unlockError}`);
                    }
                }
            }
            // Activate if requested
            if (shouldActivate) {
                await client.getDataElement().activate({ dataElementName });
            }
            // Get data element details from update result
            const updateResult = updateState?.updateResult;
            let dataElementDetails = null;
            if (updateResult?.data &&
                typeof updateResult.data === 'object' &&
                'data_element_details' in updateResult.data) {
                dataElementDetails = updateResult.data.data_element_details;
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    package: typedArgs.package_name,
                    transport_request: typedArgs.transport_request,
                    data_type: typedArgs.data_type || null,
                    status: shouldActivate ? 'active' : 'inactive',
                    message: `Data element ${dataElementName} updated${shouldActivate ? ' and activated' : ''} successfully`,
                    data_element_details: dataElementDetails,
                }),
            });
        }
        catch (error) {
            logger?.error(`Error updating data element ${dataElementName}: ${error?.message || error}`);
            // Handle specific error cases
            if (error.message?.includes('not found') ||
                error.response?.status === 404) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Data element ${dataElementName} not found.`);
            }
            if (error.message?.includes('locked') || error.response?.status === 403) {
                throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Data element ${dataElementName} is locked by another user or session. Please try again later.`);
            }
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to update data element ${dataElementName}: ${errorMessage}`);
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
 * ECC fallback for UpdateDataElement. Calls ZMCP_ADT_DDIC_DTEL with
 * action='UPDATE' (DDIF_DTEL_PUT overwrite).
 */
async function handleUpdateDataElementEcc(context, args, dataElementName) {
    const { connection, logger } = context;
    const shouldActivate = args.activate !== false;
    const typeKind = (args.type_kind || 'domain').toString();
    if (typeKind !== 'domain') {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `ECC UpdateDataElement fallback currently supports only type_kind='domain' (got '${typeKind}')`);
    }
    if (!args.type_name) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `ECC UpdateDataElement (type_kind='domain') requires type_name = domain name`);
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
        REPTEXT: args.field_label_heading ||
            args.field_label_medium ||
            args.description ||
            dataElementName,
        SCRTEXT_S: args.field_label_short || dataElementName.substring(0, 10),
        SCRTEXT_M: args.field_label_medium || args.description || dataElementName,
        SCRTEXT_L: args.field_label_long || args.description || dataElementName,
    };
    const payload_json = JSON.stringify({ dd04v });
    try {
        logger?.info(`ECC: updating data element ${dataElementName} via ZMCP_ADT_DDIC_DTEL`);
        await (0, rfcBackend_1.callDdicDtel)(connection, 'UPDATE', {
            name: dataElementName,
            devclass: args.package_name,
            transport: args.transport_request,
            payload_json,
        });
        if (shouldActivate) {
            await (0, rfcBackend_1.callDdicActivate)(connection, 'DTEL', dataElementName);
        }
        logger?.info(`✅ UpdateDataElement (ECC) completed: ${dataElementName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                data_element_name: dataElementName,
                package: args.package_name,
                transport_request: args.transport_request,
                data_type: args.data_type || null,
                status: shouldActivate ? 'active' : 'inactive',
                message: `Data element ${dataElementName} updated${shouldActivate ? ' and activated' : ''} successfully (ECC fallback via OData)`,
                data_element_details: null,
                path: 'ecc-odata-rfc',
            }),
        });
    }
    catch (error) {
        logger?.error(`ECC UpdateDataElement error for ${dataElementName}: ${error?.message || error}`);
        throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to update data element ${dataElementName} (ECC fallback): ${error?.message || String(error)}`);
    }
}
//# sourceMappingURL=handleUpdateDataElement.js.map