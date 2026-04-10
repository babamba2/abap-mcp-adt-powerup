"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadView = handleReadView;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadView',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Read ABAP view (CDS view) source code and metadata (package, responsible, description, etc.).',
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
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['view_name'],
    },
};
async function handleReadView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, version = 'active' } = args;
        if (!view_name)
            return (0, utils_1.return_error)(new Error('view_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const viewName = view_name.toUpperCase();
        const obj = client.getView();
        let source_code = null;
        try {
            const readResult = await obj.read({ viewName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${viewName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ viewName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${viewName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                view_name: viewName,
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
//# sourceMappingURL=handleReadView.js.map