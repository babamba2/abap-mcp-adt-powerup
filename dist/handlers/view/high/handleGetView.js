"use strict";
/**
 * GetView Handler - Read ABAP View via AdtClient
 *
 * Uses AdtClient.getView().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetView = handleGetView;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetView',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP view definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., Z_MY_VIEW).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['view_name'],
    },
};
/**
 * Main handler for GetView MCP tool
 *
 * Uses AdtClient.getView().read() - high-level read operation
 */
async function handleGetView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, version = 'active' } = args;
        // Validation
        if (!view_name) {
            return (0, utils_1.return_error)(new Error('view_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const viewName = view_name.toUpperCase();
        logger?.info(`Reading view ${viewName}, version: ${version}`);
        try {
            // Read view using AdtClient
            const viewObject = client.getView();
            const readResult = await viewObject.read({ viewName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`View ${viewName} not found`);
            }
            // Extract data from read result
            const viewData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetView completed successfully: ${viewName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    view_name: viewName,
                    version,
                    view_data: viewData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading view ${viewName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read view: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `View ${viewName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `View ${viewName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetView.js.map