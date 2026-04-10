"use strict";
/**
 * GetBehaviorImplementation Handler - Read ABAP BehaviorImplementation via AdtClient
 *
 * Uses AdtClient.getBehaviorImplementation().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetBehaviorImplementation = handleGetBehaviorImplementation;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetBehaviorImplementation',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP behavior implementation definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            behavior_implementation_name: {
                type: 'string',
                description: 'BehaviorImplementation name (e.g., Z_MY_BEHAVIORIMPLEMENTATION).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['behavior_implementation_name'],
    },
};
/**
 * Main handler for GetBehaviorImplementation MCP tool
 *
 * Uses AdtClient.getBehaviorImplementation().read() - high-level read operation
 */
async function handleGetBehaviorImplementation(context, args) {
    const { connection, logger } = context;
    try {
        const { behavior_implementation_name, version = 'active' } = args;
        // Validation
        if (!behavior_implementation_name) {
            return (0, utils_1.return_error)(new Error('behavior_implementation_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const behaviorImplementationName = behavior_implementation_name.toUpperCase();
        logger?.info(`Reading behavior implementation ${behaviorImplementationName}, version: ${version}`);
        try {
            // Read behavior implementation using AdtClient
            const behaviorImplementationObject = client.getBehaviorImplementation();
            const readResult = await behaviorImplementationObject.read({ className: behaviorImplementationName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`BehaviorImplementation ${behaviorImplementationName} not found`);
            }
            // Extract data from read result
            const behaviorImplementationData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetBehaviorImplementation completed successfully: ${behaviorImplementationName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    behavior_implementation_name: behaviorImplementationName,
                    version,
                    behavior_implementation_data: behaviorImplementationData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading behavior implementation ${behaviorImplementationName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read behavior implementation: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `BehaviorImplementation ${behaviorImplementationName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `BehaviorImplementation ${behaviorImplementationName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetBehaviorImplementation.js.map