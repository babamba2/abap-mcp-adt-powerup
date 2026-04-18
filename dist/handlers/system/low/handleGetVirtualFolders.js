"use strict";
/**
 * GetVirtualFolders Handler - Low-level handler for virtual folders
 *
 * Uses getVirtualFoldersContents from @babamba2/mcp-abap-adt-clients AdtUtils.
 * Retrieves hierarchical virtual folder contents from ADT information system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetVirtualFolders = handleGetVirtualFolders;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetVirtualFoldersLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Retrieve hierarchical virtual folder contents from ADT information system. Used for browsing ABAP objects by package, group, type, etc.',
    inputSchema: {
        type: 'object',
        properties: {
            object_search_pattern: {
                type: 'string',
                description: 'Object search pattern (e.g., "*", "Z*", "ZCL_*"). Default: "*"',
                default: '*',
            },
            preselection: {
                type: 'array',
                description: 'Optional preselection filters (facet-value pairs for filtering)',
                items: {
                    type: 'object',
                    properties: {
                        facet: {
                            type: 'string',
                            description: 'Facet name (e.g., "package", "group", "type")',
                        },
                        values: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of facet values to filter by',
                        },
                    },
                    required: ['facet', 'values'],
                },
            },
            facet_order: {
                type: 'array',
                items: { type: 'string' },
                description: 'Order of facets in response (e.g., ["package", "group", "type"]). Default: ["package", "group", "type"]',
                default: ['package', 'group', 'type'],
            },
            with_versions: {
                type: 'boolean',
                description: 'Include version information in response',
                default: false,
            },
            ignore_short_descriptions: {
                type: 'boolean',
                description: 'Ignore short descriptions in response',
                default: false,
            },
        },
        required: [],
    },
};
/**
 * Main handler for GetVirtualFoldersLow MCP tool
 *
 * Uses getVirtualFoldersContents from AdtUtils
 */
async function handleGetVirtualFolders(context, args) {
    const { connection, logger } = context;
    try {
        // Create AdtClient and get utilities
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        logger?.info('Fetching virtual folders contents');
        const params = {
            objectSearchPattern: args.object_search_pattern || '*',
            preselection: args.preselection,
            facetOrder: args.facet_order || ['package', 'group', 'type'],
            withVersions: args.with_versions,
            ignoreShortDescriptions: args.ignore_short_descriptions,
        };
        const result = await utils.getVirtualFoldersContents(params);
        logger?.debug('Virtual folders contents fetched successfully');
        return (0, utils_1.return_response)(result);
    }
    catch (error) {
        logger?.error('Failed to fetch virtual folders contents', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetVirtualFolders.js.map