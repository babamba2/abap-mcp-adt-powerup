"use strict";
/**
 * UpdateDomain Handler - Update Existing ABAP Domain
 *
 * Uses DomainBuilder from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: lock -> update -> check -> unlock -> (activate)
 * Note: No validation step - lock will fail if domain doesn't exist
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateDomain = handleUpdateDomain;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'UpdateDomain',
    available_in: ['onprem', 'cloud'],
    description: `Update an existing ABAP domain in SAP system.

Workflow:
1. Acquires lock on the domain
2. Updates domain with provided parameters (complete replacement)
3. Performs syntax check
4. Unlocks domain
5. Optionally activates domain (default: true)
6. Returns updated domain details

Note: All provided parameters completely replace existing values. Use GetDomain first to see current values if needed.`,
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name to update (e.g., ZZ_TEST_0001)',
            },
            description: {
                type: 'string',
                description: 'New domain description (optional)',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            datatype: {
                type: 'string',
                description: 'Data type: CHAR, NUMC, DATS, TIMS, DEC, INT1, INT2, INT4, INT8, CURR, QUAN, etc.',
            },
            length: {
                type: 'number',
                description: 'Field length (max depends on datatype)',
            },
            decimals: {
                type: 'number',
                description: 'Decimal places (for DEC, CURR, QUAN types)',
            },
            conversion_exit: {
                type: 'string',
                description: 'Conversion exit routine name (without CONVERSION_EXIT_ prefix)',
            },
            lowercase: {
                type: 'boolean',
                description: 'Allow lowercase input',
            },
            sign_exists: {
                type: 'boolean',
                description: 'Field has sign (+/-)',
            },
            value_table: {
                type: 'string',
                description: 'Value table name for foreign key relationship',
            },
            activate: {
                type: 'boolean',
                description: 'Activate domain after update (default: true)',
                default: true,
            },
            fixed_values: {
                type: 'array',
                description: 'Array of fixed values for domain value range',
                items: {
                    type: 'object',
                    properties: {
                        low: {
                            type: 'string',
                            description: "Fixed value (e.g., '001', 'A')",
                        },
                        text: {
                            type: 'string',
                            description: 'Description text for the fixed value',
                        },
                    },
                    required: ['low', 'text'],
                },
            },
        },
        required: ['domain_name', 'package_name'],
    },
};
/**
 * Main handler for UpdateDomain tool
 *
 * Uses DomainBuilder from @babamba2/mcp-abap-adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleUpdateDomain(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.domain_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Domain name is required');
        }
        if (!args?.package_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Package name is required');
        }
        // Validate transport_request: required for non-$TMP packages
        (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
        const typedArgs = args;
        const domainName = typedArgs.domain_name.toUpperCase();
        // ECC fallback — see handleCreateDomain for rationale.
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            return handleUpdateDomainEcc(context, typedArgs, domainName);
        }
        logger?.info(`Starting domain update: ${domainName}`);
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            const shouldActivate = typedArgs.activate !== false; // Default to true if not specified
            // Lock domain (will fail if domain doesn't exist)
            // Pass packageName to lockDomain so builder is created with correct config from the start
            let lockHandle;
            let updateState;
            try {
                lockHandle = await client.getDomain().lock({
                    domainName,
                    packageName: typedArgs.package_name,
                });
                // Update with properties (packageName and description are required)
                // IMPORTANT: `AdtDomain.update()` reads these 4 fields via snake_case
                // (`config.conversion_exit`, `config.sign_exists`, `config.value_table`,
                // `config.fixed_values`). Passing camelCase caused silent drops.
                const properties = {
                    domainName: domainName,
                    packageName: typedArgs.package_name,
                    description: typedArgs.description || domainName,
                    datatype: typedArgs.datatype,
                    length: typedArgs.length,
                    decimals: typedArgs.decimals,
                    conversion_exit: typedArgs.conversion_exit,
                    lowercase: typedArgs.lowercase,
                    sign_exists: typedArgs.sign_exists,
                    value_table: typedArgs.value_table,
                    fixed_values: typedArgs.fixed_values,
                    transportRequest: typedArgs.transport_request,
                };
                updateState = await client
                    .getDomain()
                    .update(properties, { lockHandle: lockHandle });
                // Check
                try {
                    await (0, utils_1.safeCheckOperation)(() => client.getDomain().check({ domainName }), domainName, {
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
                        await client.getDomain().unlock({ domainName }, lockHandle);
                        logger?.info(`Domain unlocked: ${domainName}`);
                    }
                    catch (unlockError) {
                        logger?.warn(`Failed to unlock domain ${domainName}: ${unlockError?.message || unlockError}`);
                    }
                }
            }
            // Activate if requested
            if (shouldActivate) {
                await client.getDomain().activate({ domainName });
            }
            // Get domain details from update result
            const updateResult = updateState.updateResult;
            let domainDetails = null;
            if (updateResult?.data &&
                typeof updateResult.data === 'object' &&
                'domain_details' in updateResult.data) {
                domainDetails = updateResult.data.domain_details;
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    domain_name: domainName,
                    package: typedArgs.package_name,
                    transport_request: typedArgs.transport_request,
                    status: shouldActivate ? 'active' : 'inactive',
                    message: `Domain ${domainName} updated${shouldActivate ? ' and activated' : ''} successfully`,
                    domain_details: domainDetails,
                }),
            });
        }
        catch (error) {
            logger?.error(`Error updating domain ${domainName}: ${error?.message || error}`);
            // Handle specific error cases
            if (error.message?.includes('not found') ||
                error.response?.status === 404) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Domain ${domainName} not found.`);
            }
            if (error.message?.includes('locked') || error.response?.status === 403) {
                throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Domain ${domainName} is locked by another user or session. Please try again later.`);
            }
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to update domain ${domainName}: ${errorMessage}`);
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
 * ECC fallback for UpdateDomain. Calls ZMCP_ADT_DDIC_DOMA with
 * action='UPDATE' (DDIF_DOMA_PUT treats UPDATE identically to CREATE —
 * it overwrites the inactive version), then optionally activates.
 */
