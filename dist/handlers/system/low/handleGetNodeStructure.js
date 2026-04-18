"use strict";
/**
 * GetNodeStructure Handler - Low-level handler for node structure
 *
 * Uses fetchNodeStructure from @babamba2/mcp-abap-adt-clients AdtUtils.
 * Fetches node structure from ADT repository for object tree navigation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetNodeStructure = handleGetNodeStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetNodeStructureLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Fetch node structure from ADT repository. Used for object tree navigation and structure discovery. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            parent_type: {
                type: 'string',
                description: 'Parent object type (e.g., "CLAS/OC", "PROG/P", "DEVC/K")',
            },
            parent_name: {
                type: 'string',
                description: 'Parent object name',
            },
            node_id: {
                type: 'string',
                description: 'Optional node ID (default: "0000" for root). Use to fetch child nodes.',
                default: '0000',
            },
            with_short_descriptions: {
                type: 'boolean',
                description: 'Include short descriptions in response',
                default: true,
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['parent_type', 'parent_name'],
    },
};
/**
 * Main handler for GetNodeStructureLow MCP tool
 *
 * Uses fetchNodeStructure from AdtUtils
 */
async function handleGetNodeStructure(context, args) {
    const { connection, logger } = context;
    try {
        // Validate required parameters
        if (!args?.parent_type) {
            return (0, utils_1.return_error)(new Error('parent_type is required'));
        }
        if (!args?.parent_name) {
            return (0, utils_1.return_error)(new Error('parent_name is required'));
        }
        // Restore session state if provided
        if (args.session_id && args.session_state) {
            const { restoreSessionInConnection } = await import('../../../lib/utils.js');
            await restoreSessionInConnection(connection, args.session_id, args.session_state);
        }
        // Create AdtClient and get utilities
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        logger?.info(`Fetching node structure for ${args.parent_type}/${args.parent_name}`);
        const result = await utils.fetchNodeStructure(args.parent_type, args.parent_name, args.node_id || '0000', args.with_short_descriptions !== false);
        logger?.debug(`Node structure fetched successfully for ${args.parent_type}/${args.parent_name}`);
        return (0, utils_1.return_response)(result);
    }
    catch (error) {
        logger?.error('Failed to fetch node structure', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetNodeStructure.js.map