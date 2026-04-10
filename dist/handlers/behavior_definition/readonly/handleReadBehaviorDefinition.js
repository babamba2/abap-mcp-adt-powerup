"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadBehaviorDefinition = handleReadBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadBehaviorDefinition',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP behavior definition source code and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            behavior_definition_name: {
                type: 'string',
                description: 'Behavior definition name (e.g., Z_MY_BDEF).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['behavior_definition_name'],
    },
};
async function handleReadBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { behavior_definition_name, version = 'active' } = args;
        if (!behavior_definition_name)
            return (0, utils_1.return_error)(new Error('behavior_definition_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const behaviorDefinitionName = behavior_definition_name.toUpperCase();
        const obj = client.getBehaviorDefinition();
        let source_code = null;
        try {
            const readResult = await obj.read({ name: behaviorDefinitionName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${behaviorDefinitionName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({
                name: behaviorDefinitionName,
            });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${behaviorDefinitionName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                behavior_definition_name: behaviorDefinitionName,
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
//# sourceMappingURL=handleReadBehaviorDefinition.js.map