async function handleUpdateDomainEcc(context, args, domainName) {
    const { connection, logger } = context;
    const shouldActivate = args.activate !== false;
    const length = args.length ?? 100;
    const decimals = args.decimals ?? 0;
    const pad6 = (n) => String(n).padStart(6, '0');
    const pad4 = (n) => String(n).padStart(4, '0');
    const dd01v = {
        DOMNAME: domainName,
        DDLANGUAGE: 'E',
        DATATYPE: (args.datatype || 'CHAR').toUpperCase(),
        LENG: pad6(length),
        DECIMALS: pad6(decimals),
        OUTPUTLEN: pad6(length),
        DDTEXT: args.description || domainName,
        LOWERCASE: args.lowercase ? 'X' : '',
        SIGNFLAG: args.sign_exists ? 'X' : '',
        CONVEXIT: args.conversion_exit || '',
        VALEXI: args.fixed_values && args.fixed_values.length > 0 ? 'X' : '',
        ENTITYTAB: args.value_table || '',
    };
    const dd07v = (args.fixed_values || []).map((fv, i) => ({
        DOMNAME: domainName,
        VALPOS: pad4(i + 1),
        DDLANGUAGE: 'E',
        DOMVALUE_L: fv.low,
        DDTEXT: fv.text,
    }));
    const payload_json = JSON.stringify({ dd01v, dd07v });
    try {
        logger?.info(`ECC: updating domain ${domainName} via ZMCP_ADT_DDIC_DOMA`);
        await (0, rfcBackend_1.callDdicDoma)(connection, 'UPDATE', {
            name: domainName,
            devclass: args.package_name,
            transport: args.transport_request,
            payload_json,
        });
        if (shouldActivate) {
            await (0, rfcBackend_1.callDdicActivate)(connection, 'DOMA', domainName);
        }
        logger?.info(`✅ UpdateDomain (ECC) completed: ${domainName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                domain_name: domainName,
                package: args.package_name,
                transport_request: args.transport_request,
                status: shouldActivate ? 'active' : 'inactive',
                message: `Domain ${domainName} updated${shouldActivate ? ' and activated' : ''} successfully (ECC fallback via OData)`,
                domain_details: null,
                path: 'ecc-odata-rfc',
            }),
        });
    }
    catch (error) {
        logger?.error(`ECC UpdateDomain error for ${domainName}: ${error?.message || error}`);
        throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to update domain ${domainName} (ECC fallback): ${error?.message || String(error)}`);
    }
}
//# sourceMappingURL=handleUpdateDomain.js.map