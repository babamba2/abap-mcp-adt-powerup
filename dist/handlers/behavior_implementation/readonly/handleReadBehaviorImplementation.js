"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadBehaviorImplementation = handleReadBehaviorImplementation;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadBehaviorImplementation',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP behavior implementation source code and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            behavior_implementation_name: {
                type: 'string',
                description: 'Behavior implementation name (e.g., ZBP_MY_CLASS).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['behavior_implementation_name'],
    },
};
async function handleReadBehaviorImplementation(context, args) {
    const { connection, logger } = context;
    try {
        const { behavior_implementation_name, version = 'active' } = args;
        if (!behavior_implementation_name)
            return (0, utils_1.return_error)(new Error('behavior_implementation_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const behaviorImplementationName = behavior_implementation_name.toUpperCase();
        const obj = client.getBehaviorImplementation();
        let source_code = null;
        try {
            const readResult = await obj.read({ className: behaviorImplementationName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${behaviorImplementationName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({
                className: behaviorImplementationName,
            });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${behaviorImplementationName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                behavior_implementation_name: behaviorImplementationName,
                version,
                source_code,
                metadata,
            }, null, 2),
        });
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
function safeStringify(data) {
    try {
        return JSON.stringify(data);
    }
    catch {
        return String(data);
    }
}
//# sourceMappingURL=handleReadBehaviorImplementation.js.map