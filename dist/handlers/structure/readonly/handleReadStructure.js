"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadStructure = handleReadStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadStructure',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP structure definition and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., Z_MY_STRUCTURE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['structure_name'],
    },
};
async function handleReadStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, version = 'active' } = args;
        if (!structure_name)
            return (0, utils_1.return_error)(new Error('structure_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const structureName = structure_name.toUpperCase();
        const obj = client.getStructure();
        let source_code = null;
        try {
            const readResult = await obj.read({ structureName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${structureName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ structureName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${structureName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                structure_name: structureName,
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
//# sourceMappingURL=handleReadStructure.js.map