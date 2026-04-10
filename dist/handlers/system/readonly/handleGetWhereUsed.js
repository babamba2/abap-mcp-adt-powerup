"use strict";
/**
 * WhereUsed handler using AdtClient utilities
 * Endpoint: /sap/bc/adt/repository/informationsystem/usageReferences
 * Uses getWhereUsedList for parsed results
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetWhereUsed = handleGetWhereUsed;
const clients_1 = require("../../../lib/clients");
const getObjectsListCache_1 = require("../../../lib/getObjectsListCache");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetWhereUsed',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Find where-used references (cross-references, usages, dependencies) for ABAP objects — classes, interfaces, tables, data elements, programs, function modules, etc. Returns list of all referencing objects with their types and packages.',
    inputSchema: {
        type: 'object',
        properties: {
            object_name: {
                type: 'string',
                description: 'Name of the ABAP object',
            },
            object_type: {
                type: 'string',
                description: 'Type of the ABAP object (class, interface, program, table, etc.)',
            },
            enable_all_types: {
                type: 'boolean',
                description: "If true, searches in all available object types (Eclipse 'select all' behavior). Default: false (uses SAP default scope)",
                default: false,
            },
        },
        required: ['object_name', 'object_type'],
    },
};
/**
 * Returns where-used references for ABAP objects using AdtClient utilities.
 * Uses getWhereUsedList for parsed structured results.
 */
async function handleGetWhereUsed(context, args) {
    const { connection, logger } = context;
    try {
        // Validate required parameters
        if (!args?.object_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Object name is required');
        }
        if (!args?.object_type) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Object type is required');
        }
        const typedArgs = args;
        logger?.info(`Resolving where-used list for ${typedArgs.object_type}/${typedArgs.object_name}`);
        // Create AdtClient and get utilities
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        // Use getWhereUsedList for parsed results
        const result = await utils.getWhereUsedList({
            object_name: typedArgs.object_name,
            object_type: typedArgs.object_type,
            enableAllTypes: typedArgs.enable_all_types,
        });
        logger?.debug(`Where-used search completed for ${typedArgs.object_type}/${typedArgs.object_name}: ${result.totalReferences} references`);
        // Format response with parsed data
        const formattedResponse = {
            object_name: result.objectName,
            object_type: result.objectType,
            enable_all_types: typedArgs.enable_all_types || false,
            total_references: result.totalReferences,
            result_description: result.resultDescription,
            references: result.references.map((ref) => ({
                name: ref.name,
                type: ref.type,
                uri: ref.uri,
                package_name: ref.packageName,
                responsible: ref.responsible,
                usage_information: ref.usageInformation,
            })),
        };
        const mcpResult = {
            isError: false,
            content: [
                {
                    type: 'json',
                    json: formattedResponse,
                },
            ],
        };
        getObjectsListCache_1.objectsListCache.setCache(mcpResult);
        return mcpResult;
    }
    catch (error) {
        logger?.error('Failed to resolve where-used references', error);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `ADT error: ${String(error)}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetWhereUsed.js.map