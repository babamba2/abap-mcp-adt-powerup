"use strict";
/**
 * GetBehaviorDefinition Handler - Read ABAP BehaviorDefinition via AdtClient
 *
 * Uses AdtClient.getBehaviorDefinition().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetBehaviorDefinition = handleGetBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetBehaviorDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP behavior definition definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            behavior_definition_name: {
                type: 'string',
                description: 'BehaviorDefinition name (e.g., Z_MY_BEHAVIORDEFINITION).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['behavior_definition_name'],
    },
};
/**
 * Main handler for GetBehaviorDefinition MCP tool
 *
 * Uses AdtClient.getBehaviorDefinition().read() - high-level read operation
 */
async function handleGetBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { behavior_definition_name, version = 'active' } = args;
        // Validation
        if (!behavior_definition_name) {
            return (0, utils_1.return_error)(new Error('behavior_definition_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const behaviorDefinitionName = behavior_definition_name.toUpperCase();
        logger?.info(`Reading behavior definition ${behaviorDefinitionName}, version: ${version}`);
        try {
            // Read behavior definition using AdtClient
            const behaviorDefinitionObject = client.getBehaviorDefinition();
            const readResult = await behaviorDefinitionObject.read({ name: behaviorDefinitionName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`BehaviorDefinition ${behaviorDefinitionName} not found`);
            }
            // Extract data from read result
            const behaviorDefinitionData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetBehaviorDefinition completed successfully: ${behaviorDefinitionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    behavior_definition_name: behaviorDefinitionName,
                    version,
                    behavior_definition_data: behaviorDefinitionData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading behavior definition ${behaviorDefinitionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `BehaviorDefinition ${behaviorDefinitionName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `BehaviorDefinition ${behaviorDefinitionName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetBehaviorDefinition.js.map