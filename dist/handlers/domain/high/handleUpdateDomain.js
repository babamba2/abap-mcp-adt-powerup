"use strict";
/**
 * UpdateDomain Handler - Update Existing ABAP Domain
 *
 * Uses DomainBuilder from @mcp-abap-adt/adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: lock -> update -> check -> unlock -> (activate)
 * Note: No validation step - lock will fail if domain doesn't exist
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateDomain = handleUpdateDomain;
const clients_1 = require("../../../lib/clients");
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
 * Uses DomainBuilder from @mcp-abap-adt/adt-clients for all operations
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
                const properties = {
                    domainName: domainName,
                    packageName: typedArgs.package_name,
                    description: typedArgs.description || domainName,
                    datatype: typedArgs.datatype,
                    length: typedArgs.length,
                    decimals: typedArgs.decimals,
                    conversionExit: typedArgs.conversion_exit,
                    lowercase: typedArgs.lowercase,
                    signExists: typedArgs.sign_exists,
                    valueTable: typedArgs.value_table,
                    fixedValues: typedArgs.fixed_values,
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
//# sourceMappingURL=handleUpdateDomain.js.map