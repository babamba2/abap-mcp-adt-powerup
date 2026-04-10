"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadMetadataExtension = handleReadMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadMetadataExtension',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP metadata extension (DDLX) source code and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            metadata_extension_name: {
                type: 'string',
                description: 'Metadata extension name (e.g., Z_MY_DDLX).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['metadata_extension_name'],
    },
};
async function handleReadMetadataExtension(context, args) {
    const { connection, logger } = context;
    try {
        const { metadata_extension_name, version = 'active' } = args;
        if (!metadata_extension_name)
            return (0, utils_1.return_error)(new Error('metadata_extension_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const metadataExtensionName = metadata_extension_name.toUpperCase();
        const obj = client.getMetadataExtension();
        let source_code = null;
        try {
            const readResult = await obj.read({ name: metadataExtensionName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${metadataExtensionName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({
                name: metadataExtensionName,
            });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${metadataExtensionName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                metadata_extension_name: metadataExtensionName,
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
//# sourceMappingURL=handleReadMetadataExtension.js.map